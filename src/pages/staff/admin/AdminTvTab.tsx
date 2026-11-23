import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Plus, Save, Send, Trash2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { useDialog } from '../../../components/ui/DialogContext';
import { invalidateCache } from '../../../lib/dataCache';
import { getFirebaseState } from '../../../lib/firebase';
import { normalizeResultData } from '../../../lib/resultUtils';
import type { TvConfig } from '../../../types/festival';
import type { AdminActions, AdminState } from './types';

export const AdminTvTab: React.FC<{ state: AdminState; actions: AdminActions }> = ({ state, actions }) => {
  const { toast } = useDialog();
  const [saving, setSaving] = useState(false);

  const [cfg, setCfg] = useState<TvConfig>(() => ({
    ...state.tvConfig,
    ...state.tvControl,
    selectedResultIds: state.tvControl.selectedResultIds || state.tvControl.resultQueue || state.tvConfig.resultQueue || [],
    tickerText: state.tvConfig.ticker || state.tvConfig.tickerText || '',
    mode: state.tvControl.mode || state.tvControl.mediaMode || 'dashboard',
    mediaUrl: state.tvControl.mediaUrl || state.tvControl.videoUrl || state.tvControl.videoUrls?.[0] || state.tvControl.imageUrls?.[0] || '',
    announcements: state.tvConfig.announcements || [],
  }));

  useEffect(() => {
    const merged = { ...state.tvConfig, ...state.tvControl };
    setCfg({
      ...merged,
      selectedResultIds: merged.selectedResultIds || merged.resultQueue || [],
      tickerText: merged.ticker || merged.tickerText || '',
      mode: merged.mode || merged.mediaMode || 'dashboard',
      mediaUrl: merged.mediaUrl || merged.videoUrl || merged.videoUrls?.[0] || merged.imageUrls?.[0] || '',
      announcements: Array.isArray(merged.announcements) ? merged.announcements : [],
    });
  }, [state.tvConfig, state.tvControl]);

  const publishedResults = state.results
    .filter((r) => !r.status || r.status === 'published')
    .map((r) => normalizeResultData(r))
    .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0));

  const queueIds = cfg.selectedResultIds || [];

  const toggleQueue = (eid: string) => {
    const next = queueIds.includes(eid) ? queueIds.filter((x) => x !== eid) : [...queueIds, eid];
    setCfg({ ...cfg, selectedResultIds: next, resultQueue: next });
  };

  const moveQueue = (idx: number, dir: -1 | 1) => {
    const next = [...queueIds];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setCfg({ ...cfg, selectedResultIds: next, resultQueue: next });
  };

  const saveTv = async (live: boolean) => {
    const { db } = getFirebaseState();
    if (!db) return;
    setSaving(true);
    try {
      const now = Date.now();
      const modeVal = cfg.mode || cfg.mediaMode || 'dashboard';
      const controlPayload = {
        mode: modeVal,
        mediaMode: modeVal,
        animationStyle: cfg.animationStyle || 'spotlight',
        selectedResultIds: queueIds,
        resultQueue: queueIds,
        mediaUrl: cfg.mediaUrl || '',
        videoUrl: modeVal === 'video' ? cfg.mediaUrl || '' : '',
        videoUrls: modeVal === 'video' && cfg.mediaUrl ? [cfg.mediaUrl] : [],
        imageUrls: modeVal === 'image' && cfg.mediaUrl ? [cfg.mediaUrl] : [],
        mediaCaption: cfg.mediaCaption || '',
        rotationSec: Math.max(5, Number(cfg.rotationSec || 12)),
        updatedAt: now,
      };
      const cfgPayload = {
        title: cfg.title || '',
        subtitle: cfg.subtitle || '',
        badgeText: cfg.badgeText || 'LIVE',
        ticker: cfg.tickerText || '',
        tickerText: cfg.tickerText || '',
        announcements: (cfg.announcements || []).filter(Boolean),
        sections: { standings: cfg.show?.leaderboard !== false },
        show: {
          results: cfg.show?.results !== false,
          leaderboard: cfg.show?.leaderboard !== false,
        },
        background: cfg.background || { color: '#020617', imageUrl: '' },
        updatedAt: now,
      };

      if (live) {
        await Promise.all([
          setDoc(doc(db, 'settings', 'tv_config'), cfgPayload, { merge: true }),
          setDoc(doc(db, 'settings', 'tv_control'), controlPayload, { merge: true }),
        ]);
        invalidateCache('doc:settings/tv');
        await actions.refreshScopes(['tv'], true);
        toast('Live TV broadcast updated.', 'success');
      } else {
        await setDoc(doc(db, 'settings', 'tv_control_draft'), { ...cfgPayload, ...controlPayload });
        toast('TV draft saved.', 'success');
      }
    } catch (err: any) {
      toast(err?.message || 'Unable to save TV settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">TV Broadcast Control</h1>
          <p className="text-xs text-slate-500">Control stage TV display mode, queued results, ticker text, and media takeovers.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => saveTv(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Draft</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => saveTv(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send Live</span>
          </button>
          <ActionIconButton icon={ExternalLink} label="Open /tv display" onClick={() => window.open('/tv', '_blank', 'noopener')} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">Display &amp; Ticker</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Mode</label>
              <select
                value={cfg.mode || 'dashboard'}
                onChange={(e) => setCfg({ ...cfg, mode: e.target.value, mediaMode: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="dashboard">Results + Leaderboard</option>
                <option value="announcements">Announcements</option>
                <option value="youtube">YouTube Live</option>
                <option value="video">MP4 Video</option>
                <option value="image">Image Slide</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Rotation (sec)</label>
              <input
                type="number"
                min={5}
                value={cfg.rotationSec ?? 12}
                onChange={(e) => setCfg({ ...cfg, rotationSec: Number(e.target.value || 12) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Media URL (YouTube / Video / Image)</label>
            <input
              type="url"
              value={cfg.mediaUrl || ''}
              onChange={(e) => setCfg({ ...cfg, mediaUrl: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Ticker Banner Text</label>
            <input
              type="text"
              value={cfg.tickerText || ''}
              onChange={(e) => setCfg({ ...cfg, tickerText: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Announcements (One per line)</label>
            <textarea
              rows={3}
              value={(cfg.announcements || []).join('\n')}
              onChange={(e) => setCfg({ ...cfg, announcements: e.target.value.split(/\r?\n/) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
            Result Rotation Queue ({queueIds.length})
          </h2>
          {queueIds.length > 0 && (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {queueIds.map((eid, idx) => {
                const res = publishedResults.find((r) => (r.eventId || r.id) === eid);
                return (
                  <div key={eid} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="truncate font-semibold">
                      #{idx + 1} · {res?.eventName || eid}
                    </span>
                    <div className="flex items-center gap-1">
                      <ActionIconButton icon={ArrowUp} label="Move up" disabled={idx === 0} onClick={() => moveQueue(idx, -1)} />
                      <ActionIconButton
                        icon={ArrowDown}
                        label="Move down"
                        disabled={idx === queueIds.length - 1}
                        onClick={() => moveQueue(idx, 1)}
                      />
                      <ActionIconButton icon={Trash2} label="Remove" tone="danger" onClick={() => toggleQueue(eid)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {publishedResults.map((r) => {
              const eid = r.eventId || r.id;
              const on = queueIds.includes(eid);
              return (
                <div key={eid} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="truncate">{r.eventName}</span>
                  <ActionIconButton
                    icon={on ? Trash2 : Plus}
                    label={on ? 'Remove from queue' : 'Add to queue'}
                    tone={on ? 'danger' : 'primary'}
                    onClick={() => toggleQueue(eid)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
