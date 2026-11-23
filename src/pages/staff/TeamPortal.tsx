import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  Check,
  ClipboardList,
  Eye,
  FileBarChart2,
  LayoutDashboard,
  Megaphone,
  Printer,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { WorkspaceShell, type WorkspaceNavItem } from '../../components/layout/WorkspaceShell';
import { ActionIconButton } from '../../components/ui/ActionIconButton';
import { CompactDataTable, type TableColumn } from '../../components/ui/CompactDataTable';
import { useDialog } from '../../components/ui/DialogContext';
import { Modal } from '../../components/ui/Modal';
import { cachedGetDoc, cachedGetDocs, invalidateCache } from '../../lib/dataCache';
import { normalizeFestSetup, teamColor } from '../../lib/festConfig';
import { getFirebaseState } from '../../lib/firebase';
import {
  normalizeRegistrationConfig,
  normalizeTeamRegistrationPolicy,
  participationLimitDecision,
  participationUsage,
} from '../../lib/registrationUtils';
import { formatTime12h, normalizeResultData, printPage, resolveDisplayName } from '../../lib/resultUtils';
import { resolveAuthenticatedProfile, routeForRole, signOutStaff } from '../../lib/staffAuth';
import type {
  AccessUser,
  FestEvent,
  GeneralConfig,
  Notice,
  Registration,
  RegistrationMode,
  RegistrationRequest,
  ResultDoc,
  ScheduleBreak,
  Student,
} from '../../types/festival';

