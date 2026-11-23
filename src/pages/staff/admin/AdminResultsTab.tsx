import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { CompactDataTable, type TableColumn } from '../../../components/ui/CompactDataTable';
import { useDialog } from '../../../components/ui/DialogContext';
import { getFirebaseState } from '../../../lib/firebase';
import { normalizeResultData, resolveDisplayName } from '../../../lib/resultUtils';
import {
  calculateEventOutcome,
  createResultRevision,
  createScoringSnapshot,
  judgeScoreToResult,
  normalizeScoringRules,
  resolveEventScoring,
  resolveWinnerDetails,
} from '../../../lib/scoreUtils';
import type { FestEvent, JudgeAssignment, JudgeScore, ResultDoc, ResultGradeAward, ResultPlace } from '../../../types/festival';
import type { AdminActions, AdminState } from './types';

export const AdminResultsTab: React.FC<{ state: AdminState; actions: AdminActions }> = ({ state, actions }) => {
  const { toast, confirm, prompt } = useDialog();
  const [subtab, setSubtab] = useState<'published' | 'sheets' | 'direct' | 'assign'>('published');

  // Judge assignment form
  const [assignJudgeId, setAssignJudgeId] = useState('');
  const [assignEventId, setAssignEventId] = useState('');

  // Direct Entry state
  const [directEventId, setDirectEventId] = useState('');
  const [placePicks, setPlacePicks] = useState<Record<number, string[]>>({ 1: [''], 2: [''], 3: [''] });
  const [gradeRows, setGradeRows] = useState<Array<{ gradeLabel: string; participantId: string }>>([]);
  const [publishing, setPublishing] = useState(false);

  const judges = useMemo(
    () => state.staffUsers.filter((u) => u.role === 'judge' && u.active !== false),
    [state.staffUsers]
  );
  const activeEvents = useMemo(
    () => state.events.filter((e) => !e.cancelled).sort((a, b) => a.name.localeCompare(b.name)),
    [state.events]
  );
  const teamLabel = (k: string) => resolveDisplayName(state.general.teamDisplayNames, k, k);
  const catLabel = (k: string) => resolveDisplayName(state.general.categoryDisplayNames, k, k);
  const rules = useMemo(() => normalizeScoringRules(state.scoringRules), [state.scoringRules]);

  const participantOptionsForEvent = (event: FestEvent | undefined) => {
    if (!event) return [];
    const regs = state.registrations.filter((r) => r.eventId === event.id);
    if (event.type === 'Group') {
      return regs.map((r) => {
        const names = (r.studentIds || []).map((sid) => state.students.find((s) => s.id === sid)?.name).filter(Boolean);
        return {
          id: r.id,
          label: `${teamLabel(r.team)} · Slot #${r.slotIndex || 1} (${names.slice(0, 2).join(', ')})`,
        };
      });
    }
    const opts: Array<{ id: string; label: string }> = [];
    const seen = new Set<string>();
    regs.forEach((r) => {
      (r.studentIds || []).forEach((sid) => {
        if (seen.has(sid)) return;
        seen.add(sid);
        const st = state.students.find((s) => s.id === sid);
        if (st) {
          opts.push({ id: st.id, label: `${st.chestNo ? `#${st.chestNo} ` : ''}${st.name} (${teamLabel(st.team)})` });
        }
      });
    });
    if (!opts.length) {
      state.students
        .filter((s) => !event.category || event.category === 'General' || s.category === event.category)
        .forEach((st) => opts.push({ id: st.id, label: `${st.chestNo ? `#${st.chestNo} ` : ''}${st.name} (${teamLabel(st.team)})` }));
    }
    return opts;
  };

  // Judge Assignments
  const createAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const { db } = getFirebaseState();
    if (!db) return;
    const judge = judges.find((j) => (j.authUid || j.id) === assignJudgeId);
    const ev = activeEvents.find((x) => x.id === assignEventId);
    if (!judge || !ev) return toast('Select both judge and event.', 'error');

    const jId = judge.authUid || judge.uid || judge.id;
    const existing = state.judgeAssignments.find((a) => a.judgeId === jId && a.eventId === ev.id && a.active !== false);
    if (existing) return toast('This judge is already assigned to that event.', 'warning');

    try {
      await addDoc(collection(db, 'judgeAssignments'), {
        judgeId: jId,
        judgeAuthId: jId,
        judgeAccessDocId: judge.id,
        judgeName: judge.displayName || judge.username,
        eventId: ev.id,
        eventName: ev.name,
        category: ev.category,
        gender: ev.gender,
        stage: ev.stage,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await actions.refreshScopes(['results'], true);
      toast(`Assigned ${judge.displayName || judge.username} to ${ev.name}.`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to assign judge.', 'error');
    }
  };

  const removeAssignment = async (a: JudgeAssignment) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const ok = await confirm(`Remove judge "${a.judgeName || a.judgeId}" from "${a.eventName || a.eventId}"?`, {
      title: 'Unassign Judge',
      okLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'judgeAssignments', a.id));
      await actions.refreshScopes(['results'], true);
      toast('Judge assignment removed.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Remove failed.', 'error');
    }
  };

  // Submitted Judge Sheets grouped by event
  const submittedByEvent = useMemo(() => {
    const groups = new Map<string, { event: FestEvent; sheets: JudgeScore[] }>();
    state.judgeScores
      .filter((s) => s.status === 'submitted')
      .forEach((sc) => {
        const ev = state.events.find((e) => e.id === sc.eventId);
        if (!ev) return;
        const g = groups.get(ev.id) || { event: ev, sheets: [] };
        g.sheets.push(sc);
        groups.set(ev.id, g);
      });
    return [...groups.values()];
  }, [state.judgeScores, state.events]);

  const reopenScoreSheet = async (sheet: JudgeScore) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const reason = await prompt({
      title: 'Reopen Judge Score Sheet',
      message: `Enter reason for reopening "${sheet.eventName}" for ${sheet.judgeName || 'judge'}:`,
      placeholder: 'e.g. Correct tie score entry',
      minLength: 5,
      okLabel: 'Reopen Sheet',
    });
    if (!reason) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'judgeScores', sheet.id), {
        status: 'draft',
        reopenReason: reason,
        reopenedAt: Date.now(),
        scoreVersion: Number(sheet.scoreVersion || 0) + 1,
      });
      batch.delete(doc(db, 'publicJudgingStatuses', sheet.assignmentId || sheet.id));
      batch.set(doc(collection(db, 'auditLogs')), {
        action: 'reopen_judge_score',
        eventId: sheet.eventId,
        judgeScoreId: sheet.id,
        reason,
        actorUid: state.profile.uid || state.profile.id,
        timestamp: Date.now(),
      });
      await batch.commit();
      await actions.refreshScopes(['results'], true);
      toast('Score sheet reopened as draft.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to reopen score sheet.', 'error');
    }
  };

  const publishOutcome = async (
    ev: FestEvent,
    places: ResultPlace[],
    gradeAwards: ResultGradeAward[],
    scoringSnapshot: Record<string, any>,
    sheetsToMark: JudgeScore[] = [],
    revisionReason = ''
  ) => {
    const { db, auth } = getFirebaseState();
    if (!db || !auth?.currentUser) return;
    const eventRegs = state.registrations.filter((r) => r.eventId === ev.id);
    const winnerDetails = resolveWinnerDetails(places, gradeAwards, {
      students: state.students,
      registrations: eventRegs,
      event: ev,
    });

    const existingResult = state.results.find((r) => (r.eventId || r.id) === ev.id);
    const now = Date.now();
    const uid = auth.currentUser.uid;
    let baseResult: Record<string, any> = {
      eventId: ev.id,
      eventName: ev.name,
      category: ev.category,
      stage: ev.stage,
      gender: ev.gender,
      type: ev.type,
      places,
      gradeAwards,
      winnerDetails,
      scoringSnapshot,
      status: 'published',
      publishedAt: existingResult?.publishedAt || now,
      updatedAt: now,
      publishedByUid: uid,
      updatedBy: state.profile.username,
    };

    if (existingResult) {
      baseResult = createResultRevision(existingResult, baseResult, {
        actorUid: uid,
        reason: revisionReason || 'Updated published competition result',
        timestamp: now,
      });
    }

    const batch = writeBatch(db);
    batch.set(doc(db, 'results', ev.id), baseResult);
    if (existingResult) {
      batch.set(doc(collection(db, 'resultRevisions')), {
        eventId: ev.id,
        revision: baseResult.revision,
        reason: baseResult.revisionReason,
        previousRevision: baseResult.previousRevision,
        actorUid: uid,
        createdAt: now,
      });
    }
    sheetsToMark.forEach((sc) => {
      batch.update(doc(db, 'judgeScores', sc.id), {
        publishStatus: 'published',
        publishedResultId: ev.id,
        publishedAt: now,
      });
    });

    // Write teamScoreLedgers doc
    const eventLedgerPoints: Record<string, number> = {};
    places.forEach((p) => {
      p.winners.forEach((wId) => {
        const tm = winnerDetails[wId]?.team;
        if (tm && tm !== '-') eventLedgerPoints[tm] = (eventLedgerPoints[tm] || 0) + Number(p.earnedValue ?? p.value ?? 0);
      });
    });
    batch.set(doc(db, 'teamScoreLedgers', ev.id), {
      eventId: ev.id,
      eventName: ev.name,
      teamPoints: eventLedgerPoints,
      updatedAt: now,
    });
    batch.set(doc(collection(db, 'auditLogs')), {
      action: existingResult ? 'revise_published_result' : 'publish_result',
      eventId: ev.id,
      eventName: ev.name,
      actorUid: uid,
      timestamp: now,
    });

    await batch.commit();
    const updatedResults = [
      ...state.results.filter((r) => (r.eventId || r.id) !== ev.id),
      { id: ev.id, ...(baseResult as any) },
    ];
    await actions.syncSummary(state.students.length, updatedResults);
    await actions.refreshScopes(['results'], true);
  };

  const approveAndPublishSheets = async (ev: FestEvent, sheets: JudgeScore[]) => {
    setPublishing(true);
    try {
      const outcome =
        sheets.length === 1 && sheets[0].marks?.some((m) => m.position || m.grade)
          ? judgeScoreToResult(sheets[0], ev, rules)
          : calculateEventOutcome({ scoreSheets: sheets, event: ev, rules });

      const existing = state.results.find((r) => (r.eventId || r.id) === ev.id);
      let reason = '';
      if (existing) {
        const entered = await prompt({
          title: 'Revision Reason Required',
          message: `"${ev.name}" already has a published result. Provide reason for publishing a revision:`,
          minLength: 5,
          okLabel: 'Publish Revision',
        });
        if (!entered) {
          setPublishing(false);
          return;
        }
        reason = entered;
      }

      await publishOutcome(ev, outcome.places, outcome.gradeAwards, outcome.scoringSnapshot, sheets, reason);
      toast(`Published results for "${ev.name}".`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to publish sheets.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  // Direct Entry handling
  const selectedDirectEvent = useMemo(
    () => activeEvents.find((e) => e.id === directEventId) || null,
    [activeEvents, directEventId]
  );
  const directOptions = useMemo(
    () => (selectedDirectEvent ? participantOptionsForEvent(selectedDirectEvent) : []),
    [selectedDirectEvent, state.registrations, state.students]
  );
  const resolvedDirectScoring = useMemo(
    () => (selectedDirectEvent ? resolveEventScoring(rules, selectedDirectEvent) : null),
    [rules, selectedDirectEvent]
  );

  const loadExistingIntoDirect = (r: ResultDoc) => {
    const eid = r.eventId || r.id;
    setDirectEventId(eid);
    const nextPicks: Record<number, string[]> = { 1: [], 2: [], 3: [] };
    (r.places || []).forEach((p) => {
      const ids = (p.winners || []).map((w: any) => (typeof w === 'object' ? w.id : String(w)));
      nextPicks[p.rank] = ids;
    });
    const nextGrades: Array<{ gradeLabel: string; participantId: string }> = [];
    (r.gradeAwards || []).forEach((g) => {
      (g.winners || []).forEach((w: any) => {
        const id = typeof w === 'object' ? w.id : String(w);
        nextGrades.push({ gradeLabel: g.label, participantId: id });
      });
    });
    setPlacePicks(nextPicks);
    setGradeRows(nextGrades);
    setSubtab('direct');
  };

  const submitDirectResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDirectEvent || !resolvedDirectScoring) return toast('Select an event.', 'error');

    const places: ResultPlace[] = (resolvedDirectScoring.config.points || [])
      .map((pt: any, idx: number) => {
        const rank = idx + 1;
        const winners = (placePicks[rank] || []).filter(Boolean);
        if (!winners.length) return null;
        return {
          key: pt.key || `place_${rank}`,
          rank,
          label: pt.label,
          value: Number(pt.value || 0),
          earnedValue:
            pt.tiePolicy === 'shared' ? Number((Number(pt.value || 0) / winners.length).toFixed(2)) : Number(pt.value || 0),
          tiePolicy: pt.tiePolicy || 'full',
          winners,
        };
      })
      .filter(Boolean) as ResultPlace[];

    const gradeAwards: ResultGradeAward[] = (resolvedDirectScoring.config.grades || [])
      .map((gr: any) => {
        const winners = gradeRows
          .filter((row) => row.gradeLabel === gr.label && row.participantId)
          .map((row) => row.participantId);
        return winners.length
          ? {
              key: gr.key,
              label: gr.label,
              minimumPercentage: gr.minimumPercentage ?? null,
              value: Number(gr.value || 0),
              winners,
            }
          : null;
      })
      .filter(Boolean) as ResultGradeAward[];

    if (!places.length && !gradeAwards.length) {
      return toast('Select at least one winner or grade award.', 'warning');
    }

    const existing = state.results.find((r) => (r.eventId || r.id) === selectedDirectEvent.id);
    let reason = '';
    if (existing) {
      const entered = await prompt({
        title: 'Revision Reason Required',
        message: `"${selectedDirectEvent.name}" is already published. Enter revision reason:`,
        minLength: 5,
        okLabel: 'Publish Revision',
      });
      if (!entered) return;
      reason = entered;
    }

    setPublishing(true);
    try {
      await publishOutcome(
        selectedDirectEvent,
        places,
        gradeAwards,
        createScoringSnapshot(rules, selectedDirectEvent),
        [],
        reason
      );
      toast(`Published results for "${selectedDirectEvent.name}".`, 'success');
      setSubtab('published');
    } catch (err: any) {
      toast(err?.message || 'Unable to publish result.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const deletePublishedResult = async (r: ResultDoc) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const ok = await confirm(`Delete published result for "${r.eventName || r.id}"?`, {
      title: 'Delete Result',
      okLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'results', r.id));
      await deleteDoc(doc(db, 'teamScoreLedgers', r.eventId || r.id)).catch(() => {});
      const remaining = state.results.filter((x) => x.id !== r.id);
      await actions.syncSummary(state.students.length, remaining);
      await actions.refreshScopes(['results'], true);
      toast('Result deleted.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Delete failed.', 'error');
    }
  };

  const publishedRows = useMemo(
    () =>
      state.results
        .map((r) => normalizeResultData(r, { events: state.events, students: state.students, registrations: state.registrations }))
        .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0)),
    [state.results, state.events, state.students, state.registrations]
  );

  const publishedCols: TableColumn<ResultDoc>[] = [
    {
      key: 'event',
      header: 'Competition',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{r.eventName || r.eventId}</p>
          <p className="text-[11px] text-slate-500">
            {catLabel(r.category || '')} · {r.stage} · Rev #{r.revision || 1}
          </p>
        </div>
      ),
    },
    {
      key: 'winners',
      header: 'Podium Winners',
      render: (r) => (
        <div className="space-y-0.5 text-xs">
          {r.places.slice(0, 3).map((p) => (
            <p key={p.key} className="truncate max-w-md text-slate-700 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-white">{p.label}:</strong>{' '}
              {p.winners.map((w: any) => `${w.name} (${teamLabel(w.team)})`).join(', ')}
            </p>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionIconButton
            icon={Pencil}
            label="Revise result in Direct Entry"
            tone="primary"
            onClick={() => loadExistingIntoDirect(r)}
          />
          <ActionIconButton
            icon={Trash2}
            label="Delete published result"
            tone="danger"
            onClick={() => deletePublishedResult(r)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Results &amp; Judging</h1>
          <p className="text-xs text-slate-500">
            Assign judges, review submitted evaluation sheets, enter direct results, and publish leaderboard updates.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'published', label: `Published (${publishedRows.length})` },
            { id: 'sheets', label: `Judge Sheets (${submittedByEvent.length})` },
            { id: 'direct', label: 'Direct Entry' },
            { id: 'assign', label: `Judge Assignments (${state.judgeAssignments.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubtab(t.id as any)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                subtab === t.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subtab === 'published' && (
        <CompactDataTable
          rows={publishedRows}
          columns={publishedCols}
          rowKey={(r) => r.id}
          defaultPageSize={25}
          pageSizeOptions={[25, 50, 100]}
          itemLabel="published results"
        />
      )}

      {subtab === 'sheets' && (
        <div className="space-y-4">
          {submittedByEvent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">
              No submitted judge score sheets awaiting review.
            </div>
          ) : (
            submittedByEvent.map(({ event, sheets }) => (
              <div
                key={event.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                      {event.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {catLabel(event.category)} · {event.stage} · {sheets.length} judge sheet(s) submitted
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={() => approveAndPublishSheets(event, sheets)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Approve &amp; Publish</span>
                  </button>
                </div>

                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {sheets.map((sc) => (
                    <div key={sc.id} className="flex items-center justify-between py-2 text-xs">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          Judge: {sc.judgeName || sc.judgeId}
                        </span>
                        <span className="ml-2 text-slate-500">· {sc.marks.length} participants scored</span>
                      </div>
                      <ActionIconButton
                        icon={RotateCcw}
                        label="Reopen sheet as draft"
                        tone="warning"
                        onClick={() => reopenScoreSheet(sc)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {subtab === 'direct' && (
        <form
          onSubmit={submitDirectResult}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold">Select Competition Event</label>
            <select
              value={directEventId}
              onChange={(e) => {
                setDirectEventId(e.target.value);
                setPlacePicks({ 1: [''], 2: [''], 3: [''] });
                setGradeRows([]);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">-- Choose Event --</option>
              {activeEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({catLabel(e.category)} · {e.gender} · {e.type})
                </option>
              ))}
            </select>
          </div>

          {selectedDirectEvent && resolvedDirectScoring && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {(resolvedDirectScoring.config.points || []).map((pt: any, idx: number) => {
                  const rank = idx + 1;
                  const picks = placePicks[rank] || [''];
                  return (
                    <div key={pt.key} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <div className="mb-2 flex items-center justify-between text-xs font-bold">
                        <span>
                          {pt.label} (+{pt.value} pts)
                        </span>
                        <ActionIconButton
                          icon={Plus}
                          label={`Add tied winner for ${pt.label}`}
                          onClick={() => setPlacePicks({ ...placePicks, [rank]: [...picks, ''] })}
                        />
                      </div>
                      <div className="space-y-2">
                        {picks.map((val, wIdx) => (
                          <select
                            key={wIdx}
                            value={val}
                            onChange={(e) => {
                              const next = [...picks];
                              next[wIdx] = e.target.value;
                              setPlacePicks({ ...placePicks, [rank]: next });
                            }}
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                          >
                            <option value="">-- None --</option>
                            {directOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {resolvedDirectScoring.enabled.grades && (
                <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Additive Grade Awards
                    </span>
                    <ActionIconButton
                      icon={Plus}
                      label="Add grade award row"
                      onClick={() =>
                        setGradeRows((prev) => [
                          ...prev,
                          {
                            gradeLabel: resolvedDirectScoring.config.grades?.[0]?.label || 'A Grade',
                            participantId: '',
                          },
                        ])
                      }
                    />
                  </div>
                  {gradeRows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={row.gradeLabel}
                        onChange={(e) =>
                          setGradeRows((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, gradeLabel: e.target.value } : x))
                          )
                        }
                        className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      >
                        {(resolvedDirectScoring.config.grades || []).map((gr: any) => (
                          <option key={gr.key} value={gr.label}>
                            {gr.label} (+{gr.value})
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.participantId}
                        onChange={(e) =>
                          setGradeRows((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, participantId: e.target.value } : x))
                          )
                        }
                        className="flex-1 rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      >
                        <option value="">-- Choose Participant --</option>
                        {directOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ActionIconButton
                        icon={Trash2}
                        label="Remove grade row"
                        tone="danger"
                        onClick={() => setGradeRows((prev) => prev.filter((_, i) => i !== idx))}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={publishing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{publishing ? 'Publishing…' : 'Publish Result'}</span>
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {subtab === 'assign' && (
        <div className="space-y-4">
          <form
            onSubmit={createAssignment}
            className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <select
              value={assignJudgeId}
              onChange={(e) => setAssignJudgeId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">-- Select Active Judge --</option>
              {judges.map((j) => (
                <option key={j.id} value={j.authUid || j.id}>
                  {j.displayName || j.username} ({j.username})
                </option>
              ))}
            </select>
            <select
              value={assignEventId}
              onChange={(e) => setAssignEventId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">-- Select Competition --</option>
              {activeEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({catLabel(e.category)} · {e.gender})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Assign Judge</span>
            </button>
          </form>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {state.judgeAssignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {a.eventName || a.eventId}
                  </p>
                  <p className="text-[11px] text-slate-500">Judge: {a.judgeName || a.judgeId}</p>
                </div>
                <ActionIconButton
                  icon={Trash2}
                  label="Remove judge assignment"
                  tone="danger"
                  onClick={() => removeAssignment(a)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
