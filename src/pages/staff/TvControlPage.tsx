import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ListOrdered,
  MonitorPlay,
  Palette,
  Plus,
  Radio,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, query, setDoc, where } from 'firebase/firestore';
import { WorkspaceShell, type WorkspaceNavItem } from '../../components/layout/WorkspaceShell';
import { ActionIconButton } from '../../components/ui/ActionIconButton';
import { useDialog } from '../../components/ui/DialogContext';
import { cachedGetDoc, cachedGetDocs, invalidateCache } from '../../lib/dataCache';
import { getFirebaseState } from '../../lib/firebase';
import { normalizeResultData } from '../../lib/resultUtils';
import { ADMIN_ROLES, resolveAuthenticatedProfile, routeForRole, signOutStaff } from '../../lib/staffAuth';
import type { AccessUser, ResultDoc, TvConfig } from '../../types/festival';

export const TvControlPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useDialog();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profile, setProfile] = useState<AccessUser | null>(null);
  const [activeTab, setActiveTab] = useState('broadcast');
  const [saving, setSaving] = useState(false);

  const [results, setResults] = useState<ResultDoc[]>([]);
  const [config, setConfig] = useState<TvConfig>({
    title: '',
    subtitle: '',
    badgeText: 'LIVE',
    tickerText: '',
    rotationSec: 12,
    mode: 'dashboard',
    mediaMode: 'dashboard',
    animationStyle: 'spotlight',
    resultOrder: 'latest',
    interruptPolicy: 'finish-cycle',
    afterQueue: 'loop',
    selectedResultIds: [],
    announcements: [],
    sections: { standings: true },
    show: { results: true, leaderboard: true },
    background: { color: '#020617', imageUrl: '' },
    mediaUrl: '',
    mediaCaption: '',
  });

  const loadTvData = useCallback(
    async (forceRefresh = false) => {
      const { db } = getFirebaseState();
      if (!db) return;
      if (forceRefresh) invalidateCache();
      try {
        const [tvCfg, tvLive, pubResults] = await Promise.all([
          cachedGetDoc<TvConfig>(db, 'settings', 'tv_config', { forceRefresh }),
          cachedGetDoc<TvConfig>(db, 'settings', 'tv_control', { forceRefresh }),
          cachedGetDocs<ResultDoc>(
            'results:published',
            query(collection(db, 'results'), where('status', '==', 'published')),
            { forceRefresh }
          ),
        ]);
        const merged = { ...tvCfg, ...tvLive };
        setConfig((prev) => ({
          ...prev,
          ...merged,
          selectedResultIds: merged.selectedResultIds || merged.resultQueue || [],
          tickerText: merged.ticker || merged.tickerText || '',
          mode: merged.mode || merged.mediaMode || 'dashboard',
          mediaMode: merged.mediaMode || merged.mode || 'dashboard',
          mediaUrl: merged.mediaUrl || merged.videoUrl || merged.videoUrls?.[0] || merged.imageUrls?.[0] || '',
          announcements: Array.isArray(merged.announcements) ? merged.announcements : [],
        }));
        setResults(
          pubResults
            .map((r) => normalizeResultData(r))
            .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0))
        );
      } catch (err: any) {
        toast(err?.message || 'Unable to load TV settings.', 'error');
      }
    },
    [toast]
  );

  useEffect(() => {
    document.title = 'TV Display Control — Feastport';
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
      setProfile(p);
      setCheckingAuth(false);
      loadTvData();
    });
    return () => unsub();
  }, [navigate, loadTvData]);

  const queueIds = config.selectedResultIds || [];

  const toggleResultInQueue = (eventId: string) => {
    setConfig((prev) => {
      const list = prev.selectedResultIds || [];
      const next = list.includes(eventId) ? list.filter((id) => id !== eventId) : [...list, eventId];
      return { ...prev, selectedResultIds: next, resultQueue: next };
    });
  };

  const moveQueueItem = (idx: number, dir: -1 | 1) => {
    const next = [...queueIds];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setConfig((prev) => ({ ...prev, selectedResultIds: next, resultQueue: next }));
  };

  const persistTv = async (target: 'draft' | 'live') => {
    const { db } = getFirebaseState();
    if (!db) return;
    setSaving(true);
    try {
      const now = Date.now();
      const modeValue = config.mode || config.mediaMode || 'dashboard';
      const controlPayload = {
        mode: modeValue,
        mediaMode: modeValue,
        animationStyle: config.animationStyle || 'spotlight',
        resultOrder: config.resultOrder || 'latest',
        interruptPolicy: config.interruptPolicy || 'finish-cycle',
        afterQueue: config.afterQueue || 'loop',
        selectedResultIds: queueIds,
        resultQueue: queueIds,
        mediaUrl: config.mediaUrl || '',
        videoUrl: modeValue === 'video' ? config.mediaUrl || '' : '',
        videoUrls: modeValue === 'video' && config.mediaUrl ? [config.mediaUrl] : [],
        imageUrls: modeValue === 'image' && config.mediaUrl ? [config.mediaUrl] : [],
        mediaCaption: config.mediaCaption || '',
        rotationSec: Math.max(5, Number(config.rotationSec || 12)),
        updatedAt: now,
      };

      const cfgPayload = {
        title: config.title || '',
        subtitle: config.subtitle || '',
        badgeText: config.badgeText || 'LIVE',
        ticker: config.tickerText || '',
        tickerText: config.tickerText || '',
        announcements: (config.announcements || []).filter(Boolean),
        sections: { standings: config.show?.leaderboard !== false },
        show: {
          results: config.show?.results !== false,
          leaderboard: config.show?.leaderboard !== false,
        },
        background: config.background || { color: '#020617', imageUrl: '' },
        updatedAt: now,
      };

      if (target === 'draft') {
        await setDoc(doc(db, 'settings', 'tv_control_draft'), { ...cfgPayload, ...controlPayload });
        toast('TV control draft saved.', 'success');
      } else {
        await Promise.all([
          setDoc(doc(db, 'settings', 'tv_config'), cfgPayload, { merge: true }),
          setDoc(doc(db, 'settings', 'tv_control'), controlPayload, { merge: true }),
        ]);
        invalidateCache('doc:settings/tv');
        toast('Live TV display updated.', 'success');
      }
    } catch (err: any) {
      toast(err?.message || 'Failed to update TV settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-xs font-medium text-slate-500">
        Verifying administrator access…
      </div>
    );
  }

  const navItems: WorkspaceNavItem[] = [
    { id: 'broadcast', label: 'Broadcast Mode', icon: MonitorPlay },
    { id: 'queue', label: 'Result Queue', icon: ListOrdered, badge: queueIds.length },
    { id: 'ticker', label: 'Ticker & Notices', icon: Radio },
    { id: 'theme', label: 'Visual Theme', icon: Palette },
  ];

  return (
    <WorkspaceShell
      portalTitle="TV Display Control"
      portalSubtitle="Stage Screen Broadcast"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userLabel={profile?.displayName || profile?.username || 'Admin'}
      userSublabel="Broadcast Controller"
      onLogout={async () => {
        await signOutStaff();
        navigate('/login', { replace: true });
      }}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => persistTv('draft')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Draft</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => persistTv('live')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send Live</span>
          </button>
          <ActionIconButton
            icon={ExternalLink}
            label="Open Live TV screen"
            onClick={() => navigate('/tv')}
          />
        </div>
      }
    >
      {activeTab === 'broadcast' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-bold text-slate-900">Screen Mode &amp; Playback</h2>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Active Display Mode</label>
              <select
                value={config.mode || 'dashboard'}
                onChange={(e) => setConfig({ ...config, mode: e.target.value, mediaMode: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
              >
                <option value="dashboard">Results Spotlight + Leaderboard</option>
                <option value="announcements">Full-Screen Announcements</option>
                <option value="youtube">YouTube Live / Video Embed</option>
                <option value="video">Direct MP4 Video</option>
                <option value="image">Image Slide</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Rotation Interval (sec)</label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={config.rotationSec ?? 12}
                  onChange={(e) => setConfig({ ...config, rotationSec: Number(e.target.value || 12) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Spotlight Animation</label>
                <select
                  value={config.animationStyle || 'spotlight'}
                  onChange={(e) => setConfig({ ...config, animationStyle: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="spotlight">Spotlight Fade</option>
                  <option value="ticker-rise">Ticker Rise</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Media URL (YouTube / Video / Image)
              </label>
              <input
                type="url"
                value={config.mediaUrl || ''}
                onChange={(e) => setConfig({ ...config, mediaUrl: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Media Caption (Optional)</label>
              <input
                type="text"
                value={config.mediaCaption || ''}
                onChange={(e) => setConfig({ ...config, mediaCaption: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-bold text-slate-900">Visible Panels</h2>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs font-semibold">
              <span>Show Result Spotlight Card</span>
              <input
                type="checkbox"
                checked={config.show?.results !== false}
                onChange={(e) =>
                  setConfig({ ...config, show: { ...(config.show || {}), results: e.target.checked } })
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs font-semibold">
              <span>Show Team Standings Leaderboard</span>
              <input
                type="checkbox"
                checked={config.show?.leaderboard !== false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    show: { ...(config.show || {}), leaderboard: e.target.checked },
                    sections: { ...(config.sections || {}), standings: e.target.checked },
                  })
                }
              />
            </label>
          </section>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-bold text-slate-900">Published Results</h2>
            <p className="mt-0.5 text-xs text-slate-500">Add or remove published events in the rotation queue.</p>
            <div className="mt-3 max-h-[460px] divide-y divide-slate-100 overflow-y-auto">
              {results.map((r) => {
                const eid = r.eventId || r.id;
                const inQueue = queueIds.includes(eid);
                return (
                  <div key={eid} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">{r.eventName}</p>
                      <p className="text-[11px] text-slate-500">
                        {r.category} · {r.stage}
                      </p>
                    </div>
                    <ActionIconButton
                      icon={inQueue ? Trash2 : Plus}
                      label={inQueue ? 'Remove from queue' : 'Add to queue'}
                      tone={inQueue ? 'danger' : 'primary'}
                      onClick={() => toggleResultInQueue(eid)}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-bold text-slate-900">Active Rotation Queue</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Leave empty to rotate latest 8 published results automatically.
            </p>
            <div className="mt-3 divide-y divide-slate-100">
              {queueIds.length ? (
                queueIds.map((eid, idx) => {
                  const res = results.find((r) => (r.eventId || r.id) === eid);
                  return (
                    <div key={eid} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          <span className="mr-2 font-mono-num text-slate-400">#{idx + 1}</span>
                          {res?.eventName || eid}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <ActionIconButton
                          icon={ArrowUp}
                          label="Move up"
                          disabled={idx === 0}
                          onClick={() => moveQueueItem(idx, -1)}
                        />
                        <ActionIconButton
                          icon={ArrowDown}
                          label="Move down"
                          disabled={idx === queueIds.length - 1}
                          onClick={() => moveQueueItem(idx, 1)}
                        />
                        <ActionIconButton
                          icon={Trash2}
                          label="Remove"
                          tone="danger"
                          onClick={() => toggleResultInQueue(eid)}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="py-10 text-center text-xs text-slate-400">
                  Automatic latest-results mode active.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'ticker' && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-base font-bold text-slate-900">Header, Ticker &amp; Announcements</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Screen Title Override</label>
              <input
                type="text"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Subtitle</label>
              <input
                type="text"
                value={config.subtitle || ''}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Status Badge Text</label>
              <input
                type="text"
                value={config.badgeText || ''}
                onChange={(e) => setConfig({ ...config, badgeText: e.target.value })}
                placeholder="LIVE"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Bottom Ticker Text</label>
            <input
              type="text"
              value={config.tickerText || ''}
              onChange={(e) => setConfig({ ...config, tickerText: e.target.value })}
              placeholder="Participants report to Stage 1 15 minutes before event start."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Full-Screen Announcements (One per line)
            </label>
            <textarea
              rows={5}
              value={(config.announcements || []).join('\n')}
              onChange={(e) => setConfig({ ...config, announcements: e.target.value.split(/\r?\n/) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
        </div>
      )}

      {activeTab === 'theme' && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-base font-bold text-slate-900">Screen Background</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Background Color</label>
              <input
                type="color"
                value={config.background?.color || '#020617'}
                onChange={(e) =>
                  setConfig({ ...config, background: { ...(config.background || {}), color: e.target.value } })
                }
                className="h-10 w-24 rounded-lg border border-slate-300 p-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Background Image URL</label>
              <input
                type="url"
                value={config.background?.imageUrl || ''}
                onChange={(e) =>
                  setConfig({ ...config, background: { ...(config.background || {}), imageUrl: e.target.value } })
                }
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
};
