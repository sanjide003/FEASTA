import React, { useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { useDialog } from '../../../components/ui/DialogContext';
import { teamColor } from '../../../lib/festConfig';
import { buildTeamScoreLedger } from '../../../lib/scoreUtils';
import type { AdminActions, AdminState } from './types';

const PORTAL_LINKS = [
  { label: 'Public Festival Home', path: '/' },
  { label: 'Published Results & Leaderboard', path: '/results' },
  { label: 'Student Self-Registration', path: '/register' },
  { label: 'Team Leader Portal', path: '/team' },
  { label: 'Judge Scoring Desk', path: '/judge' },
  { label: 'Live TV Broadcast', path: '/tv' },
  { label: 'TV Broadcast Control', path: '/tv-control' },
  { label: 'Unified Staff Login', path: '/login' },
];

export const AdminOverviewTab: React.FC<{ state: AdminState; actions: AdminActions }> = ({ state, actions }) => {
  const { toast } = useDialog();
  const teams = useMemo(() => state.general.teams || [], [state.general.teams]);
  const teamNames = state.general.teamDisplayNames || {};
  const colors = state.general.teamColors || {};

  const pendingReqs = useMemo(
    () => state.requests.filter((r) => ['pending', 'applied', 'under_review', 'waitlisted'].includes(r.status)).length,
    [state.requests]
  );

  const publishedResults = useMemo(
    () => state.results.filter((r) => !r.status || r.status === 'published'),
    [state.results]
  );

  const standings = useMemo(() => {
    const scoreMap = new Map<string, number>(teams.map((t) => [t, 0]));
    const ledger = buildTeamScoreLedger(
      publishedResults,
      (wid, _type, res) => {
        const direct = res?.winnerDetails?.[wid]?.team;
        if (direct) return direct;
        const st = state.students.find((s) => s.id === wid || String(s.chestNo) === String(wid));
        if (st?.team) return st.team;
        const reg = state.registrations.find((r) => r.id === wid);
        return reg?.team || '';
      },
      state.events
    );
    ledger.forEach((entry) => {
      scoreMap.set(entry.team, (scoreMap.get(entry.team) || 0) + Number(entry.points || 0));
    });
    return [...scoreMap.entries()]
      .map(([team, points]) => ({
        team,
        label: teamNames[team] || team,
        color: teamColor(team, colors),
        points,
      }))
      .sort((a, b) => b.points - a.points);
  }, [teams, publishedResults, state.students, state.registrations, state.events, teamNames, colors]);

  const checklist = [
    {
      label: 'Configure festival identity & branding',
      done: Boolean(state.branding.festName1 && state.branding.configured !== false),
      tab: 'setup' as const,
    },
    {
      label: 'Configure teams, chest series & categories',
      done: (state.general.teams?.length || 0) > 0 && (state.general.categories?.length || 0) > 0,
      tab: 'setup' as const,
    },
    {
      label: 'Import or add student participants',
      done: state.students.length > 0,
      tab: 'students' as const,
    },
    {
      label: 'Create festival competition events',
      done: state.events.length > 0,
      tab: 'events' as const,
    },
    {
      label: 'Assign staff accounts (Team Leaders & Judges)',
      done: state.staffUsers.some((u) => u.role === 'teamLeader' || u.role === 'judge'),
      tab: 'staff' as const,
    },
  ];

  const copyPortalUrl = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard?.writeText(url).then(
      () => toast(`Copied ${url}`, 'success'),
      () => toast('Unable to copy link.', 'error')
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Festival Command Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live snapshot of participants, competitions, registrations, and scoreboard sync.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await actions.syncSummary(state.students.length, publishedResults);
            toast('Public summary snapshot synced.', 'success');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Sync Public Snapshot</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Students', value: state.students.length },
          { label: 'Events', value: state.events.filter((e) => !e.cancelled).length },
          { label: 'Registrations', value: state.registrations.length },
          { label: 'Pending Requests', value: pendingReqs },
          { label: 'Published Results', value: publishedResults.length },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {kpi.label}
            </p>
            <p className="mt-1 font-mono-num text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Readiness & Team Standings */}
        <div className="space-y-6 lg:col-span-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              Launch Readiness Checklist
            </h2>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {checklist.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => actions.navigateTab(item.tab)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-xs hover:text-blue-700"
                >
                  <span className="flex items-center gap-2.5">
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    <span className={item.done ? 'font-medium text-slate-700 dark:text-slate-200' : 'font-semibold text-slate-900 dark:text-white'}>
                      {item.label}
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">Open</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">Team Standings</h2>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {standings.length ? (
                standings.map((t, idx) => (
                  <div key={t.team} className="flex items-center justify-between py-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 font-mono-num font-bold text-slate-400">#{idx + 1}</span>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{t.label}</span>
                    </div>
                    <span className="font-mono-num text-sm font-bold text-slate-900 dark:text-slate-100">
                      {t.points} pts
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">No teams configured yet.</p>
              )}
            </div>
          </section>
        </div>

        {/* Portal Links */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">Quick Portal Links</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Share direct access routes for participants, team leaders, judges, and stage screens.
          </p>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {PORTAL_LINKS.map((p) => (
              <div key={p.path} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{p.label}</p>
                  <p className="truncate font-mono-num text-[11px] text-slate-500">{p.path}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ActionIconButton icon={Copy} label={`Copy ${p.label} link`} onClick={() => copyPortalUrl(p.path)} />
                  <ActionIconButton
                    icon={ExternalLink}
                    label={`Open ${p.label}`}
                    tone="primary"
                    onClick={() => window.open(p.path, '_self')}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
