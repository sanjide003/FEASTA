import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardCheck,
  FileEdit,
  LayoutDashboard,
  Lock,
  Save,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import { WorkspaceShell, type WorkspaceNavItem } from '../../components/layout/WorkspaceShell';
import { ActionIconButton } from '../../components/ui/ActionIconButton';
import { CompactDataTable, type TableColumn } from '../../components/ui/CompactDataTable';
import { useDialog } from '../../components/ui/DialogContext';
import { cachedGetDoc } from '../../lib/dataCache';
import { judgingEnabled, normalizeFestSetup } from '../../lib/festConfig';
import { getFirebaseState } from '../../lib/firebase';
import { createScoringSnapshot, defaultScoringRules, resolveEventScoring } from '../../lib/scoreUtils';
import { resolveAuthenticatedProfile, routeForRole, signOutStaff } from '../../lib/staffAuth';
import type {
  AccessUser,
  FestEvent,
  GeneralConfig,
  JudgeAssignment,
  JudgeScore,
  JudgeScoreMark,
  Registration,
  Student,
} from '../../types/festival';

const EVALUATION_OPTIONS = [
  { value: 'awarded', label: 'Awarded' },
  { value: 'absent', label: 'Absent' },
  { value: 'disqualified', label: 'Disqualified' },
  { value: 'no-award', label: 'No Award' },
  { value: 'withheld', label: 'Withheld' },
] as const;

interface ParticipantRow {
  participantId: string;
  label: string;
  sublabel: string;
}

