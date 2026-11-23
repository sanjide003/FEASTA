import React, { useEffect, useMemo, useState } from 'react';
import { Maximize2, Minimize2, Radio } from 'lucide-react';
import { brandingName, normalizeBranding } from '../../lib/branding';
import { eventContributesToTeamScore, normalizeFestSetup, teamColor } from '../../lib/festConfig';
import { getFirebaseState } from '../../lib/firebase';
import { normalizeResultData, resolveDisplayName } from '../../lib/resultUtils';
import { buildTeamScoreLedger } from '../../lib/scoreUtils';
import { signInAnonymously } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import type { BrandingConfig, GeneralConfig, ResultDoc, TvConfig } from '../../types/festival';

function extractYoutubeId(url = ''): string {
  const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
}

export const TvDisplayPage: React.FC = () => {
  const [tvConfig, setTvConfig] = useState<TvConfig>({});
  const [tvControl, setTvControl] = useState<Record<string, any>>({});
  const [branding, setBranding] = useState<BrandingConfig>(() => normalizeBranding());
  const [general, setGeneral] = useState<GeneralConfig>({});
  const [publishedResults, setPublishedResults] = useState<ResultDoc[]>([]);
  const [nowStr, setNowStr] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [queueIdx, setQueueIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowStr(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    };
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  useEffect(() => {
    const { auth, db, isFirebaseConfigured } = getFirebaseState();
    if (!isFirebaseConfigured || !db) return;

    if (auth && !auth.currentUser) {
      signInAnonymously(auth).catch(() => {});
    }

    const unsubs = [
      onSnapshot(doc(db, 'settings', 'tv_config'), (snap) => {
        if (snap.exists()) setTvConfig(snap.data() as TvConfig);
      }),
      onSnapshot(doc(db, 'settings', 'tv_control'), (snap) => {
        if (snap.exists()) setTvControl(snap.data() as Record<string, any>);
      }),
      onSnapshot(doc(db, 'settings', 'home_config'), (snap) => {
        if (snap.exists()) setBranding(normalizeBranding(snap.data() as Partial<BrandingConfig>));
      }),
      onSnapshot(doc(db, 'settings', 'general'), (snap) => {
        if (snap.exists()) setGeneral(snap.data() as GeneralConfig);
      }),
      onSnapshot(query(collection(db, 'results'), where('status', '==', 'published')), (snap) => {
        setPublishedResults(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      }),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, []);

  const effective = useMemo<TvConfig>(() => ({ ...tvConfig, ...tvControl }), [tvConfig, tvControl]);
  const rotationSec = Math.max(5, Number(effective.rotationSec || effective.refreshIntervalSec || 12));

  const normalizedResults = useMemo(() => {
    return publishedResults
      .map((r) => normalizeResultData(r))
      .sort((a, b) => Number(b.publishedAt || b.updatedAt || 0) - Number(a.publishedAt || a.updatedAt || 0));
  }, [publishedResults]);

  const queueIds = useMemo(() => {
    if (Array.isArray(effective.selectedResultIds) && effective.selectedResultIds.length) {
      return effective.selectedResultIds;
    }
    if (Array.isArray(effective.resultQueue) && effective.resultQueue.length) {
      return effective.resultQueue;
    }
    return [];
  }, [effective.selectedResultIds, effective.resultQueue]);

  const queuedResults = useMemo(() => {
    if (!queueIds.length) return normalizedResults.slice(0, 8);
    const matched = queueIds
      .map((id) => normalizedResults.find((r) => (r.eventId || r.id) === id))
      .filter(Boolean) as ResultDoc[];
    return matched.length ? matched : normalizedResults.slice(0, 8);
  }, [queueIds, normalizedResults]);

  useEffect(() => {
    if (queuedResults.length <= 1) return;
    const t = setInterval(() => {
      setQueueIdx((prev) => (prev + 1) % queuedResults.length);
    }, rotationSec * 1000);
    return () => clearInterval(t);
  }, [queuedResults.length, rotationSec]);

  useEffect(() => {
    document.title = `Live TV — ${brandingName(branding)}`;
  }, [branding]);

  const teamNames = general.teamDisplayNames || {};
  const colors = general.teamColors || {};
  const teams = general.teams || [];

  const teamStandings = useMemo(() => {
    const scoreMap = new Map<string, number>(teams.map((t) => [t, 0]));
    const ledger = buildTeamScoreLedger(
      publishedResults,
      (winnerId, _type, res) => res?.winnerDetails?.[winnerId]?.team || '',
      []
    );
    ledger.forEach((entry) => {
      scoreMap.set(entry.team, (scoreMap.get(entry.team) || 0) + Number(entry.points || 0));
    });
    return [...scoreMap.entries()]
      .map(([team, points]) => ({ team, name: teamNames[team] || team, color: teamColor(team, colors), points }))
      .sort((a, b) => b.points - a.points);
  }, [teams, publishedResults, teamNames, colors]);

  const maxPts = Math.max(1, ...teamStandings.map((t) => t.points));
  const activeResult = queuedResults[queueIdx % Math.max(1, queuedResults.length)];

  const rawMode = String(effective.mode || effective.mediaMode || 'dashboard');
  const mediaMode =
    rawMode === 'results' || rawMode === 'standings' || rawMode === 'auto' ? 'dashboard' : rawMode;
  const primaryMediaUrl =
    effective.mediaUrl ||
    effective.videoUrl ||
    (Array.isArray(effective.videoUrls) ? effective.videoUrls[0] : '') ||
    (Array.isArray(effective.imageUrls) ? effective.imageUrls[0] : '') ||
    '';
  const ytId = extractYoutubeId(primaryMediaUrl);
  const tickerText = effective.ticker || effective.tickerText || '';
  const showStandings =
    effective.sections?.standings !== false &&
    effective.show?.leaderboard !== false &&
    effective.content?.leaderboard !== false;
  const showSpotlight =
    effective.show?.results !== false && effective.content?.results !== false;
  const announcementsList = Array.isArray(effective.announcements) ? effective.announcements.filter(Boolean) : [];
  const bgStyle: React.CSSProperties = {
    backgroundColor: effective.background?.color || '#020617',
    ...(effective.background?.imageUrl
      ? {
          backgroundImage: `linear-gradient(rgba(2,6,23,0.78), rgba(2,6,23,0.86)), url(${effective.background.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {}),
  };

  const animClass =
    effective.animationStyle === 'ticker-rise' || effective.animationStyle === 'ticker-slide'
      ? 'animate-tv-ticker'
      : 'animate-tv-spotlight';

  const catName = (k: unknown) => resolveDisplayName(general.categoryDisplayNames, k, 'General');

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  return (
    <div className="flex min-h-screen flex-col text-slate-100" style={bgStyle}>
      {/* Broadcast Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={brandingName(branding)}
              className="h-10 w-10 rounded-lg border border-slate-700 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-display text-sm font-bold text-white">
              FP
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold text-white">
              {effective.title || brandingName(branding)}
            </h1>
            <p className="truncate text-xs text-slate-400">
              {effective.subtitle || branding.tagline || 'Official Live Broadcast Display'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <Radio className="h-3.5 w-3.5" />
            <span>{effective.badgeText || 'LIVE'}</span>
          </div>
          <span className="font-mono-num text-lg font-bold text-white">{nowStr}</span>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Broadcast Stage */}
      <main className="flex-1 p-6">
        {(mediaMode === 'youtube' || ytId) && ytId ? (
          <div className="mx-auto flex h-[calc(100vh-12rem)] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-black">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&rel=0`}
              title="Festival Live Broadcast"
              allow="autoplay; encrypted-media; fullscreen"
            />
          </div>
        ) : mediaMode === 'video' && primaryMediaUrl ? (
          <div className="mx-auto flex h-[calc(100vh-12rem)] max-w-6xl overflow-hidden rounded-2xl border border-slate-800 bg-black">
            <video src={primaryMediaUrl} autoPlay loop muted controls className="h-full w-full object-contain" />
          </div>
        ) : mediaMode === 'image' && primaryMediaUrl ? (
          <div className="mx-auto flex h-[calc(100vh-12rem)] max-w-6xl flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <img
              src={primaryMediaUrl}
              alt={effective.mediaCaption || 'Festival Broadcast'}
              className="max-h-full max-w-full rounded-xl object-contain"
              referrerPolicy="no-referrer"
            />
            {effective.mediaCaption && (
              <p className="mt-3 text-sm font-medium text-slate-300">{effective.mediaCaption}</p>
            )}
          </div>
        ) : mediaMode === 'announcements' && announcementsList.length ? (
          <div className="mx-auto flex max-w-5xl flex-col justify-center gap-4 py-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">Official Announcements</p>
            {announcementsList.map((text, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/90 px-8 py-6">
                <p className="font-display text-2xl font-bold text-white">{text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12">
            {/* Spotlight Result Showcase */}
            {showSpotlight && (
              <section
                key={activeResult?.id || 'empty'}
                className={`rounded-2xl border border-slate-800 bg-slate-900/90 p-7 ${
                  showStandings ? 'lg:col-span-7' : 'lg:col-span-12'
                } ${animClass}`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                      Official Result Spotlight
                    </span>
                    <h2 className="mt-1 font-display text-3xl font-bold text-white">
                      {activeResult?.eventName || 'Awaiting Next Result'}
                    </h2>
                    {activeResult && (
                      <p className="mt-1 text-sm text-slate-400">
                        {catName(activeResult.category)} · {activeResult.stage} · {activeResult.gender}
                      </p>
                    )}
                  </div>
                  {queuedResults.length > 1 && (
                    <span className="font-mono-num text-xs text-slate-500">
                      {(queueIdx % queuedResults.length) + 1} / {queuedResults.length}
                    </span>
                  )}
                </div>

                <div className="mt-6 space-y-4">
                  {activeResult?.places?.length ? (
                    activeResult.places.map((p) => (
                      <div
                        key={p.key}
                        className="rounded-xl border border-slate-800 bg-slate-950/70 px-5 py-4"
                      >
                        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-amber-300">
                          <span className="font-bold">{p.label}</span>
                          <span className="font-mono-num font-bold">
                            +{Number(p.earnedValue ?? p.value ?? 0)} pts
                          </span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {(p.winners || []).map((w: any, wIdx: number) => (
                            <div key={w.id || wIdx} className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <span
                                  className="h-3 w-3 shrink-0 rounded-full"
                                  style={{ background: teamColor(w.team, colors) }}
                                />
                                <span className="truncate font-display text-xl font-bold text-white">{w.name}</span>
                                {w.chestNo && (
                                  <span className="font-mono-num text-sm text-slate-400">#{w.chestNo}</span>
                                )}
                              </div>
                              <span className="shrink-0 text-sm font-semibold text-slate-300">
                                {teamNames[w.team] || w.team}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-16 text-center text-sm text-slate-500">
                      Published competition results will display here automatically.
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Team Standings Leaderboard */}
            {showStandings && (
              <section
                className={`rounded-2xl border border-slate-800 bg-slate-900/90 p-7 ${
                  showSpotlight ? 'lg:col-span-5' : 'lg:col-span-12'
                }`}
              >
                <div className="border-b border-slate-800 pb-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                    Live Standings
                  </span>
                  <h2 className="mt-1 font-display text-2xl font-bold text-white">Team Leaderboard</h2>
                </div>
                <div className="mt-6 space-y-5">
                  {teamStandings.map((t, idx) => (
                    <div key={t.team} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-6 font-mono-num text-sm font-bold text-slate-400">#{idx + 1}</span>
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} />
                          <span className="truncate font-display text-lg font-bold text-white">{t.name}</span>
                        </div>
                        <span className="font-mono-num text-xl font-bold text-white">{t.points}</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.round((t.points / maxPts) * 100)}%`, background: t.color }}
                        />
                      </div>
                    </div>
                  ))}
                  {teamStandings.length === 0 && (
                    <p className="py-10 text-center text-sm text-slate-500">No teams configured yet.</p>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Bottom Ticker */}
      {tickerText && (
        <div className="border-t border-slate-800 bg-blue-950/80 px-6 py-2.5 text-sm font-semibold text-blue-100">
          {tickerText}
        </div>
      )}
    </div>
  );
};
