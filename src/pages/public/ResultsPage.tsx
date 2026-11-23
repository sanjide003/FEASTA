import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
import { EditorialFooter, EditorialHeader } from '../../components/layout/EditorialShell';
import { CompactDataTable } from '../../components/ui/CompactDataTable';
import { brandingName, cacheBranding, clearBrandingCache, normalizeBranding, readCachedBranding } from '../../lib/branding';
import { cachedGetDoc, cachedGetDocs, invalidateCache } from '../../lib/dataCache';
import { eventContributesToTeamScore, normalizeFestSetup, teamColor } from '../../lib/festConfig';
import { getFirebaseState } from '../../lib/firebase';
import { normalizeResultData, resolveDisplayName } from '../../lib/resultUtils';
import { buildTeamScoreLedger } from '../../lib/scoreUtils';
import { collection, query, where } from 'firebase/firestore';
import type { BrandingConfig, FestEvent, FestSetup, GeneralConfig, ResultDoc } from '../../types/festival';

export const ResultsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [branding, setBranding] = useState<BrandingConfig>(() => readCachedBranding());
  const [general, setGeneral] = useState<GeneralConfig>({});
  const [festSetup, setFestSetup] = useState<FestSetup>(() => normalizeFestSetup());
  const [events, setEvents] = useState<FestEvent[]>([]);
  const [publishedResults, setPublishedResults] = useState<ResultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState<'result' | 'team'>(searchParams.get('tab') === 'team' ? 'team' : 'result');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  const loadData = useCallback(async (forceRefresh = false) => {
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
      const [homeDoc, genDoc, evList, resList] = await Promise.all([
        cachedGetDoc<BrandingConfig>(db, 'settings', 'home_config', { ttlMs: 300_000, forceRefresh }),
        cachedGetDoc<GeneralConfig>(db, 'settings', 'general', { ttlMs: 300_000, forceRefresh }),
        cachedGetDocs<FestEvent>('col:events', collection(db, 'events'), { ttlMs: 120_000, forceRefresh }),
        cachedGetDocs<ResultDoc>(
          'col:results:published',
          query(collection(db, 'results'), where('status', '==', 'published')),
          { ttlMs: 60_000, forceRefresh }
        ),
      ]);
      if (homeDoc) setBranding(cacheBranding(homeDoc));
      else {
        clearBrandingCache();
        setBranding(normalizeBranding());
      }
      const gen: GeneralConfig = genDoc || {};
      setGeneral(gen);
      setFestSetup(normalizeFestSetup(gen.festSetup || {}));
      setEvents(evList || []);
      setPublishedResults(resList || []);
    } catch (err) {
      console.warn('Results load fallback:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    document.title = `Results — ${brandingName(branding)}`;
  }, [branding]);

  const catName = useCallback(
    (k: unknown) => resolveDisplayName(general.categoryDisplayNames, k, 'General'),
    [general.categoryDisplayNames]
  );
  const teamNames = general.teamDisplayNames || {};
  const colors = general.teamColors || {};
  const teams = general.teams || [];

  const normalizedResults = useMemo(() => {
    return publishedResults
      .map((r) => normalizeResultData(r, { events }))
      .sort((a, b) => Number(b.publishedAt || b.updatedAt || 0) - Number(a.publishedAt || a.updatedAt || 0));
  }, [publishedResults, events]);

  const categories = useMemo(
    () => [...new Set(normalizedResults.map((r) => r.category).filter(Boolean))].sort(),
    [normalizedResults]
  );

  const filteredResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return normalizedResults.filter((r) => {
      if (categoryFilter && r.category !== categoryFilter) return false;
      if (stageFilter && r.stage !== stageFilter) return false;
      if (genderFilter && r.gender !== genderFilter) return false;
      if (!q) return true;
      const winnerStr = (r.places || [])
        .flatMap((p) => p.winners || [])
        .map((w: any) => `${w.name || ''} ${w.team || ''} ${teamNames[w.team] || ''} ${w.chestNo || ''}`)
        .join(' ');
      return `${r.eventName} ${r.category} ${catName(r.category)} ${winnerStr}`.toLowerCase().includes(q);
    });
  }, [normalizedResults, searchTerm, categoryFilter, stageFilter, genderFilter, teamNames, catName]);

  const teamScoreRows = useMemo(() => {
    const scoreMap = new Map<string, number>(teams.map((t) => [t, 0]));
    const medalsMap = new Map<string, { first: number; second: number; third: number; grades: number }>(
      teams.map((t) => [t, { first: 0, second: 0, third: 0, grades: 0 }])
    );
    const byCatMap = new Map<string, Record<string, number>>();
    teams.forEach((t) => byCatMap.set(t, {}));

    const scoringEvents = events.filter((e) => eventContributesToTeamScore(e, festSetup));
    const ledger = buildTeamScoreLedger(
      publishedResults,
      (winnerId, _type, res) => res?.winnerDetails?.[winnerId]?.team || '',
      scoringEvents
    );

    ledger.forEach((entry) => {
      scoreMap.set(entry.team, (scoreMap.get(entry.team) || 0) + Number(entry.points || 0));
      const res = publishedResults.find((r) => (r.eventId || r.id) === entry.eventId);
      const cat = res?.category || 'General';
      if (!byCatMap.has(entry.team)) byCatMap.set(entry.team, {});
      const rec = byCatMap.get(entry.team)!;
      rec[cat] = (rec[cat] || 0) + Number(entry.points || 0);
    });

    normalizedResults.forEach((res) => {
      (res.places || []).forEach((p) => {
        (p.winners || []).forEach((w: any) => {
          const team = w.team;
          if (!team || team === '-') return;
          const m = medalsMap.get(team) || { first: 0, second: 0, third: 0, grades: 0 };
          if (p.rank === 1) m.first += 1;
          else if (p.rank === 2) m.second += 1;
          else if (p.rank === 3) m.third += 1;
          medalsMap.set(team, m);
        });
      });
      (res.gradeAwards || []).forEach((g) => {
        (g.winners || []).forEach((w: any) => {
          const team = w.team;
          if (!team || team === '-') return;
          const m = medalsMap.get(team) || { first: 0, second: 0, third: 0, grades: 0 };
          m.grades += 1;
          medalsMap.set(team, m);
        });
      });
    });

    return [...scoreMap.entries()]
      .map(([team, points]) => ({
        team,
        name: teamNames[team] || team,
        color: teamColor(team, colors),
        points,
        medals: medalsMap.get(team) || { first: 0, second: 0, third: 0, grades: 0 },
        byCat: byCatMap.get(team) || {},
      }))
      .sort((a, b) => b.points - a.points || b.medals.first - a.medals.first);
  }, [teams, events, festSetup, publishedResults, normalizedResults, teamNames, colors]);

  const maxPoints = Math.max(1, ...teamScoreRows.map((t) => t.points));
  const allResultCategories = useMemo(
    () => [...new Set(normalizedResults.map((r) => r.category || 'General'))],
    [normalizedResults]
  );

  const handleTabSwitch = (nextTab: 'result' | 'team') => {
    setTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'team') nextParams.set('tab', 'team');
    else nextParams.delete('tab');
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      <EditorialHeader branding={branding} publicModules={festSetup.publicModules} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Official Results</p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Competition Results &amp; Standings
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Verified event outcomes and live cumulative team standings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => handleTabSwitch('result')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  tab === 'result' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Event Results
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch('team')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  tab === 'team' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Team Standings
              </button>
            </div>
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh results"
              aria-label="Refresh results"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {tab === 'result' ? (
          <div className="mt-6 space-y-5">
            {/* Filter Toolbar */}
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search event, winner, chest no…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                />
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c as string}>
                    {catName(c)}
                  </option>
                ))}
              </select>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="">All Stages</option>
                <option value="On-Stage">On-Stage</option>
                <option value="Off-Stage">Off-Stage</option>
              </select>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="">All Genders</option>
                <option value="Boys">Boys</option>
                <option value="Girls">Girls</option>
                <option value="Both">Both</option>
              </select>
            </div>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white p-5" />
                ))}
              </div>
            ) : filteredResults.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredResults.map((res) => {
                  const gMap = new Map<string, string>();
                  (res.gradeAwards || []).forEach((g) => {
                    (g.winners || []).forEach((w: any) => {
                      const wid = typeof w === 'string' ? w : w?.id;
                      if (wid && !gMap.has(wid)) gMap.set(wid, g.label);
                    });
                  });
                  return (
                    <article key={res.id} className="rounded-xl border border-slate-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="min-w-0">
                          <h2 className="truncate font-display text-base font-bold text-slate-900">{res.eventName}</h2>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {catName(res.category)} · {res.stage} · {res.gender} · {res.type}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono-num text-xs font-semibold text-emerald-700">Published</span>
                      </div>

                      <div className="mt-3 divide-y divide-slate-100">
                        {(res.places || []).map((place) => {
                          const pts = Number(place.earnedValue ?? place.value ?? 0);
                          return (
                            <div key={place.key} className="py-2.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800">{place.label}</span>
                                {pts > 0 && <span className="font-mono-num font-semibold text-blue-700">+{pts} pts</span>}
                              </div>
                              <div className="mt-1 space-y-1">
                                {(place.winners || []).map((w: any, wIdx: number) => {
                                  const color = teamColor(w.team, colors);
                                  const gLabel = gMap.get(w.id);
                                  return (
                                    <div key={w.id || wIdx} className="flex items-center justify-between gap-2 text-xs">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                                        <span className="truncate font-semibold text-slate-900">{w.name}</span>
                                        {w.chestNo && (
                                          <span className="font-mono-num text-[11px] text-slate-400">#{w.chestNo}</span>
                                        )}
                                      </div>
                                      <span className="shrink-0 text-[11px] text-slate-600">
                                        {teamNames[w.team] || w.team}
                                        {gLabel ? ` · ${gLabel}` : ''}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {(res.places || []).length === 0 && (
                          <p className="py-4 text-xs text-slate-400">No position winners recorded.</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                No published results match your search criteria.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Horizontal Bar Standings */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-display text-lg font-bold text-slate-900">Overall Team Standings</h2>
              <p className="text-xs text-slate-500">Cumulative points across all published scoring events</p>
              <div className="mt-5 space-y-4">
                {teamScoreRows.map((row, idx) => (
                  <div key={row.team} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 font-mono-num text-xs font-bold text-slate-400">#{idx + 1}</span>
                        <span className="h-3 w-3 rounded-full" style={{ background: row.color }} />
                        <span className="font-semibold text-slate-900">{row.name}</span>
                        <span className="hidden text-xs text-slate-400 sm:inline">
                          · {row.medals.first}G · {row.medals.second}S · {row.medals.third}B
                        </span>
                      </div>
                      <span className="font-mono-num font-bold text-slate-900">{row.points} pts</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.round((row.points / maxPoints) * 100)}%`, background: row.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Breakdown Compact Table */}
            <CompactDataTable
              rows={teamScoreRows}
              rowKey={(r) => r.team}
              paginate={false}
              emptyTitle="No team scores recorded"
              emptyDescription="Points will populate once results are published."
              columns={[
                {
                  key: 'rank',
                  header: 'Rank',
                  render: (_r, i) => <span className="font-mono-num font-bold text-slate-500">#{i + 1}</span>,
                },
                {
                  key: 'team',
                  header: 'Team',
                  render: (r) => (
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                      <span className="font-semibold text-slate-900">{r.name}</span>
                    </div>
                  ),
                },
                {
                  key: 'medals',
                  header: '1st / 2nd / 3rd',
                  align: 'center',
                  render: (r) => (
                    <span className="font-mono-num text-slate-700">
                      {r.medals.first} / {r.medals.second} / {r.medals.third}
                    </span>
                  ),
                },
                ...allResultCategories.map((cat) => ({
                  key: `cat_${cat}`,
                  header: catName(cat),
                  align: 'right' as const,
                  render: (r: any) => <span className="font-mono-num text-slate-600">{r.byCat[cat] || 0}</span>,
                })),
                {
                  key: 'total',
                  header: 'Total Pts',
                  align: 'right',
                  render: (r) => <span className="font-mono-num font-bold text-blue-700">{r.points}</span>,
                },
              ]}
            />
          </div>
        )}
      </main>

      <EditorialFooter branding={branding} />
    </div>
  );
};
