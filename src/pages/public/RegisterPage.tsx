import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  IdCard,
  Info,
  LayoutDashboard,
  Lock,
  LogOut,
  Send,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { EditorialFooter, EditorialHeader } from '../../components/layout/EditorialShell';
import { ParticipantIdCard } from '../../components/ParticipantIdCard';
import { ActionIconButton } from '../../components/ui/ActionIconButton';
import { useDialog } from '../../components/ui/DialogContext';
import { Modal } from '../../components/ui/Modal';
import { brandingName, cacheBranding, clearBrandingCache, normalizeBranding, readCachedBranding } from '../../lib/branding';
import { cachedGetDoc, cachedGetDocs } from '../../lib/dataCache';
import { normalizeFestSetup } from '../../lib/festConfig';
import { getFirebaseState } from '../../lib/firebase';
import { buildVerificationUrl, formatChestNumber } from '../../lib/idCard';
import { compressImageFile } from '../../lib/imageUpload';
import {
  applicationDecision,
  capacityState,
  normalizeRegistrationConfig,
  normalizeTeamRegistrationPolicy,
  participantEligibleForEvent,
  participationLimitDecision,
  participationUsage,
  registrationWindowOpen,
} from '../../lib/registrationUtils';
import { resolveDisplayName } from '../../lib/resultUtils';
import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type {
  BrandingConfig,
  FestEvent,
  FestSetup,
  GeneralConfig,
  Student,
} from '../../types/festival';

const ACTIVE_STATUSES = new Set([
  'applied',
  'under_review',
  'waitlisted',
  'selected',
  'finalized',
  'pending',
  'approved',
]);

