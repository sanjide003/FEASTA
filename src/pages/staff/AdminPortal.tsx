import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  MonitorPlay,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection } from 'firebase/firestore';
import { WorkspaceShell, type WorkspaceNavItem } from '../../components/layout/WorkspaceShell';
import { ActionIconButton } from '../../components/ui/ActionIconButton';
import { useDialog } from '../../components/ui/DialogContext';
import { normalizeBranding } from '../../lib/branding';
import { cachedGetDoc, cachedGetDocs, invalidateCache } from '../../lib/dataCache';
import { getFirebaseState } from '../../lib/firebase';
import { defaultScoringRules } from '../../lib/scoreUtils';
import { ADMIN_ROLES, resolveAuthenticatedProfile, routeForRole, signOutStaff } from '../../lib/staffAuth';
import { applyAdminTheme, clearDocumentDarkClass, readAdminTheme, type AdminTheme } from '../../lib/theme';
import type {
  AccessUser,
  BrandingConfig,
  FestEvent,
  GeneralConfig,
  JudgeAssignment,
  JudgeScore,
  Notice,
  Registration,
  RegistrationRequest,
  ResultDoc,
  ScheduleBreak,
  Student,
  TvConfig,
} from '../../types/festival';
import { AdminEventsTab } from './admin/AdminEventsTab';
import { AdminNoticesTab } from './admin/AdminNoticesTab';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminRegistrationsTab } from './admin/AdminRegistrationsTab';
import { AdminResetTab } from './admin/AdminResetTab';
import { AdminResultsTab } from './admin/AdminResultsTab';
import { AdminScheduleTab } from './admin/AdminScheduleTab';
import { AdminSetupTab } from './admin/AdminSetupTab';
import { AdminStaffTab } from './admin/AdminStaffTab';
import { AdminStudentsTab } from './admin/AdminStudentsTab';
import { AdminTvTab } from './admin/AdminTvTab';
import { syncPublicSummary, type AdminScope, type AdminState } from './admin/types';

const TAB_REQUIRED_COLLECTIONS: Record<AdminScope, string[]> = {
  overview: ['settings', 'students', 'events', 'registrations', 'requests', 'results', 'staff'],
  setup: ['settings'],
  students: ['settings', 'students', 'events', 'registrations'],
  events: ['settings', 'events'],
  registrations: ['settings', 'students', 'events', 'registrations', 'requests'],
  schedule: ['settings', 'events', 'scheduleBreaks'],
  results: ['settings', 'students', 'events', 'registrations', 'results', 'staff', 'judgeAssignments', 'judgeScores'],
  staff: ['settings', 'staff'],
  tv: ['settings', 'results'],
  notices: ['settings', 'notices'],
  reset: ['settings', 'students', 'events', 'registrations', 'results'],
};