export const TeamPortal: React.FC = () => {
  const navigate = useNavigate();
  const { toast, confirm } = useDialog();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profile, setProfile] = useState<AccessUser | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  const [general, setGeneral] = useState<GeneralConfig>({});
  const [regConfig, setRegConfig] = useState<Record<string, any>>({});
  const [scheduleConfig, setScheduleConfig] = useState<Record<string, any>>({});
  const [teamPolicy, setTeamPolicy] = useState<Record<string, any>>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<FestEvent[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [breaks, setBreaks] = useState<ScheduleBreak[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [results, setResults] = useState<ResultDoc[]>([]);

  // Filters
  const [reqFilter, setReqFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [eventSearch, setEventSearch] = useState('');
  const [eventCatFilter, setEventCatFilter] = useState('All');
  const [eventStageFilter, setEventStageFilter] = useState('All');
  const [bwPrint, setBwPrint] = useState(false);

  // Modals
  const [inspectReq, setInspectReq] = useState<RegistrationRequest | null>(null);
  const [manageEvent, setManageEvent] = useState<FestEvent | null>(null);
  const [slotDrafts, setSlotDrafts] = useState<Record<number, string[]>>({});
  const [savingSlots, setSavingSlots] = useState(false);
  const [scheduleEventModal, setScheduleEventModal] = useState<FestEvent | null>(null);

  const loadTeamData = useCallback(
    async (userProfile: AccessUser, forceRefresh = false) => {
      const { db } = getFirebaseState();
      if (!db || !userProfile.team) return;
      setLoading(true);
      const teamId = userProfile.team;
      try {
        if (forceRefresh) invalidateCache();
        const [
          genDoc,
          regCfgDoc,
          schedCfgDoc,
          policyDoc,
          teamStudents,
          allEvents,
          teamRegs,
          teamReqs,
          allBreaks,
          teamNotices,
          pubResults,
        ] = await Promise.all([
          cachedGetDoc<GeneralConfig>(db, 'settings', 'general', { forceRefresh }),
          cachedGetDoc<Record<string, any>>(db, 'settings', 'registration_config', { forceRefresh }),
          cachedGetDoc<Record<string, any>>(db, 'settings', 'schedule_config', { forceRefresh }),
          cachedGetDoc<Record<string, any>>(db, 'teamRegistrationPolicies', teamId, { forceRefresh }),
          cachedGetDocs<Student>(
            `team:${teamId}:students`,
            query(collection(db, 'students'), where('team', '==', teamId)),
            { forceRefresh }
          ),
          cachedGetDocs<FestEvent>('events:all', collection(db, 'events'), { forceRefresh }),
          cachedGetDocs<Registration>(
            `team:${teamId}:registrations`,
            query(collection(db, 'registrations'), where('team', '==', teamId)),
            { forceRefresh }
          ),
          cachedGetDocs<RegistrationRequest>(
            `team:${teamId}:requests`,
            query(collection(db, 'registrationRequests'), where('team', '==', teamId)),
            { forceRefresh }
          ),
          cachedGetDocs<ScheduleBreak>('scheduleBreaks:all', collection(db, 'scheduleBreaks'), { forceRefresh }),
          cachedGetDocs<Notice>(
            `team:${teamId}:notices`,
            query(collection(db, 'notifications'), where('team', 'in', ['All', teamId])),
            { forceRefresh }
          ),
          cachedGetDocs<ResultDoc>(
            'results:published',
            query(collection(db, 'results'), where('status', '==', 'published')),
            { forceRefresh }
          ),
        ]);

        setGeneral(genDoc || {});
        setRegConfig(normalizeRegistrationConfig(regCfgDoc || {}));
        setScheduleConfig(schedCfgDoc || {});
        setTeamPolicy(normalizeTeamRegistrationPolicy(policyDoc || {}));
        setStudents(teamStudents.sort((a, b) => a.name.localeCompare(b.name)));
        setEvents(allEvents.filter((e) => !e.cancelled).sort((a, b) => a.name.localeCompare(b.name)));
        setRegistrations(teamRegs);
        setRequests(
          teamReqs.sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0))
        );
        setBreaks(allBreaks.filter((b) => b.active !== false));
        setNotices(teamNotices.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)));
        setResults(pubResults);
      } catch (err: any) {
        toast(err?.message || 'Failed to load team workspace data.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    document.title = 'Team Leader Portal — Feastport';
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
      if (p.role !== 'teamLeader' || !p.team) {
        navigate(routeForRole(p.role), { replace: true });
        return;
      }
      setProfile(p);
      setCheckingAuth(false);
      loadTeamData(p);
    });
    return () => unsub();
  }, [navigate, loadTeamData]);

  const teamId = profile?.team || '';
  const genderScope = (profile?.genderScope || 'Both') as 'Boys' | 'Girls' | 'Both';
  const teamLabel = resolveDisplayName(general.teamDisplayNames, teamId, teamId || 'Team');
  const accentColor = teamColor(teamId, general.teamColors);
  const categories = useMemo(() => general.categories || [], [general.categories]);
  const catName = (k: unknown) => resolveDisplayName(general.categoryDisplayNames, k, 'General');

  const registrationLockAt = Number(scheduleConfig.registrationLockAt || 0);
  const registrationLocked = Boolean(registrationLockAt && Date.now() >= registrationLockAt);

  // Scoped students and events based on leader genderScope
  const scopedStudents = useMemo(() => {
    if (genderScope === 'Both') return students;
    return students.filter((s) => s.gender === genderScope);
  }, [students, genderScope]);

  const scopedEvents = useMemo(() => {
    return events.filter((ev) => {
      if (genderScope === 'Both') return true;
      return !ev.gender || ev.gender === 'Both' || ev.gender === 'Mixed' || ev.gender === genderScope;
    });
  }, [events, genderScope]);

  const regsByEvent = useMemo(() => {
    const map = new Map<string, Registration[]>();
    for (const r of registrations) {
      const list = map.get(r.eventId) || [];
      list.push(r);
      map.set(r.eventId, list);
    }
    return map;
  }, [registrations]);

  const studentEventMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of registrations) {
      for (const sid of r.studentIds || []) {
        const list = map.get(sid) || [];
        if (!list.includes(r.eventId)) list.push(r.eventId);
        map.set(sid, list);
      }
    }
    return map;
  }, [registrations]);

  const pendingRequestsCount = useMemo(
    () => requests.filter((r) => ['pending', 'applied', 'under_review', 'waitlisted'].includes(r.status)).length,
    [requests]
  );

  // Update team registration policy
  const updateTeamPolicy = async (mode: RegistrationMode, studentApplicationsEnabled: boolean) => {
    const { db, auth } = getFirebaseState();
    if (!db || !auth?.currentUser || !teamId) return;
    try {
      const payload = {
        team: teamId,
        mode,
        studentApplicationsEnabled,
        changedByUid: auth.currentUser.uid,
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'teamRegistrationPolicies', teamId), payload, { merge: true });
      setTeamPolicy((prev) => ({ ...prev, ...payload }));
      invalidateCache(`doc:teamRegistrationPolicies/${teamId}`);
      toast('Team registration policy saved.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to update policy.', 'error');
    }
  };

  // Request review actions
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (reqFilter === 'pending') return ['pending', 'applied', 'under_review', 'waitlisted'].includes(r.status);
      if (reqFilter === 'approved') return ['approved', 'selected', 'finalized'].includes(r.status);
      if (reqFilter === 'rejected') return ['rejected', 'not_selected'].includes(r.status);
      return true;
    });
  }, [requests, reqFilter]);

  const handleRequestDecision = async (req: RegistrationRequest, decision: 'approved' | 'rejected') => {
    const { db, auth } = getFirebaseState();
    if (!db || !auth?.currentUser || !profile) return;
    if (registrationLocked) {
      toast('Registrations are locked by schedule deadline.', 'error');
      return;
    }
    const uid = auth.currentUser.uid;
    try {
      if (decision === 'approved') {
        const student = students.find((s) => s.id === req.relatedStudentId);
        if (!student) {
          toast('Matching student record not found in this team.', 'error');
          return;
        }
        const existingEventIds = studentEventMap.get(student.id) || [];
        let usage = participationUsage(existingEventIds, events, regConfig);

        for (const evId of req.eventIds || []) {
          const ev = events.find((e) => e.id === evId);
          if (!ev) continue;
          if (existingEventIds.includes(evId)) continue;
          const limitCheck = participationLimitDecision(regConfig, ev, usage);
          if (!limitCheck.allowed) {
            toast(`${student.name} exceeded participation limit for ${ev.name}.`, 'warning');
            return;
          }
          const evRegs = regsByEvent.get(evId) || [];
          const maxSlots = Math.max(1, Number(ev.limit || 1));
          const maxMembers = ev.type === 'Group' ? Math.max(1, Number(ev.maximumMembers || ev.groupSize || 1)) : 1;

          // Find an open slot or next slot index
          let targetReg = evRegs.find((r) => (r.studentIds || []).length < maxMembers);
          if (!targetReg && evRegs.length >= maxSlots) {
            toast(`All ${maxSlots} team slot(s) for ${ev.name} are already full.`, 'warning');
            return;
          }
          const now = Date.now();
          if (targetReg) {
            const nextIds = [...new Set([...(targetReg.studentIds || []), student.id])];
            await updateDoc(doc(db, 'registrations', targetReg.id), {
              studentIds: nextIds,
              lastUpdatedByUid: uid,
              lastUpdatedAt: now,
              createdByUid: targetReg.createdByUid || uid,
              createdAt: targetReg.createdAt || now,
              managedGender: targetReg.managedGender || genderScope,
            });
          } else {
            const usedSlotIndexes = new Set(evRegs.map((r) => Number(r.slotIndex || 1)));
            let slotIndex = 1;
            while (usedSlotIndexes.has(slotIndex)) slotIndex += 1;
            await addDoc(collection(db, 'registrations'), {
              eventId: ev.id,
              eventName: ev.name,
              team: teamId,
              slotIndex,
              studentIds: [student.id],
              participantIds: [],
              managedGender: genderScope,
              createdByUid: uid,
              lastUpdatedByUid: uid,
              createdAt: now,
              lastUpdatedAt: now,
            });
          }
          usage = participationUsage([...existingEventIds, evId], events, regConfig);
        }
      }

      const now = Date.now();
      await updateDoc(doc(db, 'registrationRequests', req.id), {
        status: decision,
        decisionByUid: uid,
        decisionByName: profile.displayName || profile.username,
        decisionByRole: 'teamLeader',
        decisionByUsername: profile.username,
        decisionAt: now,
        reviewedAt: now,
      });
      toast(`Request ${decision === 'approved' ? 'approved and registered' : 'rejected'}.`, 'success');
      if (inspectReq?.id === req.id) setInspectReq(null);
      await loadTeamData(profile, true);
    } catch (err: any) {
      toast(err?.message || 'Failed to save request decision.', 'error');
    }
  };

  // Open manage slots modal
  const openManageSlots = (ev: FestEvent) => {
    const evRegs = regsByEvent.get(ev.id) || [];
    const maxSlots = Math.max(1, Number(ev.limit || 1));
    const drafts: Record<number, string[]> = {};
    for (let s = 1; s <= maxSlots; s += 1) {
      const existing = evRegs.find((r) => Number(r.slotIndex || 1) === s);
      drafts[s] = existing?.studentIds ? [...existing.studentIds] : [];
    }
    setSlotDrafts(drafts);
    setManageEvent(ev);
  };

  const eligibleStudentsForManageEvent = useMemo(() => {
    if (!manageEvent) return [];
    return scopedStudents.filter((s) => {
      if (manageEvent.category && manageEvent.category !== 'General' && s.category !== manageEvent.category) {
        return false;
      }
      if (manageEvent.gender && !['Both', 'Mixed'].includes(manageEvent.gender) && s.gender !== manageEvent.gender) {
        return false;
      }
      if (manageEvent.eligibleClasses?.length) {
        const cls = String(s.details?.class || s.class || '').trim();
        if (!manageEvent.eligibleClasses.map(String).includes(cls)) return false;
      }
      return true;
    });
  }, [manageEvent, scopedStudents]);

  const toggleStudentInSlot = (slotIdx: number, studentId: string) => {
    if (!manageEvent) return;
    const maxMembers =
      manageEvent.type === 'Group' ? Math.max(1, Number(manageEvent.maximumMembers || manageEvent.groupSize || 1)) : 1;
    const current = slotDrafts[slotIdx] || [];
    const exists = current.includes(studentId);
    if (exists) {
      setSlotDrafts((prev) => ({ ...prev, [slotIdx]: current.filter((id) => id !== studentId) }));
      return;
    }
    // Check student isn't already in another slot of this same event
    for (const [k, list] of Object.entries(slotDrafts)) {
      if (Number(k) !== slotIdx && list.includes(studentId)) {
        toast('Student is already assigned to another slot in this event.', 'warning');
        return;
      }
    }
    if (current.length >= maxMembers) {
      toast(`Slot ${slotIdx} accepts maximum ${maxMembers} participant(s).`, 'warning');
      return;
    }
    // Check participation limits if student isn't already counted
    const existingIds = (studentEventMap.get(studentId) || []).filter((eid) => eid !== manageEvent.id);
    const usage = participationUsage(existingIds, events, regConfig);
    const limitDecision = participationLimitDecision(regConfig, manageEvent, usage);
    if (!limitDecision.allowed) {
      toast('Student reached maximum participation limit for this event type/stage.', 'warning');
      return;
    }
    setSlotDrafts((prev) => ({ ...prev, [slotIdx]: [...current, studentId] }));
  };

  const saveManageSlots = async () => {
    const { db, auth } = getFirebaseState();
    if (!db || !auth?.currentUser || !manageEvent || !profile) return;
    if (registrationLocked) {
      toast('Registrations are locked by deadline.', 'error');
      return;
    }
    setSavingSlots(true);
    const uid = auth.currentUser.uid;
    const now = Date.now();
    try {
      const existingRegs = regsByEvent.get(manageEvent.id) || [];
      for (const [slotStr, studentIds] of Object.entries(slotDrafts)) {
        const slotIndex = Number(slotStr);
        const existing = existingRegs.find((r) => Number(r.slotIndex || 1) === slotIndex);
        if (studentIds.length === 0) {
          if (existing) {
            await deleteDoc(doc(db, 'registrations', existing.id));
          }
        } else if (existing) {
          await updateDoc(doc(db, 'registrations', existing.id), {
            studentIds,
            participantIds: [],
            eventName: manageEvent.name,
            team: teamId,
            slotIndex,
            managedGender: existing.managedGender || genderScope,
            createdByUid: existing.createdByUid || uid,
            createdAt: existing.createdAt || now,
            lastUpdatedByUid: uid,
            lastUpdatedAt: now,
          });
        } else {
          await addDoc(collection(db, 'registrations'), {
            eventId: manageEvent.id,
            eventName: manageEvent.name,
            team: teamId,
            slotIndex,
            studentIds,
            participantIds: [],
            managedGender: genderScope,
            createdByUid: uid,
            lastUpdatedByUid: uid,
            createdAt: now,
            lastUpdatedAt: now,
          });
        }
      }
      toast(`Saved entries for ${manageEvent.name}.`, 'success');
      setManageEvent(null);
      await loadTeamData(profile, true);
    } catch (err: any) {
      toast(err?.message || 'Unable to save slot assignments.', 'error');
    } finally {
      setSavingSlots(false);
    }
  };

  const clearEventRegistrations = async (ev: FestEvent) => {
    const { db } = getFirebaseState();
    if (!db || !profile) return;
    const evRegs = regsByEvent.get(ev.id) || [];
    if (!evRegs.length) return;
    if (registrationLocked) {
      toast('Registrations are locked by deadline.', 'error');
      return;
    }
    const ok = await confirm(`Remove all ${teamLabel} entries from "${ev.name}"?`, {
      title: 'Clear Team Entries',
      okLabel: 'Remove All',
    });
    if (!ok) return;
    try {
      for (const r of evRegs) {
        await deleteDoc(doc(db, 'registrations', r.id));
      }
      toast(`Cleared entries for ${ev.name}.`, 'success');
      await loadTeamData(profile, true);
    } catch (err: any) {
      toast(err?.message || 'Failed to remove entries.', 'error');
    }
  };

  // Filtered events table
  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return scopedEvents.filter((ev) => {
      if (eventCatFilter !== 'All' && ev.category !== eventCatFilter) return false;
      if (eventStageFilter !== 'All' && ev.stage !== eventStageFilter) return false;
      if (q && !`${ev.name} ${ev.code || ''} ${ev.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scopedEvents, eventSearch, eventCatFilter, eventStageFilter]);

  // Scheduled events where team has entries
  const teamScheduledEvents = useMemo(() => {
    return scopedEvents
      .filter((ev) => (regsByEvent.get(ev.id) || []).some((r) => (r.studentIds || []).length > 0))
      .filter((ev) => ev.scheduleDate || ev.date || ev.time || ev.scheduleStage)
      .sort((a, b) => `${a.scheduleDate || a.date || ''} ${a.time || ''}`.localeCompare(`${b.scheduleDate || b.date || ''} ${b.time || ''}`));
  }, [scopedEvents, regsByEvent]);

  // Team published results
  const teamPublishedResults = useMemo(() => {
    return results
      .map((r) => normalizeResultData(r))
      .filter((r) => {
        const placeHasTeam = r.places.some((p) => p.winners.some((w: any) => w.team === teamId));
        const gradeHasTeam = (r.gradeAwards || []).some((g) => g.winners.some((w: any) => w.team === teamId));
        return placeHasTeam || gradeHasTeam;
      })
      .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0));
  }, [results, teamId]);

  const handleLogout = async () => {
    await signOutStaff();
    navigate('/login', { replace: true });
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-xs font-medium text-slate-500">
        Verifying team leader access…
      </div>
    );
  }

  const navItems: WorkspaceNavItem[] = [
    { id: 'overview', label: 'Overview & Policy', icon: LayoutDashboard },
    { id: 'requests', label: 'Student Requests', icon: ClipboardList, badge: pendingRequestsCount },
    { id: 'entries', label: 'Events & Entries', icon: Users },
    { id: 'schedule', label: 'Team Schedule', icon: CalendarClock },
    { id: 'reports', label: 'Reports & Results', icon: FileBarChart2 },
  ];

  const requestColumns: TableColumn<RegistrationRequest>[] = [
    {
      key: 'student',
      header: 'Student',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{r.name}</p>
          <p className="text-[11px] text-slate-500">
            {catName(r.category)} · {r.gender}
          </p>
        </div>
      ),
    },
    {
      key: 'events',
      header: 'Requested Events',
      render: (r) => {
        const names = (r.eventIds || [])
          .map((eid) => events.find((e) => e.id === eid)?.name || eid)
          .join(', ');
        return <span className="line-clamp-2 max-w-xs text-slate-700">{names || '—'}</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span
          className={`text-xs font-semibold capitalize ${
            r.status === 'approved' || r.status === 'finalized' || r.status === 'selected'
              ? 'text-emerald-700'
              : r.status === 'rejected' || r.status === 'not_selected'
              ? 'text-red-600'
              : 'text-amber-700'
          }`}
        >
          {r.status.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => {
        const isPending = ['pending', 'applied', 'under_review', 'waitlisted'].includes(r.status);
        return (
          <div className="flex items-center justify-end gap-1.5">
            <ActionIconButton icon={Eye} label="Inspect request" onClick={() => setInspectReq(r)} />
            {isPending && !registrationLocked && (
              <>
                <ActionIconButton
                  icon={Check}
                  label="Approve request"
                  tone="success"
                  onClick={() => handleRequestDecision(r, 'approved')}
                />
                <ActionIconButton
                  icon={X}
                  label="Reject request"
                  tone="danger"
                  onClick={() => handleRequestDecision(r, 'rejected')}
                />
              </>
            )}
          </div>
        );
      },
    },
  ];

  const eventColumns: TableColumn<FestEvent>[] = [
    {
      key: 'event',
      header: 'Event',
      render: (ev) => (
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{ev.name}</p>
          <p className="text-[11px] text-slate-500">
            {catName(ev.category)} · {ev.stage} · {ev.type} · {ev.gender}
          </p>
        </div>
      ),
    },
    {
      key: 'slots',
      header: 'Team Entries',
      render: (ev) => {
        const evRegs = regsByEvent.get(ev.id) || [];
        const maxSlots = Math.max(1, Number(ev.limit || 1));
        const filledSlots = evRegs.filter((r) => (r.studentIds || []).length > 0).length;
        const memberNames = evRegs
          .flatMap((r) => r.studentIds || [])
          .map((sid) => students.find((s) => s.id === sid)?.name)
          .filter(Boolean);
        return (
          <div>
            <p className="font-mono-num text-xs font-bold text-slate-900">
              {filledSlots} / {maxSlots} slot{maxSlots > 1 ? 's' : ''}
            </p>
            {memberNames.length > 0 && (
              <p className="mt-0.5 line-clamp-1 max-w-xs text-[11px] text-slate-500">{memberNames.join(', ')}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (ev) => {
        const hasEntries = (regsByEvent.get(ev.id) || []).length > 0;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <ActionIconButton
              icon={UserPlus}
              label="Manage team slots"
              tone="primary"
              onClick={() => openManageSlots(ev)}
            />
            {hasEntries && !registrationLocked && (
              <ActionIconButton
                icon={Trash2}
                label="Clear team entries"
                tone="danger"
                onClick={() => clearEventRegistrations(ev)}
              />
            )}
          </div>
        );
      },
    },
  ];

  const scheduleColumns: TableColumn<FestEvent>[] = [
    {
      key: 'when',
      header: 'Date & Time',
      render: (ev) => (
        <div className="font-mono-num text-xs">
          <p className="font-semibold text-slate-900">{ev.scheduleDate || ev.date || 'TBA'}</p>
          <p className="text-[11px] text-slate-500">{ev.time ? formatTime12h(ev.time) : 'TBD'}</p>
        </div>
      ),
    },
    {
      key: 'event',
      header: 'Event',
      render: (ev) => (
        <div>
          <p className="font-semibold text-slate-900">{ev.name}</p>
          <p className="text-[11px] text-slate-500">
            {catName(ev.category)} · {ev.scheduleStage || ev.stage}
          </p>
        </div>
      ),
    },
    {
      key: 'participants',
      header: 'Participants',
      align: 'right',
      render: (ev) => {
        const count = (regsByEvent.get(ev.id) || []).reduce((s, r) => s + (r.studentIds || []).length, 0);
        return (
          <div className="flex items-center justify-end gap-2">
            <span className="font-mono-num text-xs font-bold text-slate-700">{count}</span>
            <ActionIconButton
              icon={Users}
              label="View registered participants"
              onClick={() => setScheduleEventModal(ev)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <WorkspaceShell
      portalTitle={`${teamLabel} Portal`}
      portalSubtitle={`Team Leader · Scope: ${genderScope}`}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userLabel={profile?.displayName || profile?.username || 'Team Leader'}
      userSublabel={`${teamLabel} (${genderScope})`}
      onLogout={handleLogout}
      headerActions={
        <ActionIconButton
          icon={RefreshCw}
          label="Refresh team data"
          onClick={() => profile && loadTeamData(profile, true)}
        />
      }
    >
      {registrationLocked && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Registration editing is locked because the festival deadline has passed.</span>
        </div>
      )}

      {/* TAB: OVERVIEW & POLICY */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full" style={{ background: accentColor }} />
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">{teamLabel} Workspace</h1>
              <p className="text-xs text-slate-500">
                Manage student entries, review self-registration applications, and monitor official results.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Team Students</p>
              <p className="mt-1 font-mono-num text-2xl font-extrabold text-slate-900">{scopedStudents.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Event Slots Filled</p>
              <p className="mt-1 font-mono-num text-2xl font-extrabold text-slate-900">{registrations.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pending Requests</p>
              <p className="mt-1 font-mono-num text-2xl font-extrabold text-amber-700">{pendingRequestsCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Published Wins</p>
              <p className="mt-1 font-mono-num text-2xl font-extrabold text-emerald-700">
                {teamPublishedResults.length}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Team Policy */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-display text-base font-bold text-slate-900">Self-Registration Policy</h2>
              <p className="mt-1 text-xs text-slate-500">
                Control whether students from {teamLabel} can submit new self-registration applications.
              </p>
              <div className="mt-4 space-y-4">
                <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-semibold text-slate-800">
                  <span>Accept student applications for {teamLabel}</span>
                  <input
                    type="checkbox"
                    checked={teamPolicy.studentApplicationsEnabled !== false}
                    onChange={(e) => updateTeamPolicy(teamPolicy.mode || 'open', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                  />
                </label>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Slot Mode</label>
                  <select
                    value={teamPolicy.mode || 'open'}
                    onChange={(e) =>
                      updateTeamPolicy(
                        e.target.value as RegistrationMode,
                        teamPolicy.studentApplicationsEnabled !== false
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
                  >
                    <option value="open">Open (Accept all applications)</option>
                    <option value="unfilled_only">Unfilled Events Only</option>
                    <option value="waitlist_only">Waitlist Only when Full</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Official Notices */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-blue-700" />
                <h2 className="font-display text-base font-bold text-slate-900">Official Announcements</h2>
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {notices.length ? (
                  notices.slice(0, 6).map((n) => (
                    <div key={n.id} className="py-2.5">
                      <p className="text-xs font-bold text-slate-900">{n.title}</p>
                      <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-slate-400">No notices sent to {teamLabel}.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB: STUDENT REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">Student Registration Requests</h1>
              <p className="text-xs text-slate-500">Approve or reject applications submitted via Registration Portal.</p>
            </div>
            <div className="flex items-center gap-2">
              {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setReqFilter(status)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize ${
                    reqFilter === status
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <CompactDataTable
            rows={filteredRequests}
            columns={requestColumns}
            rowKey={(r) => r.id}
            loading={loading}
            itemLabel="requests"
            emptyTitle="No matching requests"
            emptyDescription="Requests matching the selected status filter will appear here."
          />
        </div>
      )}

      {/* TAB: EVENTS & ENTRIES */}
      {activeTab === 'entries' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">Events &amp; Slot Entries</h1>
              <p className="text-xs text-slate-500">Assign eligible {teamLabel} students into available event slots.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Search event…"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
              />
              <select
                value={eventCatFilter}
                onChange={(e) => setEventCatFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {catName(c)}
                  </option>
                ))}
                <option value="General">General</option>
              </select>
              <select
                value={eventStageFilter}
                onChange={(e) => setEventStageFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
              >
                <option value="All">All Stages</option>
                <option value="On-Stage">On-Stage</option>
                <option value="Off-Stage">Off-Stage</option>
              </select>
            </div>
          </div>

          <CompactDataTable
            rows={filteredEvents}
            columns={eventColumns}
            rowKey={(ev) => ev.id}
            loading={loading}
            itemLabel="events"
            emptyTitle="No events found"
            emptyDescription="Try clearing category or stage filters."
          />
        </div>
      )}

      {/* TAB: SCHEDULE */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">{teamLabel} Event Schedule</h1>
            <p className="text-xs text-slate-500">Confirmed scheduled events with {teamLabel} entries.</p>
          </div>
          <CompactDataTable
            rows={teamScheduledEvents}
            columns={scheduleColumns}
            rowKey={(ev) => ev.id}
            loading={loading}
            itemLabel="scheduled events"
            emptyTitle="No scheduled team events"
            emptyDescription="Events become visible here once scheduled and your team assigns entries."
          />
          {breaks.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Scheduled Breaks</h2>
              <div className="mt-2 divide-y divide-slate-100 text-xs">
                {breaks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2">
                    <span className="font-semibold text-slate-800">{b.title}</span>
                    <span className="font-mono-num text-slate-500">
                      {b.date} · {formatTime12h(b.startTime)} – {formatTime12h(b.endTime)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: REPORTS & RESULTS */}
      {activeTab === 'reports' && (
        <div className={`space-y-6 ${bwPrint ? 'print-bw-force' : ''}`}>
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">Participation Matrix &amp; Results</h1>
              <p className="text-xs text-slate-500">Print official {teamLabel} entry sheets or review published wins.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={bwPrint}
                  onChange={(e) => setBwPrint(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                B&amp;W Print
              </label>
              <button
                type="button"
                onClick={() => printPage('team-report')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Report</span>
              </button>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-bold text-slate-900">Student Participation Matrix</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-3">Chest No</th>
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2">Assigned Events</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scopedStudents.map((s) => {
                    const evNames = (studentEventMap.get(s.id) || [])
                      .map((eid) => events.find((e) => e.id === eid)?.name)
                      .filter(Boolean);
                    return (
                      <tr key={s.id}>
                        <td className="py-2 pr-3 font-mono-num font-bold text-slate-700">{s.chestNo || '—'}</td>
                        <td className="py-2 pr-3 font-semibold text-slate-900">{s.name}</td>
                        <td className="py-2 pr-3 text-slate-600">{catName(s.category)}</td>
                        <td className="py-2 text-slate-700">
                          {evNames.length ? evNames.join(', ') : <span className="text-slate-400">None</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-bold text-slate-900">{teamLabel} Published Results</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {teamPublishedResults.length ? (
                teamPublishedResults.map((r) => (
                  <div key={r.id} className="py-3">
                    <p className="font-semibold text-slate-900">
                      {r.eventName} · <span className="text-xs font-normal text-slate-500">{catName(r.category)}</span>
                    </p>
                    <div className="mt-1 space-y-1 text-xs text-slate-700">
                      {r.places
                        .filter((p) => p.winners.some((w: any) => w.team === teamId))
                        .map((p) => (
                          <p key={p.key}>
                            <strong>{p.label}:</strong>{' '}
                            {p.winners
                              .filter((w: any) => w.team === teamId)
                              .map((w: any) => w.name)
                              .join(', ')}
                          </p>
                        ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">No published results yet for {teamLabel}.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Inspect Request Modal */}
      <Modal
        open={Boolean(inspectReq)}
        onClose={() => setInspectReq(null)}
        title={inspectReq?.name || 'Application Details'}
        subtitle={inspectReq ? `${catName(inspectReq.category)} · ${inspectReq.gender}` : ''}
        footer={
          inspectReq && ['pending', 'applied', 'under_review', 'waitlisted'].includes(inspectReq.status) && !registrationLocked ? (
            <>
              <button
                type="button"
                onClick={() => handleRequestDecision(inspectReq, 'rejected')}
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => handleRequestDecision(inspectReq, 'approved')}
                className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Approve &amp; Assign
              </button>
            </>
          ) : undefined
        }
      >
        {inspectReq && (
          <div className="space-y-3 text-xs text-slate-700">
            <div>
              <p className="font-semibold text-slate-500">Requested Events</p>
              <ul className="mt-1 list-disc pl-4">
                {(inspectReq.eventIds || []).map((eid) => (
                  <li key={eid}>{events.find((e) => e.id === eid)?.name || eid}</li>
                ))}
              </ul>
            </div>
            {inspectReq.note && (
              <div>
                <p className="font-semibold text-slate-500">Applicant Note</p>
                <p className="mt-1 rounded-lg bg-slate-50 p-2.5">{inspectReq.note}</p>
              </div>
            )}
            {inspectReq.youtubeUrl && (
              <div>
                <p className="font-semibold text-slate-500">YouTube Link</p>
                <p className="mt-0.5 break-all text-blue-700">{inspectReq.youtubeUrl}</p>
              </div>
            )}
            {inspectReq.referenceUrl && (
              <div>
                <p className="font-semibold text-slate-500">Reference URL</p>
                <p className="mt-0.5 break-all text-blue-700">{inspectReq.referenceUrl}</p>
              </div>
            )}
            {Array.isArray(inspectReq.images) && inspectReq.images[0]?.data && (
              <div>
                <p className="font-semibold text-slate-500">Attachment</p>
                <img
                  src={inspectReq.images[0].data}
                  alt="Attachment"
                  className="mt-1.5 max-h-56 rounded-lg border border-slate-200 object-contain"
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Manage Slots Modal */}
      <Modal
        open={Boolean(manageEvent)}
        onClose={() => setManageEvent(null)}
        title={manageEvent ? `Manage Slots — ${manageEvent.name}` : 'Manage Slots'}
        subtitle={
          manageEvent
            ? `${catName(manageEvent.category)} · ${manageEvent.type} · ${manageEvent.gender} · Max ${Math.max(1, Number(manageEvent.limit || 1))} slot(s)`
            : ''
        }
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setManageEvent(null)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingSlots || registrationLocked}
              onClick={saveManageSlots}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {savingSlots ? 'Saving…' : 'Save Entries'}
            </button>
          </>
        }
      >
        {manageEvent && (
          <div className="space-y-4">
            {Object.keys(slotDrafts).map((slotKey) => {
              const slotIdx = Number(slotKey);
              const selected = slotDrafts[slotIdx] || [];
              const maxMembers =
                manageEvent.type === 'Group'
                  ? Math.max(1, Number(manageEvent.maximumMembers || manageEvent.groupSize || 1))
                  : 1;
              return (
                <div key={slotIdx} className="rounded-xl border border-slate-200 p-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900">
                      Slot #{slotIdx} ({selected.length}/{maxMembers} selected)
                    </h4>
                  </div>
                  <div className="mt-2.5 grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2">
                    {eligibleStudentsForManageEvent.map((st) => {
                      const checked = selected.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                            checked ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={registrationLocked}
                            checked={checked}
                            onChange={() => toggleStudentInSlot(slotIdx, st.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300"
                          />
                          <span className="truncate font-medium">{st.name}</span>
                          {st.chestNo && (
                            <span className="ml-auto font-mono-num text-[11px] text-slate-500">{st.chestNo}</span>
                          )}
                        </label>
                      );
                    })}
                    {eligibleStudentsForManageEvent.length === 0 && (
                      <p className="col-span-2 py-4 text-center text-xs text-slate-400">
                        No eligible students found in {teamLabel}.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Schedule Participants Modal */}
      <Modal
        open={Boolean(scheduleEventModal)}
        onClose={() => setScheduleEventModal(null)}
        title={scheduleEventModal?.name || 'Event Participants'}
        subtitle={
          scheduleEventModal
            ? `${scheduleEventModal.scheduleDate || scheduleEventModal.date || 'TBA'} · ${formatTime12h(scheduleEventModal.time || '')}`
            : ''
        }
      >
        {scheduleEventModal && (
          <div className="divide-y divide-slate-100 text-xs">
            {(regsByEvent.get(scheduleEventModal.id) || []).map((reg) =>
              (reg.studentIds || []).map((sid) => {
                const st = students.find((x) => x.id === sid);
                return (
                  <div key={`${reg.id}-${sid}`} className="flex items-center justify-between py-2">
                    <span className="font-semibold text-slate-900">{st?.name || sid}</span>
                    <span className="font-mono-num text-slate-500">
                      {st?.chestNo ? `#${st.chestNo}` : `Slot ${reg.slotIndex || 1}`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </Modal>
    </WorkspaceShell>
  );
};