export const JudgePortal: React.FC = () => {
  const navigate = useNavigate();
  const { toast, confirm } = useDialog();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profile, setProfile] = useState<AccessUser | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [general, setGeneral] = useState<GeneralConfig>({});
  const [scoringRules, setScoringRules] = useState<Record<string, any>>(() => defaultScoringRules());
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([]);
  const [scoresMap, setScoresMap] = useState<Map<string, JudgeScore>>(new Map());
  const [eventsMap, setEventsMap] = useState<Map<string, FestEvent>>(new Map());

  // Active scoring workspace
  const [activeAssignmentId, setActiveAssignmentId] = useState('');
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [draftMarks, setDraftMarks] = useState<Record<string, JudgeScoreMark>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openedScoreVersion, setOpenedScoreVersion] = useState(0);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  const judgeIds = useMemo(() => {
    if (!profile) return [];
    const set = new Set<string>(
      [profile.uid, profile.authUid, profile.id, (profile as any).accessDocId, (profile as any).sourceAccessDocId]
        .filter(Boolean)
        .map(String)
    );
    return [...set].slice(0, 10);
  }, [profile]);

  useEffect(() => {
    document.title = 'Judge Scoring Desk — Feastport';
    const { auth, isFirebaseConfigured } = getFirebaseState();
    if (!isFirebaseConfigured || !auth) {
      setCheckingAuth(false);
      navigate('/login', { replace: true });
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous) {
        setCheckingAuth(false);
        navigate('/login', { replace: true });
        return;
      }
      const p = await resolveAuthenticatedProfile(user.uid, user.email);
      if (!p) {
        setCheckingAuth(false);
        navigate('/login', { replace: true });
        return;
      }
      if (p.role !== 'judge') {
        navigate(routeForRole(p.role), { replace: true });
        return;
      }
      setProfile(p);
      setCheckingAuth(false);
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const { db } = getFirebaseState();
    if (!db || !profile || judgeIds.length === 0) return;

    Promise.all([
      cachedGetDoc<GeneralConfig>(db, 'settings', 'general'),
      cachedGetDoc<Record<string, any>>(db, 'settings', 'scoring_rules'),
    ]).then(([gen, rules]) => {
      setGeneral(gen || {});
      setScoringRules(rules || defaultScoringRules());
    });

    const assignQuery =
      judgeIds.length === 1
        ? query(collection(db, 'judgeAssignments'), where('judgeId', '==', judgeIds[0]))
        : query(collection(db, 'judgeAssignments'), where('judgeId', 'in', judgeIds));

    const scoreQuery =
      judgeIds.length === 1
        ? query(collection(db, 'judgeScores'), where('judgeId', '==', judgeIds[0]))
        : query(collection(db, 'judgeScores'), where('judgeId', 'in', judgeIds));

    const unsubAssign = onSnapshot(assignQuery, async (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as JudgeAssignment))
        .filter((a) => a.active !== false);
      setAssignments(rows);

      // Chunked fetch for assigned events only
      const evIds = [...new Set(rows.map((r) => r.eventId).filter(Boolean))];
      const evMap = new Map<string, FestEvent>();
      for (let i = 0; i < evIds.length; i += 30) {
        const chunk = evIds.slice(i, i + 30);
        const evSnap = await getDocs(query(collection(db, 'events'), where(documentId(), 'in', chunk))).catch(() => null);
        evSnap?.docs.forEach((d) => evMap.set(d.id, { id: d.id, ...(d.data() as any) } as FestEvent));
      }
      setEventsMap(evMap);
    });

    const unsubScores = onSnapshot(scoreQuery, (snap) => {
      const next = new Map<string, JudgeScore>();
      snap.docs.forEach((d) => {
        const data = { id: d.id, ...(d.data() as any) } as JudgeScore;
        next.set(data.assignmentId || d.id, data);
      });
      setScoresMap(next);
    });

    return () => {
      unsubAssign();
      unsubScores();
    };
  }, [profile, judgeIds]);

  const festSetup = useMemo(() => normalizeFestSetup(general.festSetup || {}), [general.festSetup]);
  const isJudgingEnabled = judgingEnabled(festSetup);

  const activeAssignment = useMemo(
    () => assignments.find((a) => a.id === activeAssignmentId) || null,
    [assignments, activeAssignmentId]
  );
  const activeEvent = activeAssignment ? eventsMap.get(activeAssignment.eventId) || null : null;
  const activeScore = activeAssignment ? scoresMap.get(activeAssignment.id) || null : null;
  const isReadOnly = activeScore?.status === 'submitted';

  const openAssignment = async (assignment: JudgeAssignment) => {
    if (dirty && activeAssignmentId && activeAssignmentId !== assignment.id) {
      const leave = await confirm('You have unsaved marks in the current sheet. Discard changes?', {
        title: 'Unsaved Changes',
        okLabel: 'Discard & Switch',
      });
      if (!leave) return;
    }

    const { db } = getFirebaseState();
    const ev = eventsMap.get(assignment.eventId);
    if (!db || !ev) {
      toast('Assigned event details are missing.', 'error');
      return;
    }

    setLoadingWorkspace(true);
    setActiveAssignmentId(assignment.id);
    setActiveTab('scoring');
    setDirty(false);

    try {
      const regSnap = await getDocs(query(collection(db, 'registrations'), where('eventId', '==', ev.id)));
      const regs = regSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Registration));
      const allStudentIds = [...new Set(regs.flatMap((r) => r.studentIds || []).filter(Boolean))];
      const stuMap = new Map<string, Student>();
      for (let i = 0; i < allStudentIds.length; i += 30) {
        const chunk = allStudentIds.slice(i, i + 30);
        const sSnap = await getDocs(query(collection(db, 'students'), where(documentId(), 'in', chunk))).catch(() => null);
        sSnap?.docs.forEach((d) => stuMap.set(d.id, { id: d.id, ...(d.data() as any) } as Student));
      }

      const rows: ParticipantRow[] = [];
      if (ev.type === 'Group') {
        regs.forEach((r) => {
          const names = (r.studentIds || []).map((sid) => stuMap.get(sid)?.name || sid).filter(Boolean);
          rows.push({
            participantId: r.id,
            label: `Entry #${r.slotIndex || 1} (${names.length} member${names.length === 1 ? '' : 's'})`,
            sublabel: names.join(', '),
          });
        });
      } else {
        regs.forEach((r) => {
          (r.studentIds || []).forEach((sid) => {
            if (rows.some((x) => x.participantId === sid)) return;
            const st = stuMap.get(sid);
            rows.push({
              participantId: sid,
              label: st?.chestNo ? `Chest #${st.chestNo}` : st?.name || sid,
              sublabel: st?.name ? `${st.name}${st.category ? ` · ${st.category}` : ''}` : 'Student Participant',
            });
          });
        });
      }

      rows.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
      setParticipants(rows);

      const existingScore = scoresMap.get(assignment.id);
      setOpenedScoreVersion(Number(existingScore?.scoreVersion || 0));
      const initial: Record<string, JudgeScoreMark> = {};
      rows.forEach((row) => {
        const prev = (existingScore?.marks || []).find((m) => m.participantId === row.participantId);
        initial[row.participantId] = prev
          ? { ...prev }
          : {
              participantId: row.participantId,
              rawMark: 0,
              evaluation: 'awarded',
              criterionMarks: {},
            };
      });
      setDraftMarks(initial);
    } catch (err: any) {
      toast(err?.message || 'Unable to load event participants.', 'error');
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const updateParticipantMark = (pid: string, patch: Partial<JudgeScoreMark>) => {
    if (isReadOnly || !activeEvent) return;
    setDirty(true);
    setDraftMarks((prev) => {
      const cur = prev[pid] || { participantId: pid, rawMark: 0, evaluation: 'awarded', criterionMarks: {} };
      const next: JudgeScoreMark = { ...cur, ...patch };
      const method = activeEvent.resultMethod || 'manual';

      if (method === 'criteria' && activeEvent.criteria?.length) {
        const sum = activeEvent.criteria.reduce((s, c) => s + Number(next.criterionMarks?.[c.key] || 0), 0);
        next.rawMark = Number(sum.toFixed(2));
      } else if (method === 'objective') {
        const correct = Number(next.correctCount || 0) * Number(activeEvent.objectiveRule?.correctMark ?? 1);
        const wrong = Number(next.wrongCount || 0) * Number(activeEvent.objectiveRule?.wrongPenalty ?? 0);
        next.rawMark = Number(Math.max(0, correct - wrong).toFixed(2));
      } else if (method === 'count') {
        const val = Number(next.countValue || 0) - Number(next.penaltyCount || 0) * Number(activeEvent.countRule?.wrongPenalty ?? 0);
        next.rawMark = Number(Math.max(0, val).toFixed(2));
      } else if (method === 'time') {
        next.rawMark = Number(next.timeSeconds || 0);
      } else if (method === 'elimination') {
        next.rawMark = Number(next.eliminationOrder || 0);
      }
      return { ...prev, [pid]: next };
    });
  };

  const persistScores = async (targetStatus: 'draft' | 'submitted') => {
    const { db } = getFirebaseState();
    if (!db || !activeAssignment || !activeEvent || !profile) return;

    if (targetStatus === 'submitted') {
      const ok = await confirm(
        `Submit final scores for "${activeEvent.name}"? Once submitted, the sheet locks until reopened by Admin.`,
        { title: 'Submit Official Score Sheet', okLabel: 'Submit Final Scores', tone: 'primary' }
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const marks = participants.map((p) => {
        const m = draftMarks[p.participantId] || { participantId: p.participantId, rawMark: 0, evaluation: 'awarded' };
        return {
          ...m,
          participantId: p.participantId,
          rawMark: Number(m.rawMark || 0),
          evaluation: m.evaluation || 'awarded',
        };
      });

      const snapshot = createScoringSnapshot(scoringRules, activeEvent);
      const now = Date.now();
      const scoreRef = doc(db, 'judgeScores', activeAssignment.id);
      const pubRef = doc(db, 'publicJudgingStatuses', activeAssignment.id);

      await runTransaction(db, async (tx) => {
        const existingSnap = await tx.get(scoreRef);
        const pubSnap = targetStatus === 'submitted' ? await tx.get(pubRef) : null;
        if (existingSnap.exists()) {
          const data = existingSnap.data() as JudgeScore;
          if (data.status === 'submitted') {
            throw new Error('This score sheet was already submitted.');
          }
          if (Number(data.scoreVersion || 0) > openedScoreVersion) {
            throw new Error('Score sheet changed remotely. Re-open this assignment before saving.');
          }
        }
        const nextVersion = openedScoreVersion + 1;
        tx.set(scoreRef, {
          assignmentId: activeAssignment.id,
          judgeId: activeAssignment.judgeId,
          judgeName: profile.displayName || profile.username,
          eventId: activeEvent.id,
          eventName: activeEvent.name,
          status: targetStatus,
          marks,
          scoringSnapshot: snapshot,
          scoreVersion: nextVersion,
          updatedAt: now,
          ...(targetStatus === 'submitted' ? { submittedAt: now } : {}),
        });
        if (targetStatus === 'submitted' && (!pubSnap || !pubSnap.exists())) {
          tx.set(pubRef, {
            assignmentId: activeAssignment.id,
            eventId: activeEvent.id,
            status: 'submitted',
            submittedAt: now,
          });
        }
        setOpenedScoreVersion(nextVersion);
      });

      setDirty(false);
      toast(
        targetStatus === 'submitted' ? 'Score sheet submitted successfully.' : 'Draft marks saved.',
        'success'
      );
    } catch (err: any) {
      toast(err?.message || 'Unable to save score sheet.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOutStaff();
    navigate('/login', { replace: true });
  };

  const assignedList = assignments.filter((a) => !scoresMap.get(a.id));
  const draftsList = assignments.filter((a) => scoresMap.get(a.id)?.status === 'draft');
  const submittedList = assignments.filter((a) => scoresMap.get(a.id)?.status === 'submitted');

  const navItems: WorkspaceNavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'assigned', label: 'Pending Events', icon: ClipboardCheck, badge: assignedList.length },
    { id: 'drafts', label: 'Saved Drafts', icon: FileEdit, badge: draftsList.length },
    { id: 'submitted', label: 'Submitted Sheets', icon: CheckCircle2 },
    ...(activeAssignment ? [{ id: 'scoring', label: 'Scoring Workspace', icon: SlidersHorizontal }] : []),
  ];

  const assignmentCols: TableColumn<JudgeAssignment>[] = [
    {
      key: 'event',
      header: 'Competition',
      render: (a) => {
        const ev = eventsMap.get(a.eventId);
        return (
          <div>
            <p className="font-semibold text-slate-900">{ev?.name || a.eventName || a.eventId}</p>
            <p className="text-[11px] text-slate-500">
              {ev ? `${ev.category} · ${ev.stage} · ${ev.type} · ${ev.resultMethod || 'manual'}` : a.category || ''}
            </p>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Sheet Status',
      render: (a) => {
        const sc = scoresMap.get(a.id);
        return (
          <span
            className={`text-xs font-semibold ${
              sc?.status === 'submitted'
                ? 'text-emerald-700'
                : sc?.status === 'draft'
                ? 'text-amber-700'
                : 'text-slate-500'
            }`}
          >
            {sc?.status === 'submitted' ? 'Submitted (Locked)' : sc?.status === 'draft' ? 'Draft Saved' : 'Not Started'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (a) => (
        <ActionIconButton
          icon={scoresMap.get(a.id)?.status === 'submitted' ? Lock : FileEdit}
          label={scoresMap.get(a.id)?.status === 'submitted' ? 'Inspect submitted sheet' : 'Open scoring sheet'}
          tone="primary"
          onClick={() => openAssignment(a)}
        />
      ),
    },
  ];

  const resolvedEventScoring = useMemo(
    () => (activeEvent ? resolveEventScoring(scoringRules, activeEvent) : null),
    [scoringRules, activeEvent]
  );

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-xs font-medium text-slate-500">
        Verifying judge access…
      </div>
    );
  }

  return (
    <WorkspaceShell
      portalTitle="Judge Scoring Desk"
      portalSubtitle={profile?.displayName || profile?.username || 'Adjudicator'}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userLabel={profile?.displayName || profile?.username || 'Judge'}
      userSublabel="Official Adjudicator"
      onLogout={handleLogout}
    >
      {!isJudgingEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm font-medium text-amber-800">
          Judging mode is currently disabled in Festival Setup.
        </div>
      ) : activeTab === 'overview' ? (
        <div className="space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Adjudicator Overview</h1>
            <p className="text-xs text-slate-500">Select an assigned competition to evaluate participants.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pending Events</p>
              <p className="mt-1 font-mono-num text-2xl font-extrabold text-slate-900">{assignedList.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Drafts in Progress</p>
              <p className="mt-1 font-mono-num text-2xl font-extrabold text-amber-700">{draftsList.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Submitted Sheets</p>
              <p className="mt-1 font-mono-num text-2xl font-extrabold text-emerald-700">{submittedList.length}</p>
            </div>
          </div>

          <CompactDataTable
            rows={assignments}
            columns={assignmentCols}
            rowKey={(a) => a.id}
            itemLabel="assignments"
            emptyTitle="No judge assignments yet"
            emptyDescription="When an administrator assigns competitions to your account, they will appear here."
          />
        </div>
      ) : activeTab === 'assigned' ? (
        <CompactDataTable
          rows={assignedList}
          columns={assignmentCols}
          rowKey={(a) => a.id}
          itemLabel="pending assignments"
          emptyTitle="All caught up"
          emptyDescription="No unstarted competitions remaining."
        />
      ) : activeTab === 'drafts' ? (
        <CompactDataTable
          rows={draftsList}
          columns={assignmentCols}
          rowKey={(a) => a.id}
          itemLabel="drafts"
          emptyTitle="No saved drafts"
          emptyDescription="Draft sheets you save mid-evaluation will appear here."
        />
      ) : activeTab === 'submitted' ? (
        <CompactDataTable
          rows={submittedList}
          columns={assignmentCols}
          rowKey={(a) => a.id}
          itemLabel="submitted sheets"
          emptyTitle="No submitted sheets"
          emptyDescription="Finalized score sheets will appear here."
        />
      ) : activeTab === 'scoring' && activeEvent && activeAssignment ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">{activeEvent.name}</h1>
              <p className="text-xs text-slate-500">
                {activeEvent.category} · {activeEvent.stage} · {activeEvent.type} · Method:{' '}
                <strong className="uppercase">{activeEvent.resultMethod || 'manual'}</strong> · Max Mark:{' '}
                <span className="font-mono-num font-bold">{activeEvent.maximumMark || 100}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isReadOnly ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <Lock className="h-3.5 w-3.5" /> Submitted
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={saving || loadingWorkspace}
                    onClick={() => persistScores('draft')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Draft</span>
                  </button>
                  <button
                    type="button"
                    disabled={saving || loadingWorkspace}
                    onClick={() => persistScores('submitted')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Submit Final</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {loadingWorkspace ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
              Loading participant roster…
            </div>
          ) : participants.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">
              No participants registered yet for this competition.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-3.5 py-2.5">Participant / Chest</th>
                      <th className="px-3.5 py-2.5">Evaluation</th>
                      {activeEvent.resultMethod === 'criteria' &&
                        activeEvent.criteria?.map((c) => (
                          <th key={c.key} className="px-3 py-2.5 text-right">
                            {c.name} (/{c.maximumMark})
                          </th>
                        ))}
                      {activeEvent.resultMethod === 'objective' && (
                        <>
                          <th className="px-3 py-2.5 text-right">Correct</th>
                          <th className="px-3 py-2.5 text-right">Wrong</th>
                        </>
                      )}
                      {activeEvent.resultMethod === 'count' && (
                        <>
                          <th className="px-3 py-2.5 text-right">Count</th>
                          <th className="px-3 py-2.5 text-right">Penalty</th>
                        </>
                      )}
                      {activeEvent.resultMethod === 'time' && <th className="px-3 py-2.5 text-right">Time (sec)</th>}
                      {activeEvent.resultMethod === 'elimination' && (
                        <th className="px-3 py-2.5 text-right">Round Order</th>
                      )}
                      {activeEvent.resultMethod === 'direct_rank' && (
                        <>
                          <th className="px-3 py-2.5">Position</th>
                          {resolvedEventScoring?.enabled.grades && <th className="px-3 py-2.5">Grade</th>}
                        </>
                      )}
                      <th className="px-3.5 py-2.5 text-right">Total Mark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {participants.map((row) => {
                      const mark = draftMarks[row.participantId] || {
                        participantId: row.participantId,
                        rawMark: 0,
                        evaluation: 'awarded',
                      };
                      const method = activeEvent.resultMethod || 'manual';
                      const lockedRow = isReadOnly || mark.evaluation === 'absent' || mark.evaluation === 'disqualified';
                      return (
                        <tr key={row.participantId} className="hover:bg-slate-50/80">
                          <td className="px-3.5 py-2.5">
                            <p className="font-mono-num font-bold text-slate-900">{row.label}</p>
                            <p className="text-[11px] text-slate-500">{row.sublabel}</p>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <select
                              disabled={isReadOnly}
                              value={mark.evaluation || 'awarded'}
                              onChange={(e) =>
                                updateParticipantMark(row.participantId, { evaluation: e.target.value })
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                            >
                              {EVALUATION_OPTIONS.map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {method === 'criteria' &&
                            activeEvent.criteria?.map((c) => (
                              <td key={c.key} className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  max={c.maximumMark}
                                  step="0.5"
                                  disabled={lockedRow}
                                  value={mark.criterionMarks?.[c.key] ?? ''}
                                  onChange={(e) => {
                                    const val = Math.min(c.maximumMark, Math.max(0, Number(e.target.value || 0)));
                                    updateParticipantMark(row.participantId, {
                                      criterionMarks: { ...(mark.criterionMarks || {}), [c.key]: val },
                                    });
                                  }}
                                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
                                />
                              </td>
                            ))}

                          {method === 'objective' && (
                            <>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  disabled={lockedRow}
                                  value={mark.correctCount ?? 0}
                                  onChange={(e) =>
                                    updateParticipantMark(row.participantId, {
                                      correctCount: Math.max(0, Number(e.target.value || 0)),
                                    })
                                  }
                                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  disabled={lockedRow}
                                  value={mark.wrongCount ?? 0}
                                  onChange={(e) =>
                                    updateParticipantMark(row.participantId, {
                                      wrongCount: Math.max(0, Number(e.target.value || 0)),
                                    })
                                  }
                                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
                                />
                              </td>
                            </>
                          )}

                          {method === 'count' && (
                            <>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  disabled={lockedRow}
                                  value={mark.countValue ?? 0}
                                  onChange={(e) =>
                                    updateParticipantMark(row.participantId, {
                                      countValue: Math.max(0, Number(e.target.value || 0)),
                                    })
                                  }
                                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  disabled={lockedRow}
                                  value={mark.penaltyCount ?? 0}
                                  onChange={(e) =>
                                    updateParticipantMark(row.participantId, {
                                      penaltyCount: Math.max(0, Number(e.target.value || 0)),
                                    })
                                  }
                                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
                                />
                              </td>
                            </>
                          )}

                          {method === 'time' && (
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                disabled={lockedRow}
                                value={mark.timeSeconds ?? 0}
                                onChange={(e) =>
                                  updateParticipantMark(row.participantId, {
                                    timeSeconds: Math.max(0, Number(e.target.value || 0)),
                                  })
                                }
                                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
                              />
                            </td>
                          )}

                          {method === 'elimination' && (
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min={1}
                                disabled={lockedRow}
                                value={mark.eliminationOrder ?? 1}
                                onChange={(e) =>
                                  updateParticipantMark(row.participantId, {
                                    eliminationOrder: Math.max(1, Number(e.target.value || 1)),
                                  })
                                }
                                className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
                              />
                            </td>
                          )}

                          {method === 'direct_rank' && (
                            <>
                              <td className="px-3 py-2.5">
                                <select
                                  disabled={lockedRow}
                                  value={mark.position || ''}
                                  onChange={(e) =>
                                    updateParticipantMark(row.participantId, { position: e.target.value })
                                  }
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                                >
                                  <option value="">None</option>
                                  {(resolvedEventScoring?.config.points || []).map((pt: any) => (
                                    <option key={pt.key} value={pt.label}>
                                      {pt.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              {resolvedEventScoring?.enabled.grades && (
                                <td className="px-3 py-2.5">
                                  <select
                                    disabled={lockedRow}
                                    value={mark.grade || ''}
                                    onChange={(e) =>
                                      updateParticipantMark(row.participantId, { grade: e.target.value })
                                    }
                                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                                  >
                                    <option value="">None</option>
                                    {(resolvedEventScoring?.config.grades || []).map((gr: any) => (
                                      <option key={gr.key} value={gr.label}>
                                        {gr.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              )}
                            </>
                          )}

                          <td className="px-3.5 py-2.5 text-right">
                            {method === 'manual' ? (
                              <input
                                type="number"
                                min={0}
                                max={activeEvent.maximumMark || 100}
                                step="0.5"
                                disabled={lockedRow}
                                value={mark.rawMark ?? 0}
                                onChange={(e) =>
                                  updateParticipantMark(row.participantId, {
                                    rawMark: Math.min(
                                      Number(activeEvent.maximumMark || 100),
                                      Math.max(0, Number(e.target.value || 0))
                                    ),
                                  })
                                }
                                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num font-bold text-slate-900"
                              />
                            ) : (
                              <span className="font-mono-num text-sm font-bold text-slate-900">
                                {Number(mark.rawMark || 0)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </WorkspaceShell>
  );
};
