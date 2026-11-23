import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, Trophy, UserPlus, X } from 'lucide-react';
import { EditorialFooter, EditorialHeader } from '../../components/layout/EditorialShell';
import { AppInstallFormats } from '../../components/pwa/PWAInstallButton';
import { brandingName, cacheBranding, clearBrandingCache, normalizeBranding, readCachedBranding } from '../../lib/branding';
import { cachedGetDoc, cachedGetDocs, invalidateCache } from '../../lib/dataCache';
import { eventContributesToTeamScore, normalizeFestSetup, teamColor } from '../../lib/festConfig';
import { getFirebaseState } from '../../lib/firebase';
import { eventTimestamp, formatTime12h, normalizeResultData, resolveDisplayName } from '../../lib/resultUtils';
import { buildTeamScoreLedger } from '../../lib/scoreUtils';
import { collection, query, where } from 'firebase/firestore';
import type {
  BrandingConfig,
  FestEvent,
  FestSetup,
  GeneralConfig,
  ResultDoc,
} from '../../types/festival';

const PAGE_SIZE = 5;

export const HomePage: React.FC = () => {
  const location = useLocation();
  const [branding, setBranding] = useState<BrandingConfig>(() => readCachedBranding());
  const [general, setGeneral] = useState<GeneralConfig>({});
  const [publicConfig, setPublicConfig] = useState<Record<string, any>>({});
  const [publicSummary, setPublicSummary] = useState<Record<string, any>>({});
  const [festSetup, setFestSetup] = useState<FestSetup>(() => normalizeFestSetup());
  const [events, setEvents] = useState<FestEvent[]>([]);
  const [publishedResults, setPublishedResults] = useState<ResultDoc[]>([]);
  const [judgingStatuses, setJudgingStatuses] = useState<any[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [scheduleView, setScheduleView] = useState<'upcoming' | 'previous'>('upcoming');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [schedulePage, setSchedulePage] = useState(1);

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const loadPublicData = useCallback(async (forceRefresh = false) => {
    const { db, isFirebaseConfigured } = getFirebaseState();
    if (!isFirebaseConfigured || !db) {
      setLoading(false);
      return;
    }
    if (forceRefresh) {
      setRefreshing(true);
      invalidateCache('');
    }
    try {
      const [homeDoc, genDoc, pubDoc, summaryDoc, evList, resList, statusList, leadersList] = await Promise.all([
        cachedGetDoc<BrandingConfig>(db, 'settings', 'home_config', { ttlMs: 300_000, forceRefresh }),
        cachedGetDoc<GeneralConfig>(db, 'settings', 'general', { ttlMs: 300_000, forceRefresh }),
        cachedGetDoc<Record<string, any>>(db, 'settings', 'public_config', { ttlMs: 300_000, forceRefresh }),
        cachedGetDoc<Record<string, any>>(db, 'settings', 'public_summary', { ttlMs: 120_000, forceRefresh }),
        cachedGetDocs<FestEvent>('col:events', collection(db, 'events'), { ttlMs: 120_000, forceRefresh }),
        cachedGetDocs<ResultDoc>(
          'col:results:published',
          query(collection(db, 'results'), where('status', '==', 'published')),
          { ttlMs: 60_000, forceRefresh }
        ),
        cachedGetDocs<any>('col:publicJudgingStatuses', collection(db, 'publicJudgingStatuses'), {
          ttlMs: 90_000,
          forceRefresh,
        }),
        cachedGetDocs<any>('col:teamLeaders', collection(db, 'teamLeaders'), { ttlMs: 300_000, forceRefresh }),
      ]);

      if (homeDoc) {
        setBranding(cacheBranding(homeDoc));
      } else {
        clearBrandingCache();
        setBranding(normalizeBranding());
      }
      const gen: GeneralConfig = genDoc || {};
      setGeneral(gen);
      setPublicConfig(pubDoc || {});
      setPublicSummary(summaryDoc || {});
      setFestSetup(normalizeFestSetup(gen.festSetup || {}));
      setEvents((evList || []).filter((e) => e.status !== 'draft'));
      setPublishedResults(resList || []);
      setJudgingStatuses(statusList || []);
      setTeamLeaders(leadersList || []);
    } catch (err) {
      console.warn('Public data load fallback:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPublicData(false);
  }, [loadPublicData]);

  useEffect(() => {
    document.title = `${brandingName(branding)} — Festival Home`;
  }, [branding]);

  useEffect(() => {
    if (location.hash === '#schedule') {
      document.getElementById('schedule')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash, loading]);

  const catName = useCallback(
    (k: unknown) => resolveDisplayName(general.categoryDisplayNames, k, 'General'),
    [general.categoryDisplayNames]
  );

  const teamNames = general.teamDisplayNames || {};
  const colors = general.teamColors || {};
  const teams = general.teams || [];

  const rankedTeams = useMemo(() => {
    const scoreMap = new Map<string, number>(teams.map((t) => [t, 0]));
    if (publicSummary.teamScores && typeof publicSummary.teamScores === 'object' && Object.keys(publicSummary.teamScores).length) {
      Object.entries(publicSummary.teamScores).forEach(([team, pts]) => scoreMap.set(team, Number(pts || 0)));
    } else {
      const scoringEvents = events.filter((e) => eventContributesToTeamScore(e, festSetup));
      const ledger = buildTeamScoreLedger(
        publishedResults,
        (winnerId, _type, res) => res?.winnerDetails?.[winnerId]?.team || '',
        scoringEvents
      );
      ledger.forEach((entry) => {
        scoreMap.set(entry.team, (scoreMap.get(entry.team) || 0) + Number(entry.points || 0));
      });
    }
    return [...scoreMap.entries()].sort((a, b) => b[1] - a[1]);
  }, [teams, publicSummary.teamScores, publishedResults, events, festSetup]);

  const maxTeamScore = Math.max(1, ...rankedTeams.map(([, pts]) => pts));

  const latestNormalizedResults = useMemo(() => {
    return publishedResults
      .map((r) => normalizeResultData(r, { events }))
      .sort((a, b) => Number(b.publishedAt || b.updatedAt || 0) - Number(a.publishedAt || a.updatedAt || 0))
      .slice(0, 5);
  }, [publishedResults, events]);

  const scheduledEvents = useMemo(() => {
    return events
      .filter((e) => !e.cancelled && (e.scheduleDate || e.time || e.scheduleOrder))
      .sort(
        (a, b) =>
          eventTimestamp(a) - eventTimestamp(b) || Number(a.scheduleOrder || 9999) - Number(b.scheduleOrder || 9999)
      );
  }, [events]);

  const submittedEventIds = useMemo(
    () => new Set(judgingStatuses.filter((s) => s.status === 'submitted').map((s) => s.eventId)),
    [judgingStatuses]
  );
  const publishedIds = useMemo(
    () => new Set(publishedResults.map((r) => r.eventId || r.id)),
    [publishedResults]
  );

  const nextProgram = useMemo(() => {
    const now = Date.now();
    return (
      scheduledEvents.find(
        (e) =>
          !publishedIds.has(e.id) &&
          !submittedEventIds.has(e.id) &&
          eventTimestamp(e) >= now - 30 * 60000
      ) || scheduledEvents[0]
    );
  }, [scheduledEvents, publishedIds, submittedEventIds]);

  const nextCountdown = useMemo(() => {
    if (!nextProgram) return '—';
    const ts = eventTimestamp(nextProgram);
    if (ts === Number.MAX_SAFE_INTEGER) return 'Scheduled';
    const diff = ts - Date.now();
    if (diff <= 0) return 'In Progress';
    return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
  }, [nextProgram]);

  const scheduleCategories = useMemo(
    () => [...new Set(scheduledEvents.map((e) => e.category).filter(Boolean))].sort(),
    [scheduledEvents]
  );
  const scheduleStages = useMemo(
    () => [...new Set(scheduledEvents.map((e) => e.scheduleStage).filter(Boolean))].sort(),
    [scheduledEvents]
  );

  const filteredScheduleRows = useMemo(() => {
    const now = Date.now();
    const filtered = scheduledEvents.filter(
      (e) => (!filterCategory || e.category === filterCategory) && (!filterStage || e.scheduleStage === filterStage)
    );
    if (scheduleView === 'previous') {
      return filtered.filter(
        (e) => publishedIds.has(e.id) || submittedEventIds.has(e.id) || eventTimestamp(e) < now - 30 * 60000
      );
    }
    return filtered.filter(
      (e) =>
        !publishedIds.has(e.id) &&
        !submittedEventIds.has(e.id) &&
        (eventTimestamp(e) === Number.MAX_SAFE_INTEGER || eventTimestamp(e) >= now - 30 * 60000)
    );
  }, [scheduledEvents, filterCategory, filterStage, scheduleView, publishedIds, submittedEventIds]);

  const totalSchedulePages = Math.max(1, Math.ceil(filteredScheduleRows.length / PAGE_SIZE));
  const safeSchedulePage = Math.min(schedulePage, totalSchedulePages);
  const pagedScheduleRows = filteredScheduleRows.slice(
    (safeSchedulePage - 1) * PAGE_SIZE,
    safeSchedulePage * PAGE_SIZE
  );

  const galleryImages = useMemo(
    () => (Array.isArray(branding.gallery) ? branding.gallery.filter(Boolean) : []),
    [branding.gallery]
  );

  const modules = festSetup.publicModules || {};
  const sections = festSetup.publicView?.landing?.sections || ({} as any);
  const customLinks = festSetup.publicView?.landing?.customLinks || [];
  const nextBgUrl = publicConfig?.nextProgramCard?.backgroundImages?.[0] || '';
  const festTitle = brandingName(branding);

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      <EditorialHeader branding={branding} publicModules={modules} />

      <main className="flex-1">
        {/* Hero + Next Program Stage Card */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8 lg:py-14">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {branding.logoUrl ? (
                    <img
                      src={branding.logoUrl}
                      alt={festTitle}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="font-display text-sm font-bold text-blue-700">FP</span>
                  )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  Arts &amp; Cultural Festival
                </p>
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl text-balance">
                {festTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {branding.tagline}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {modules.results !== false && (
                  <Link
                    to="/results"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
                  >
                    <Trophy className="h-4 w-4" />
                    <span>View Results</span>
                  </Link>
                )}
                {modules.registration !== false && (
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <UserPlus className="h-4 w-4 text-blue-700" />
                    <span>Student Registration</span>
                  </Link>
                )}
                {modules.schedule !== false && (
                  <a
                    href="#schedule"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                  >
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <span>Stage Schedule</span>
                  </a>
                )}
              </div>

              {customLinks.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {customLinks.map((item, idx) => (
                    <a
                      key={idx}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 p-6 text-white">
                {nextBgUrl && (
                  <img
                    src={nextBgUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-30"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                      Next Scheduled Program
                    </span>
                    <span className="font-mono-num text-xs font-semibold text-amber-300">{nextCountdown}</span>
                  </div>
                  <h2 className="mt-3 font-display text-xl font-bold text-white">
                    {nextProgram?.name || 'Schedule awaiting update'}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-300">
                    {nextProgram
                      ? `${catName(nextProgram.category)} · ${nextProgram.stage || 'On-Stage'} · ${nextProgram.gender || 'Both'}`
                      : 'Check the schedule below once events are published.'}
                  </p>
                  <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/15 pt-4 text-xs">
                    <div>
                      <span className="block text-slate-400">Date</span>
                      <strong className="mt-0.5 block font-semibold text-white">
                        {nextProgram?.scheduleDate || '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-400">Time</span>
                      <strong className="mt-0.5 block font-mono-num font-semibold text-white">
                        {nextProgram ? formatTime12h(nextProgram.time) : '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-400">Stage</span>
                      <strong className="mt-0.5 block truncate font-semibold text-white">
                        {nextProgram?.scheduleStage || (nextProgram ? 'Main Stage' : '—')}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4-Stat Festival Overview */}
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Events</span>
              <p className="mt-2 font-mono-num text-3xl font-bold text-slate-900">{events.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Published Results</span>
              <p className="mt-2 font-mono-num text-3xl font-bold text-blue-700">{publishedResults.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Participating Teams</span>
              <p className="mt-2 font-mono-num text-3xl font-bold text-slate-900">{teams.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Registered Students</span>
              <p className="mt-2 font-mono-num text-3xl font-bold text-emerald-700">
                {publicSummary.studentCount ?? '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Team Standings & Latest Results */}
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-12">
            {modules.teamStandings !== false && sections.teamStandings !== false && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">Team Standings</h2>
                    <p className="text-xs text-slate-500">Calculated from published official results</p>
                  </div>
                  <Link to="/results?tab=team" className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap">
                    Full breakdown
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {rankedTeams.length ? (
                    rankedTeams.map(([team, pts], idx) => {
                      const color = teamColor(team, colors);
                      const pct = Math.round((pts / maxTeamScore) * 100);
                      return (
                        <div key={team} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="w-5 font-mono-num text-xs font-bold text-slate-400">#{idx + 1}</span>
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                              <span className="truncate font-semibold text-slate-800">{teamNames[team] || team}</span>
                            </div>
                            <span className="font-mono-num font-bold text-slate-900">{pts} pts</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="py-6 text-center text-sm text-slate-400">
                      Standings will appear as results are published.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div
              className={`rounded-xl border border-slate-200 bg-white p-6 ${
                modules.teamStandings !== false && sections.teamStandings !== false ? 'lg:col-span-7' : 'lg:col-span-12'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Latest Published Results</h2>
                  <p className="text-xs text-slate-500">Verified winners across recently concluded events</p>
                </div>
                <Link to="/results" className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap">
                  All results
                </Link>
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {latestNormalizedResults.length ? (
                  latestNormalizedResults.map((res) => {
                    const topWinner = res.places?.[0]?.winners?.[0];
                    const firstLine = topWinner
                      ? `1st: ${topWinner.name} (${teamNames[topWinner.team] || topWinner.team})`
                      : 'Results published';
                    return (
                      <Link
                        key={res.id}
                        to={`/results?search=${encodeURIComponent(res.eventName || '')}`}
                        className="-mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-3.5 transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-slate-900">{res.eventName}</h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {catName(res.category)} · {res.stage} · {res.gender}
                          </p>
                          <p className="mt-1 truncate text-xs font-medium text-blue-700">{firstLine}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </Link>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-sm text-slate-400">No published results yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Paginated Public Schedule */}
        {modules.schedule !== false && sections.schedule !== false && (
          <section id="schedule" className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Program Schedule</h2>
                  <p className="text-xs text-slate-500">Upcoming and completed stage programs</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleView('upcoming');
                      setSchedulePage(1);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                      scheduleView === 'upcoming'
                        ? 'bg-blue-700 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Upcoming
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleView('previous');
                      setSchedulePage(1);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                      scheduleView === 'previous'
                        ? 'bg-blue-700 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Completed
                  </button>
                  <select
                    value={filterCategory}
                    onChange={(e) => {
                      setFilterCategory(e.target.value);
                      setSchedulePage(1);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                  >
                    <option value="">All Categories</option>
                    {scheduleCategories.map((c) => (
                      <option key={c} value={c}>
                        {catName(c)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterStage}
                    onChange={(e) => {
                      setFilterStage(e.target.value);
                      setSchedulePage(1);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                  >
                    <option value="">All Stages</option>
                    {scheduleStages.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => loadPublicData(true)}
                    disabled={refreshing}
                    title="Refresh festival data"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {pagedScheduleRows.length ? (
                  pagedScheduleRows.map((ev) => {
                    const isPublished = publishedIds.has(ev.id);
                    const isSubmitted = submittedEventIds.has(ev.id);
                    const stateLabel = isPublished
                      ? 'Result Published'
                      : isSubmitted
                      ? 'Judging Complete'
                      : 'Scheduled';
                    const stateColor = isPublished
                      ? 'text-emerald-700'
                      : isSubmitted
                      ? 'text-blue-700'
                      : 'text-slate-500';
                    return (
                      <div key={ev.id} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-slate-900">{ev.name}</h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {catName(ev.category)} · {ev.stage || 'On-Stage'} · {ev.gender || 'Both'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-4 text-xs sm:text-right">
                          <div>
                            <span className="font-mono-num font-semibold text-slate-800">
                              {ev.scheduleDate || 'Date TBD'} · {formatTime12h(ev.time)}
                            </span>
                            <span className="block text-slate-500">{ev.scheduleStage || 'Stage TBD'}</span>
                          </div>
                          <span className={`font-semibold whitespace-nowrap ${stateColor}`}>{stateLabel}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-8 text-center text-sm text-slate-400">
                    No {scheduleView} events match the selected filters.
                  </p>
                )}
              </div>

              {filteredScheduleRows.length > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <span className="font-mono-num">
                    Page {safeSchedulePage} of {totalSchedulePages} ({filteredScheduleRows.length} events)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safeSchedulePage <= 1}
                      onClick={() => setSchedulePage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={safeSchedulePage >= totalSchedulePages}
                      onClick={() => setSchedulePage((p) => Math.min(totalSchedulePages, p + 1))}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* About & Team Leaders */}
        {(modules.about !== false && sections.about !== false) ||
        (modules.leaders !== false && sections.leaders !== false) ? (
          <section id="about" className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-12">
              {modules.about !== false && sections.about !== false && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    About the Festival
                  </span>
                  <h2 className="mt-2 font-display text-xl font-bold text-slate-900">{branding.aboutSubtitle}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{branding.aboutText}</p>
                </div>
              )}

              {modules.leaders !== false && sections.leaders !== false && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="font-display text-lg font-bold text-slate-900">Team Leaders</h2>
                      <p className="text-xs text-slate-500">Institutional team coordinators</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {teamLeaders.length ? (
                      teamLeaders.map((l) => {
                        const color = teamColor(l.team, colors);
                        const initial = String(l.name || 'L')[0].toUpperCase();
                        return (
                          <div key={l.id} className="flex items-center gap-3.5 rounded-xl border border-slate-200 p-3.5">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 font-display text-sm font-bold text-slate-700">
                              {l.photoUrl ? (
                                <img
                                  src={l.photoUrl}
                                  alt={l.name}
                                  className="h-full w-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                initial
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-slate-900">{l.name}</h3>
                              <p className="truncate text-xs text-slate-500">
                                {l.role || 'Team Leader'} ·{' '}
                                <span className="font-semibold" style={{ color }}>
                                  {teamNames[l.team] || l.team || ''}
                                </span>
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="col-span-full py-6 text-center text-sm text-slate-400">
                        Team leader profiles will appear here once added.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* Gallery Section */}
        {modules.gallery !== false && sections.gallery !== false && (
          <section id="gallery" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Festival Gallery</h2>
                  <p className="text-xs text-slate-500">Moments from the festival grounds</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {galleryImages.length ? (
                  galleryImages.map((src, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLightboxIdx(idx)}
                      className="group aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                    >
                      <img
                        src={src}
                        alt={`Festival moment ${idx + 1}`}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ))
                ) : (
                  <p className="col-span-full py-6 text-center text-sm text-slate-400">
                    Gallery has not been published yet.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Mobile App Install & Package Downloads (PWA / APK / AAB) */}
        <section id="install-app" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">Install &amp; Download App</h2>
              <p className="text-xs text-slate-500">
                Choose instant PWA install, direct Android APK installer, or Google Play AAB bundle
              </p>
            </div>
            <div className="mt-4">
              <AppInstallFormats branding={branding} />
            </div>
          </div>
        </section>
      </main>

      {/* Gallery Lightbox */}
      {lightboxIdx !== null && galleryImages[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLightboxIdx(null);
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxIdx(null)}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
            <span>Close</span>
          </button>
          <button
            type="button"
            onClick={() => setLightboxIdx((lightboxIdx - 1 + galleryImages.length) % galleryImages.length)}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg bg-white/10 p-3 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <img
            src={galleryImages[lightboxIdx]}
            alt="Gallery preview"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            referrerPolicy="no-referrer"
          />
          <button
            type="button"
            onClick={() => setLightboxIdx((lightboxIdx + 1) % galleryImages.length)}
            aria-label="Next image"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-white/10 p-3 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      <EditorialFooter branding={branding} />
    </div>
  );
};
