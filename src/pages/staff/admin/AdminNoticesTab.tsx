import React, { useState } from 'react';
import { Megaphone, Send, Trash2 } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { useDialog } from '../../../components/ui/DialogContext';
import { getFirebaseState } from '../../../lib/firebase';
import { resolveDisplayName } from '../../../lib/resultUtils';
import type { AdminActions, AdminState } from './types';

export const AdminNoticesTab: React.FC<{ state: AdminState; actions: AdminActions }> = ({ state, actions }) => {
  const { toast, confirm } = useDialog();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [team, setTeam] = useState('All');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [sending, setSending] = useState(false);

  const teams = state.general.teams || [];
  const teamLabel = (k: string) => (k === 'All' ? 'All Teams' : resolveDisplayName(state.general.teamDisplayNames, k, k));

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const { db, auth } = getFirebaseState();
    if (!db || !auth?.currentUser) return;
    if (!title.trim() || !message.trim()) return toast('Enter both title and message.', 'error');
    setSending(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        title: title.trim(),
        message: message.trim(),
        team,
        priority,
        createdAt: Date.now(),
        createdByUid: auth.currentUser.uid,
      });
      setTitle('');
      setMessage('');
      await actions.refreshScopes(['notices'], true);
      toast('Notice broadcast sent.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to send notice.', 'error');
    } finally {
      setSending(false);
    }
  };

  const removeNotice = async (id: string) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const ok = await confirm('Delete this notice?', { title: 'Delete Notice', okLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
      await actions.refreshScopes(['notices'], true);
      toast('Notice deleted.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Delete failed.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Notices &amp; Alerts</h1>
        <p className="text-xs text-slate-500">Broadcast targeted notices to Team Leaders across the festival.</p>
      </div>

      <form
        onSubmit={handleSend}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold">Notice Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Call for Stage 1 Participants"
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Target</label>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="All">All Teams</option>
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {teamLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold">Message *</label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{sending ? 'Sending…' : 'Broadcast Notice'}</span>
          </button>
        </div>
      </form>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {state.notices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No notices dispatched yet.</div>
        ) : (
          state.notices.map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-3 px-4 py-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Megaphone className={`mt-0.5 h-4 w-4 shrink-0 ${n.priority === 'urgent' ? 'text-red-600' : 'text-blue-700'}`} />
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    {n.title}{' '}
                    <span className="font-normal text-slate-400">· {teamLabel(n.team)}</span>
                  </p>
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300">{n.message}</p>
                </div>
              </div>
              <ActionIconButton icon={Trash2} label="Delete notice" tone="danger" onClick={() => removeNotice(n.id)} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