export const RegisterPage: React.FC = () => {
  const { toast } = useDialog();
  const [branding, setBranding] = useState<BrandingConfig>(() => readCachedBranding());
  const [general, setGeneral] = useState<GeneralConfig>({});
  const [setup, setSetup] = useState<FestSetup>(() => normalizeFestSetup());
  const [config, setConfig] = useState(() => normalizeRegistrationConfig({}));
  const [teamPolicy, setTeamPolicy] = useState(() => normalizeTeamRegistrationPolicy({}));

  const [session, setSession] = useState<any>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [events, setEvents] = useState<FestEvent[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>({});

  // Verification form state
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedGender, setSelectedGender] = useState('Boys');
  const [nameInput, setNameInput] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [identityError, setIdentityError] = useState('');

  // Chest modal
  const [chestModalOpen, setChestModalOpen] = useState(false);
  const [chestInput, setChestInput] = useState('');
  const [showChest, setShowChest] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Portal tabs & filters
  const [portalTab, setPortalTab] = useState<'dashboard' | 'events' | 'applications' | 'idcard'>('dashboard');
  const [eventListMode, setEventListMode] = useState<'eligible' | 'my'>('eligible');
  const [eventSearch, setEventSearch] = useState('');
  const [eventCat, setEventCat] = useState('');
  const [eventStage, setEventStage] = useState('');
  const [eventType, setEventType] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [appStageFilter, setAppStageFilter] = useState('');

  // Modals in portal
  const [infoEvent, setInfoEvent] = useState<FestEvent | null>(null);
  const [limitsModalOpen, setLimitsModalOpen] = useState(false);
  const [applyEvent, setApplyEvent] = useState<FestEvent | null>(null);
  const [applyNote, setApplyNote] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [applyImages, setApplyImages] = useState<Array<{ name: string; type: string; size: number; data: string }>>([]);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [photoUpdating, setPhotoUpdating] = useState(false);

  const searchTimerRef = useRef<any>(null);

  const catName = useCallback(
    (k: unknown) => resolveDisplayName(general.categoryDisplayNames, k, 'General'),
    [general.categoryDisplayNames]
  );
  const teamDisplayNames = general.teamDisplayNames || {};

  const loadPortalData = useCallback(
    async (profile: Student, activeSession: any) => {
      const { db, functions } = getFirebaseState();
      if (!db) return;

      let data: any;
      if (activeSession?.staticDb) {
        const [evRows, reqSnap, regSnap, cfgDoc, polSnap] = await Promise.all([
          cachedGetDocs<FestEvent>('col:events', collection(db, 'events'), { ttlMs: 120_000 }),
          getDocs(query(collection(db, 'registrationRequests'), where('relatedStudentId', '==', profile.id))),
          getDocs(query(collection(db, 'registrations'), where('team', '==', profile.team || ''))),
          cachedGetDoc(db, 'settings', 'registration_config', { ttlMs: 120_000 }),
          getDoc(doc(db, 'teamRegistrationPolicies', profile.team || '_')).catch(() => null),
        ]);
        const activeEvents = (evRows || []).filter((e) => e.status !== 'draft');
        const eventMap = Object.fromEntries(activeEvents.map((e) => [e.id, e]));
        const counts: Record<string, number> = {};
        regSnap.docs.forEach((d) => {
          const item = d.data() as any;
          counts[item.eventId] = (counts[item.eventId] || 0) + (item.studentIds || []).length;
        });
        const reqApps = reqSnap.docs.map((d) => {
          const row = d.data() as any;
          const eventId = (row.eventIds || [])[0] || '';
          const ev = eventMap[eventId] || {};
          return {
            id: d.id,
            eventId,
            eventName: ev.name || row.eventName || 'Event',
            status: row.status || 'pending',
            note: row.note || '',
            submittedAt: row.submittedAt || 0,
          };
        });
        const directApps = regSnap.docs
          .filter((d) => (d.data().studentIds || []).includes(profile.id))
          .map((d) => {
            const item = d.data() as any;
            const ev = eventMap[item.eventId] || {};
            return {
              id: `reg_${d.id}`,
              eventId: item.eventId,
              eventName: ev.name || item.eventName || 'Event',
              status: 'approved',
              submittedAt: item.createdAt || item.lastUpdatedAt || 0,
            };
          });
        data = {
          events: activeEvents,
          applications: [...reqApps, ...directApps],
          selectedCounts: counts,
          config: cfgDoc || {},
          teamPolicy: polSnap?.exists() ? polSnap.data() : {},
        };
      } else {
        const portalFn = httpsCallable(functions, 'studentRegistrationPortal');
        const res = await portalFn({ ...activeSession, action: 'list' });
        data = res.data;
      }

      const appMap = new Map();
      (data.applications || []).forEach((a: any) => {
        if (a.eventId && (!appMap.has(a.eventId) || a.status === 'approved')) appMap.set(a.eventId, a);
      });
      setEvents(data.events || []);
      setApplications([...appMap.values()]);
      setSelectedCounts(data.selectedCounts || {});
      setConfig(normalizeRegistrationConfig(data.config || {}));
      setTeamPolicy(normalizeTeamRegistrationPolicy(data.teamPolicy || {}));
    },
    []
  );

  useEffect(() => {
    let active = true;
    async function init() {
      const { db, isFirebaseConfigured } = getFirebaseState();
      if (!isFirebaseConfigured || !db) return;
      try {
        const [homeDoc, genDoc, regDoc] = await Promise.all([
          cachedGetDoc<BrandingConfig>(db, 'settings', 'home_config', { ttlMs: 300_000 }),
          cachedGetDoc<GeneralConfig>(db, 'settings', 'general', { ttlMs: 300_000 }),
          cachedGetDoc(db, 'settings', 'registration_config', { ttlMs: 120_000 }),
        ]);
        if (!active) return;
        if (homeDoc) setBranding(cacheBranding(homeDoc));
        else {
          clearBrandingCache();
          setBranding(normalizeBranding());
        }
        const gen: GeneralConfig = genDoc || {};
        setGeneral(gen);
        const normSetup = normalizeFestSetup(gen.festSetup || {});
        setSetup(normSetup);
        if (normSetup.allowedGenders?.length) setSelectedGender(normSetup.allowedGenders[0]);
        setConfig(normalizeRegistrationConfig(regDoc || {}));

        const saved = JSON.parse(sessionStorage.getItem('studentRegistrationSession') || 'null');
        if (saved && saved.expiresAt > Date.now() && saved.profile) {
          setSession(saved);
          setStudent(saved.profile);
          await loadPortalData(saved.profile, saved);
        }
      } catch (err) {
        console.warn('Registration init fallback:', err);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [loadPortalData]);

  useEffect(() => {
    document.title = `Student Registration — ${brandingName(branding)}`;
  }, [branding]);

  const portalLockedReason = useMemo(() => {
    if (!config.studentApplicationsEnabled) return 'Student self-registration is currently closed by the administrator.';
    if (!registrationWindowOpen(config)) return 'The registration submission window is closed.';
    if (teamPolicy.mode === 'closed' || !teamPolicy.studentApplicationsEnabled)
      return 'Your team leader has closed self-applications for this team.';
    return '';
  }, [config, teamPolicy]);

  const handleNameSearch = (val: string) => {
    setNameInput(val);
    setCandidateId('');
    setIdentityError('');
    clearTimeout(searchTimerRef.current);
    if (!selectedTeam) {
      setIdentityError('Please select your team first.');
      setShowSuggestions(false);
      return;
    }
    const qText = val.trim();
    if (qText.length < 3) {
      setShowSuggestions(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      const { db, functions, isFirebaseConfigured } = getFirebaseState();
      if (!isFirebaseConfigured || !db) return;
      try {
        let rows: Student[] = [];
        try {
          const searchFn = httpsCallable(functions, 'searchRegistrationCandidates');
          const res: any = await searchFn({
            participantType: 'student',
            team: selectedTeam,
            gender: selectedGender,
            query: qText,
          });
          rows = res.data?.candidates || [];
        } catch {
          const snap = await getDocs(query(collection(db, 'students'), where('team', '==', selectedTeam)));
          rows = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter(
              (s) =>
                (!selectedGender || (s.gender || 'Boys') === selectedGender) &&
                String(s.name || '')
                  .toLowerCase()
                  .includes(qText.toLowerCase())
            )
            .slice(0, 10);
        }
        setSuggestions(rows);
        setShowSuggestions(true);
      } catch (err: any) {
        setIdentityError(err?.message || 'Search failed');
      }
    }, 280);
  };

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { isFirebaseConfigured } = getFirebaseState();
    if (!isFirebaseConfigured) return setIdentityError('Firebase is not configured yet.');
    if (!candidateId) return setIdentityError('Select your name from the suggestions list.');
    setChestInput('');
    setVerifyError('');
    setChestModalOpen(true);
  };

  const handleVerifyChest = async (e: React.FormEvent) => {
    e.preventDefault();
    const { db } = getFirebaseState();
    if (!db || !candidateId) return;
    setVerifying(true);
    setVerifyError('');
    try {
      const snap = await getDoc(doc(db, 'students', candidateId));
      if (!snap.exists()) throw new Error('Student record not found.');
      const data = snap.data() as any;
      if (String(data.chestNo || '').trim().toUpperCase() !== String(chestInput || '').trim().toUpperCase()) {
        throw new Error('Chest number does not match.');
      }
      if (!data.team) throw new Error('This student is not assigned to any team.');
      const participant: Student = {
        id: snap.id,
        ...data,
        category: data.category || 'General',
        gender: data.gender || 'Boys',
      };
      const newSession = {
        sessionId: `static_${snap.id}`,
        token: 'static-db',
        expiresAt: Date.now() + Math.max(5, Number(config.verificationSessionMinutes || 30)) * 60000,
        staticDb: true,
        profile: participant,
      };
      sessionStorage.setItem('studentRegistrationSession', JSON.stringify(newSession));
      setSession(newSession);
      setStudent(participant);
      setChestModalOpen(false);
      await loadPortalData(participant, newSession);
    } catch (err: any) {
      setVerifyError(err?.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const usage = useMemo(
    () =>
      participationUsage(
        applications.filter((a) => ACTIVE_STATUSES.has(a.status || 'applied')).map((a) => a.eventId),
        events,
        config
      ),
    [applications, events, config]
  );

  const eligibleCategories = useMemo(() => {
    if (!student) return [];
    return [
      ...new Set(
        events.filter((e) => participantEligibleForEvent(student, e, setup, config)).map((e) => e.category).filter(Boolean)
      ),
    ];
  }, [events, student, setup, config]);

  const displayedEvents = useMemo(() => {
    if (!student) return [];
    const q = eventSearch.trim().toLowerCase();
    let list =
      eventListMode === 'my'
        ? events.filter((e) =>
            applications.some((a) => a.eventId === e.id && ['approved', 'selected', 'finalized'].includes(a.status))
          )
        : events.filter((e) => !e.cancelled && participantEligibleForEvent(student, e, setup, config));
    if (q) list = list.filter((e) => `${e.name} ${e.category} ${catName(e.category)} ${e.rules || ''}`.toLowerCase().includes(q));
    if (eventCat) list = list.filter((e) => e.category === eventCat);
    if (eventStage) list = list.filter((e) => e.stage === eventStage);
    if (eventType) list = list.filter((e) => e.type === eventType);
    return list;
  }, [student, eventListMode, events, applications, setup, config, eventSearch, eventCat, eventStage, eventType, catName]);

  const filteredApplications = useMemo(() => {
    return applications.filter((a) => {
      const ev = events.find((e) => e.id === a.eventId);
      if (appStageFilter && ev?.stage !== appStageFilter) return false;
      if (appStatusFilter === 'approved' && !['approved', 'selected', 'finalized'].includes(a.status)) return false;
      if (appStatusFilter === 'pending' && !['pending', 'applied', 'waitlisted'].includes(a.status)) return false;
      if (appStatusFilter === 'rejected' && !['rejected', 'not_selected', 'removed'].includes(a.status)) return false;
      return true;
    });
  }, [applications, events, appStageFilter, appStatusFilter]);

  const confirmedEventsForCard = useMemo(() => {
    const confirmedStatuses = new Set(['approved', 'selected', 'finalized']);
    return applications
      .filter((a) => confirmedStatuses.has(a.status))
      .map((a) => {
        const ev = events.find((e) => e.id === a.eventId);
        return {
          id: a.eventId || a.id,
          name: ev?.name || a.eventName || 'Event',
          stage: ev?.stage || 'On-Stage',
          type: ev?.type || 'Single',
          date: ev?.scheduleDate || '',
          time: ev?.time || '',
          venue: ev?.scheduleStage || '',
        };
      })
      .sort((a, b) => `${a.date} ${a.time} ${a.name}`.localeCompare(`${b.date} ${b.time} ${b.name}`));
  }, [applications, events]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { db } = getFirebaseState();
    if (!db || !applyEvent || !student) return;
    setApplySubmitting(true);
    try {
      await addDoc(collection(db, 'registrationRequests'), {
        name: student.name,
        participantType: 'student',
        gender: student.gender === 'Girls' ? 'Girls' : 'Boys',
        phone: '',
        email: '',
        team: student.team || '',
        category: student.category || 'General',
        relatedStudentId: student.id,
        relationship: 'Self',
        groupMembers: [],
        eventIds: [applyEvent.id],
        note: applyNote.trim(),
        youtubeUrl: youtubeUrl.trim(),
        referenceUrl: referenceUrl.trim(),
        images: applyImages,
        status: 'pending',
        submittedAt: Date.now(),
      });
      setApplyEvent(null);
      toast('Application submitted to your Team Leader.', 'success');
      await loadPortalData(student, session);
    } catch (err: any) {
      toast(err?.message || 'Unable to submit application.', 'error');
    } finally {
      setApplySubmitting(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const { db } = getFirebaseState();
    if (!file || !db || !student) return;
    setPhotoUpdating(true);
    try {
      const dataUrl = await compressImageFile(file);
      await updateDoc(doc(db, 'students', student.id), {
        photoData: dataUrl,
        photoUpdatedAt: Date.now(),
        photoUpdatedBy: 'registration_portal',
      });
      const updated = { ...student, photoData: dataUrl };
      setStudent(updated);
      if (session) {
        const nextSess = { ...session, profile: updated };
        setSession(nextSess);
        sessionStorage.setItem('studentRegistrationSession', JSON.stringify(nextSess));
      }
      toast('Profile photo updated.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Photo update failed.', 'error');
    } finally {
      setPhotoUpdating(false);
      e.target.value = '';
    }
  };

  const handleLogoutPortal = () => {
    sessionStorage.removeItem('studentRegistrationSession');
    setSession(null);
    setStudent(null);
    setCandidateId('');
    setNameInput('');
  };

  const approvedCount = applications.filter((a) => ['approved', 'selected', 'finalized'].includes(a.status)).length;
  const pendingCount = applications.filter((a) => ['pending', 'applied', 'waitlisted'].includes(a.status)).length;
  const eligibleCount = student
    ? events.filter((e) => !e.cancelled && participantEligibleForEvent(student, e, setup, config)).length
    : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      <EditorialHeader
        branding={branding}
        publicModules={setup.publicModules}
        rightAction={
          student ? (
            <button
              type="button"
              onClick={handleLogoutPortal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Switch Student</span>
            </button>
          ) : undefined
        }
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {!student ? (
          <div className="mx-auto max-w-xl space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Student Portal</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                Event Registration &amp; Digital ID
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Verify your student profile using your registered team and chest number.
              </p>
            </div>

            {portalLockedReason ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">Applications Closed</p>
                  <p className="mt-0.5">{portalLockedReason}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">Student Portal Open</p>
                  <p className="mt-0.5">Verify your chest number below to apply for eligible festival events.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleIdentitySubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Team</label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => {
                      setSelectedTeam(e.target.value);
                      setCandidateId('');
                      setNameInput('');
                      setShowSuggestions(false);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Choose Team</option>
                    {(general.teams || []).map((t) => (
                      <option key={t} value={t}>
                        {teamDisplayNames[t] || t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Gender</label>
                  <select
                    value={selectedGender}
                    onChange={(e) => {
                      setSelectedGender(e.target.value);
                      setCandidateId('');
                      setNameInput('');
                      setShowSuggestions(false);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {setup.allowedGenders.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="relative">
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Student Name (type at least 3 characters)
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => handleNameSearch(e.target.value)}
                  placeholder="Start typing your full name…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600"
                />
                {showSuggestions && (
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {suggestions.length ? (
                      suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setCandidateId(s.id);
                            setNameInput(s.name);
                            setShowSuggestions(false);
                          }}
                          className="block w-full border-b border-slate-100 px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-blue-50"
                        >
                          {s.name}{' '}
                          {s.category && <span className="text-xs text-slate-400">({catName(s.category)})</span>}
                        </button>
                      ))
                    ) : (
                      <p className="px-3.5 py-2.5 text-xs text-slate-400">
                        No matching student found in this team.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {identityError && <p className="text-xs font-medium text-red-600">{identityError}</p>}

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Verify Chest Number &amp; Continue
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Verified Student Strip */}
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 font-display text-lg font-bold text-blue-700">
                  {student.photoData ? (
                    <img
                      src={student.photoData}
                      alt={student.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    String(student.name || 'S')[0].toUpperCase()
                  )}
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900">{student.name}</h1>
                  <p className="text-xs text-slate-500">
                    {teamDisplayNames[student.team] || student.team} · {catName(student.category)} · Chest{' '}
                    <span className="font-mono-num font-bold text-slate-700">
                      {formatChestNumber(student.chestNo)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
                  { id: 'events', label: 'Events', icon: Sparkles },
                  { id: 'applications', label: 'Applications', icon: FileText },
                  { id: 'idcard', label: 'ID Card', icon: IdCard },
                ].map((t) => {
                  const Icon = t.icon;
                  const active = portalTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPortalTab(t.id as any)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                        active
                          ? 'bg-blue-700 text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {portalTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Eligible Events</span>
                    <p className="mt-2 font-mono-num text-2xl font-bold text-slate-900">{eligibleCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Applications</span>
                    <p className="mt-2 font-mono-num text-2xl font-bold text-blue-700">{applications.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Review</span>
                    <p className="mt-2 font-mono-num text-2xl font-bold text-amber-700">{pendingCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Confirmed</span>
                    <p className="mt-2 font-mono-num text-2xl font-bold text-emerald-700">{approvedCount}</p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h2 className="font-display text-base font-bold text-slate-900">Participation Limits</h2>
                      <ActionIconButton
                        icon={Info}
                        label="Participation limit rules"
                        onClick={() => setLimitsModalOpen(true)}
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {(
                        [
                          ['offStage', 'Off-Stage'],
                          ['onStage', 'On-Stage'],
                          ['single', 'Single'],
                          ['group', 'Group'],
                          ['total', 'Total'],
                        ] as const
                      )
                        .filter(([k]) => (config.participationLimits as any)?.[k]?.enabled !== false)
                        .map(([k, label]) => {
                          const lim = (config.participationLimits as any)?.[k];
                          const max = lim?.mode === 'custom' ? Number(lim.limit || 0) : 0;
                          return (
                            <div key={k} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <span className="block text-xs font-semibold text-slate-600">{label}</span>
                              <span className="mt-1 block font-mono-num text-sm font-bold text-slate-900">
                                {(usage as any)[k] || 0} / {max || '∞'}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h2 className="font-display text-base font-bold text-slate-900">Recent Applications</h2>
                      <button
                        type="button"
                        onClick={() => setPortalTab('events')}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Browse Events
                      </button>
                    </div>
                    <div className="mt-3 divide-y divide-slate-100">
                      {applications.length ? (
                        applications.slice(0, 5).map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                            <span className="truncate font-semibold text-slate-800">{a.eventName}</span>
                            <span
                              className={`font-semibold whitespace-nowrap ${
                                ['approved', 'selected', 'finalized'].includes(a.status)
                                  ? 'text-emerald-700'
                                  : ['rejected', 'not_selected', 'removed'].includes(a.status)
                                  ? 'text-red-600'
                                  : 'text-amber-700'
                              }`}
                            >
                              {['approved', 'selected', 'finalized'].includes(a.status)
                                ? 'Approved'
                                : ['rejected', 'not_selected', 'removed'].includes(a.status)
                                ? 'Rejected'
                                : 'Pending'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="py-6 text-center text-xs text-slate-400">
                          No event applications submitted yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {portalTab === 'events' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setEventListMode('eligible')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                        eventListMode === 'eligible' ? 'bg-blue-700 text-white' : 'text-slate-600'
                      }`}
                    >
                      Eligible Events
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventListMode('my')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                        eventListMode === 'my' ? 'bg-blue-700 text-white' : 'text-slate-600'
                      }`}
                    >
                      My Schedule
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={eventSearch}
                      onChange={(e) => setEventSearch(e.target.value)}
                      placeholder="Search events…"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
                    />
                    <select
                      value={eventCat}
                      onChange={(e) => setEventCat(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                    >
                      <option value="">All Categories</option>
                      {eligibleCategories.map((c) => (
                        <option key={c} value={c}>
                          {catName(c)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={eventStage}
                      onChange={(e) => setEventStage(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                    >
                      <option value="">All Stages</option>
                      <option value="On-Stage">On-Stage</option>
                      <option value="Off-Stage">Off-Stage</option>
                    </select>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                    >
                      <option value="">All Types</option>
                      <option value="Single">Single</option>
                      <option value="Group">Group</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {displayedEvents.length ? (
                    displayedEvents.map((ev) => {
                      const cap = capacityState(ev, selectedCounts[ev.id] || 0);
                      const dec = applicationDecision(config, teamPolicy, cap);
                      const limDec = participationLimitDecision(config, ev, usage);
                      const existing = applications.find((a) => a.eventId === ev.id && ACTIVE_STATUSES.has(a.status));
                      const canApply = !existing && !portalLockedReason && limDec.allowed && dec.allowed;

                      return (
                        <article
                          key={ev.id}
                          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
                        >
                          <div>
                            <h3 className="font-display text-base font-bold text-slate-900">{ev.name}</h3>
                            <p className="mt-1 text-xs text-slate-500">
                              {catName(ev.category)} · {ev.stage || 'On-Stage'} · {ev.gender || 'Both'} ·{' '}
                              {ev.type || 'Single'}
                            </p>
                            {(ev.scheduleDate || ev.time) && (
                              <p className="mt-2 font-mono-num text-xs text-blue-700">
                                {ev.scheduleDate || ''} {ev.time || ''} · {ev.scheduleStage || 'Stage TBD'}
                              </p>
                            )}
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                            <span className="font-mono-num text-xs text-slate-500">
                              {existing
                                ? existing.status === 'approved'
                                  ? 'Approved'
                                  : 'Pending'
                                : `${cap.remaining} slot(s) left`}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <ActionIconButton
                                icon={Eye}
                                label="Event rules and details"
                                onClick={() => setInfoEvent(ev)}
                              />
                              <ActionIconButton
                                icon={Send}
                                tone="primary"
                                label={
                                  existing
                                    ? 'Already applied'
                                    : !limDec.allowed
                                    ? 'Participation limit reached'
                                    : !dec.allowed
                                    ? 'Event full or closed'
                                    : 'Apply for this event'
                                }
                                disabled={!canApply}
                                onClick={() => {
                                  setApplyEvent(ev);
                                  setApplyNote('');
                                  setYoutubeUrl('');
                                  setReferenceUrl('');
                                  setApplyImages([]);
                                }}
                              />
                            </div>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                      {eventListMode === 'my'
                        ? 'No confirmed events in your schedule yet.'
                        : 'No eligible events match your filters.'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {portalTab === 'applications' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <select
                    value={appStatusFilter}
                    onChange={(e) => setAppStatusFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                  >
                    <option value="">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select
                    value={appStageFilter}
                    onChange={(e) => setAppStageFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                  >
                    <option value="">All Stages</option>
                    <option value="On-Stage">On-Stage</option>
                    <option value="Off-Stage">Off-Stage</option>
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {filteredApplications.length ? (
                    filteredApplications.map((a) => {
                      const ev = events.find((x) => x.id === a.eventId);
                      const isApp = ['approved', 'selected', 'finalized'].includes(a.status);
                      const isRej = ['rejected', 'not_selected', 'removed'].includes(a.status);
                      return (
                        <article key={a.id} className="rounded-xl border border-slate-200 bg-white p-5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-display text-base font-bold text-slate-900">{a.eventName}</h3>
                            <span
                              className={`text-xs font-semibold ${
                                isApp ? 'text-emerald-700' : isRej ? 'text-red-600' : 'text-amber-700'
                              }`}
                            >
                              {isApp ? 'Approved' : isRej ? 'Rejected' : 'Pending Review'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {catName(ev?.category)} · {ev?.stage || 'On-Stage'} · {ev?.type || 'Single'}
                          </p>
                          {a.note && (
                            <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">{a.note}</p>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                      No applications found.
                    </div>
                  )}
                </div>
              </div>
            )}

            {portalTab === 'idcard' && (
              <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
                <div className="lg:col-span-6">
                  <ParticipantIdCard
                    student={student}
                    confirmedEvents={confirmedEventsForCard}
                    branding={branding}
                    teamColors={general.teamColors}
                    teamDisplayNames={general.teamDisplayNames}
                    categoryDisplayNames={general.categoryDisplayNames}
                    verificationUrl={buildVerificationUrl(student)}
                  />
                </div>
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
                  <h2 className="font-display text-base font-bold text-slate-900">Participant Badge Preferences</h2>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Your digital ID card contains an official QR signature and updates automatically when your Team
                    Leader approves competition entries.
                  </p>
                  {config.profileEditEnabled && (
                    <div className="border-t border-slate-100 pt-4">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                        <Camera className="h-4 w-4 text-blue-700" />
                        <span>{photoUpdating ? 'Uploading…' : 'Update Profile Photo'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Chest Verification Modal */}
      <Modal
        open={chestModalOpen}
        onClose={() => setChestModalOpen(false)}
        title="Verify Chest Number"
        subtitle={`${nameInput} · ${teamDisplayNames[selectedTeam] || selectedTeam}`}
        maxWidthClass="max-w-sm"
      >
        <form onSubmit={handleVerifyChest} className="space-y-4">
          <div className="relative">
            <input
              type={showChest ? 'text' : 'password'}
              autoFocus
              value={chestInput}
              onChange={(e) => setChestInput(e.target.value)}
              placeholder="Enter chest number (e.g. R104)"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-10 font-mono-num text-sm text-slate-900 outline-none focus:border-blue-600"
            />
            <button
              type="button"
              onClick={() => setShowChest((p) => !p)}
              aria-label="Toggle chest number visibility"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showChest ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {verifyError && <p className="text-xs font-medium text-red-600">{verifyError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setChestModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifying}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {verifying ? 'Verifying…' : 'Open Portal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Event Details Modal */}
      <Modal
        open={Boolean(infoEvent)}
        onClose={() => setInfoEvent(null)}
        title={infoEvent?.name || 'Event Details'}
        subtitle={
          infoEvent
            ? `${catName(infoEvent.category)} · ${infoEvent.stage} · ${infoEvent.gender} · ${infoEvent.type}`
            : ''
        }
      >
        {infoEvent && (
          <div className="space-y-4">
            {infoEvent.rules || infoEvent.notes ? (
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500">Rules &amp; Guidelines</h4>
                <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  {infoEvent.rules || infoEvent.notes}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No extra rules specified.</p>
            )}
            {Array.isArray(infoEvent.criteria) && infoEvent.criteria.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500">Judging Criteria</h4>
                <div className="mt-1 divide-y divide-slate-100">
                  {infoEvent.criteria.map((c, idx) => (
                    <div key={idx} className="flex justify-between py-1.5 text-xs">
                      <span>{c.name}</span>
                      <strong className="font-mono-num">{c.maximumMark} pts</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Participation Limits Info Modal */}
      <Modal open={limitsModalOpen} onClose={() => setLimitsModalOpen(false)} title="Participation Limit Rules">
        <p className="text-xs text-slate-600">
          Your confirmed entries and pending applications count toward the festival limits configured by the
          administrator.
        </p>
        {config.participationLimits.noticeContent && (
          <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
            <strong>{config.participationLimits.noticeHeading || 'Guidelines'}</strong>
            <p className="mt-1 whitespace-pre-line">{config.participationLimits.noticeContent}</p>
          </div>
        )}
      </Modal>

      {/* Apply Event Modal */}
      <Modal
        open={Boolean(applyEvent)}
        onClose={() => setApplyEvent(null)}
        title={`Apply: ${applyEvent?.name || ''}`}
      >
        <form onSubmit={handleApplySubmit} className="space-y-4">
          {config.applicationFields.description !== 'off' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Note {config.applicationFields.description === 'required' && '*'}
              </label>
              <textarea
                rows={3}
                maxLength={config.applicationNoteMaxLength}
                required={config.applicationFields.description === 'required'}
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
              />
            </div>
          )}
          {config.applicationFields.youtube !== 'off' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">YouTube Link</label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
              />
            </div>
          )}
          {config.applicationFields.reference !== 'off' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Reference Link</label>
              <input
                type="url"
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
              />
            </div>
          )}
          {config.applicationFields.images !== 'off' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Attachment Image (&lt;300 KB)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return setApplyImages([]);
                  try {
                    const dataUrl = await compressImageFile(f);
                    setApplyImages([{ name: f.name, type: 'image/webp', size: dataUrl.length, data: dataUrl }]);
                  } catch (err: any) {
                    toast(err?.message || 'Image error', 'error');
                  }
                }}
                className="text-xs text-slate-600"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setApplyEvent(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={applySubmitting}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {applySubmitting ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </form>
      </Modal>

      <EditorialFooter branding={branding} />
    </div>
  );
};