export const AdminPortal: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useDialog();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminScope>('overview');
  const [theme, setTheme] = useState<AdminTheme>(() => readAdminTheme());
  const [syncing, setSyncing] = useState(false);

  const loadedCollectionsRef = useRef<Set<string>>(new Set());

  const [state, setState] = useState<AdminState>({
    profile: { id: '', username: '', email: '', role: 'admin' },
    branding: normalizeBranding(),
    general: {},
    registrationConfig: {},
    scheduleConfig: {},
    scoringRules: defaultScoringRules(),
    tvConfig: {},
    tvControl: {},
    students: [],
    events: [],
    registrations: [],
    requests: [],
    results: [],
    scheduleBreaks: [],
    staffUsers: [],
    judgeAssignments: [],
    judgeScores: [],
    notices: [],
  });

  useEffect(() => {
    applyAdminTheme(theme);
    return () => clearDocumentDarkClass();
  }, [theme]);

  const loadCollections = useCallback(
    async (keys: string[], force = false) => {
      const { db } = getFirebaseState();
      if (!db) return;

      const needed = force ? keys : keys.filter((k) => !loadedCollectionsRef.current.has(k));
      if (!needed.length) return;

      setSyncing(true);
      try {
        if (force) invalidateCache();
        const patch: Partial<AdminState> = {};

        await Promise.all(
          needed.map(async (key) => {
            if (key === 'settings') {
              const [home, gen, regCfg, schedCfg, scoring, tvCfg, tvCtrl] = await Promise.all([
                cachedGetDoc<BrandingConfig>(db, 'settings', 'home_config', { forceRefresh: force }),
                cachedGetDoc<GeneralConfig>(db, 'settings', 'general', { forceRefresh: force }),
                cachedGetDoc<Record<string, any>>(db, 'settings', 'registration_config', { forceRefresh: force }),
                cachedGetDoc<Record<string, any>>(db, 'settings', 'schedule_config', { forceRefresh: force }),
                cachedGetDoc<Record<string, any>>(db, 'settings', 'scoring_rules', { forceRefresh: force }),
                cachedGetDoc<TvConfig>(db, 'settings', 'tv_config', { forceRefresh: force }),
                cachedGetDoc<TvConfig>(db, 'settings', 'tv_control', { forceRefresh: force }),
              ]);
              patch.branding = normalizeBranding(home || {});
              patch.general = gen || {};
              patch.registrationConfig = regCfg || {};
              patch.scheduleConfig = schedCfg || {};
              patch.scoringRules = scoring || defaultScoringRules();
              patch.tvConfig = tvCfg || {};
              patch.tvControl = tvCtrl || {};
            } else if (key === 'students') {
              patch.students = await cachedGetDocs<Student>('admin:students', collection(db, 'students'), {
                forceRefresh: force,
              });
            } else if (key === 'events') {
              patch.events = await cachedGetDocs<FestEvent>('admin:events', collection(db, 'events'), {
                forceRefresh: force,
              });
            } else if (key === 'registrations') {
              patch.registrations = await cachedGetDocs<Registration>(
                'admin:registrations',
                collection(db, 'registrations'),
                { forceRefresh: force }
              );
            } else if (key === 'requests') {
              patch.requests = await cachedGetDocs<RegistrationRequest>(
                'admin:requests',
                collection(db, 'registrationRequests'),
                { forceRefresh: force }
              );
            } else if (key === 'results') {
              patch.results = await cachedGetDocs<ResultDoc>('admin:results', collection(db, 'results'), {
                forceRefresh: force,
              });
            } else if (key === 'scheduleBreaks') {
              patch.scheduleBreaks = await cachedGetDocs<ScheduleBreak>(
                'admin:scheduleBreaks',
                collection(db, 'scheduleBreaks'),
                { forceRefresh: force }
              );
            } else if (key === 'staff') {
              const [acc, adm] = await Promise.all([
                cachedGetDocs<AccessUser>('admin:accessUsers', collection(db, 'accessUsers'), { forceRefresh: force }),
                cachedGetDocs<AccessUser>('admin:adminUsers', collection(db, 'adminUsers'), { forceRefresh: force }),
              ]);
              patch.staffUsers = [
                ...adm.map((u) => ({ ...u, sourceCollection: 'adminUsers' as const })),
                ...acc.map((u) => ({ ...u, sourceCollection: 'accessUsers' as const })),
              ];
            } else if (key === 'judgeAssignments') {
              patch.judgeAssignments = await cachedGetDocs<JudgeAssignment>(
                'admin:judgeAssignments',
                collection(db, 'judgeAssignments'),
                { forceRefresh: force }
              );
            } else if (key === 'judgeScores') {
              patch.judgeScores = await cachedGetDocs<JudgeScore>('admin:judgeScores', collection(db, 'judgeScores'), {
                forceRefresh: force,
              });
            } else if (key === 'notices') {
              const rows = await cachedGetDocs<Notice>('admin:notices', collection(db, 'notifications'), {
                forceRefresh: force,
              });
              patch.notices = rows.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
            }
            loadedCollectionsRef.current.add(key);
          })
        );

        setState((prev) => ({ ...prev, ...patch }));
      } catch (err: any) {
        toast(err?.message || 'Failed to sync admin data.', 'error');
      } finally {
        setSyncing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    document.title = 'Admin Command Console — Feastport';
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
        navigate('/login', { replace: true });
        return;
      }
      if (!ADMIN_ROLES.has(p.role)) {
        navigate(routeForRole(p.role), { replace: true });
        return;
      }
      setState((prev) => ({ ...prev, profile: p }));
      setCheckingAuth(false);
      loadCollections(TAB_REQUIRED_COLLECTIONS.overview);
    });
    return () => unsub();
  }, [navigate, loadCollections]);

  const handleTabChange = (tabId: string) => {
    const scope = tabId as AdminScope;
    setActiveTab(scope);
    loadCollections(TAB_REQUIRED_COLLECTIONS[scope] || ['settings']);
  };

  const refreshScopes = async (scopes?: string[], force = true) => {
    const scopeMap: Record<string, string[]> = {
      setup: ['settings'],
      students: ['students'],
      events: ['events'],
      registrations: ['registrations', 'requests'],
      schedule: ['events', 'scheduleBreaks'],
      results: ['results', 'judgeAssignments', 'judgeScores'],
      staff: ['staff'],
      tv: ['settings'],
      notices: ['notices'],
    };
    const keys = scopes?.length
      ? [...new Set(scopes.flatMap((s) => scopeMap[s] || [s]))]
      : TAB_REQUIRED_COLLECTIONS[activeTab];
    await loadCollections(keys, force);
  };

  const syncSummary = async (overrideStudentCount?: number, overrideResults?: ResultDoc[]) => {
    await syncPublicSummary(
      state.general.teams || [],
      state.events,
      overrideStudentCount,
      overrideResults || state.results
    );
  };

  const toggleTheme = () => {
    const next: AdminTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyAdminTheme(next);
  };

  const navItems: WorkspaceNavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'setup', label: 'Festival Setup', icon: Settings2 },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'events', label: 'Events', icon: Sparkles },
    {
      id: 'registrations',
      label: 'Registrations',
      icon: ClipboardList,
      badge: state.requests.filter((r) => ['pending', 'applied', 'under_review', 'waitlisted'].includes(r.status)).length,
    },
    { id: 'schedule', label: 'Schedule', icon: CalendarClock },
    { id: 'results', label: 'Results & Judging', icon: Trophy },
    { id: 'staff', label: 'Staff & Logins', icon: ShieldCheck },
    { id: 'tv', label: 'TV Broadcast', icon: MonitorPlay },
    { id: 'notices', label: 'Notices', icon: Megaphone },
    { id: 'reset', label: 'Data Reset', icon: RotateCcw },
  ];

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-xs font-medium text-slate-500">
        Verifying administrator access…
      </div>
    );
  }

  const actions = {
    refreshScopes,
    syncSummary,
    navigateTab: handleTabChange,
  };

  return (
    <WorkspaceShell
      portalTitle="Feastport Admin"
      portalSubtitle={state.branding.festName1 || 'Festival Command'}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      userLabel={state.profile.displayName || state.profile.username || 'Administrator'}
      userSublabel={state.profile.email}
      onLogout={async () => {
        await signOutStaff();
        navigate('/login', { replace: true });
      }}
      theme={theme}
      onToggleTheme={toggleTheme}
      headerActions={
        <ActionIconButton
          icon={RefreshCw}
          label="Refresh active workspace data"
          className={syncing ? 'animate-spin' : ''}
          onClick={() => refreshScopes(undefined, true)}
        />
      }
    >
      {activeTab === 'overview' && <AdminOverviewTab state={state} actions={actions} />}
      {activeTab === 'setup' && <AdminSetupTab state={state} actions={actions} />}
      {activeTab === 'students' && <AdminStudentsTab state={state} actions={actions} />}
      {activeTab === 'events' && <AdminEventsTab state={state} actions={actions} />}
      {activeTab === 'registrations' && <AdminRegistrationsTab state={state} actions={actions} />}
      {activeTab === 'schedule' && <AdminScheduleTab state={state} actions={actions} />}
      {activeTab === 'results' && <AdminResultsTab state={state} actions={actions} />}
      {activeTab === 'staff' && <AdminStaffTab state={state} actions={actions} />}
      {activeTab === 'tv' && <AdminTvTab state={state} actions={actions} />}
      {activeTab === 'notices' && <AdminNoticesTab state={state} actions={actions} />}
      {activeTab === 'reset' && <AdminResetTab state={state} actions={actions} />}
    </WorkspaceShell>
  );
};
