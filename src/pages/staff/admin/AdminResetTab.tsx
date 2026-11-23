import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useDialog } from '../../../components/ui/DialogContext';
import { invalidateCache } from '../../../lib/dataCache';
import { getFirebaseState } from '../../../lib/firebase';
import { resolveDisplayName } from '../../../lib/resultUtils';
import type { AdminActions, AdminState } from './types';

export const AdminResetTab: React.FC<{ state: AdminState; actions: AdminActions }> = ({ state, actions }) => {
  const { toast, confirm } = useDialog();
  const [busyScope, setBusyScope] = useState('');
  const [teamTarget, setTeamTarget] = useState(state.general.teams?.[0] || '');

  const teams = state.general.teams || [];
  const teamLabel = (k: string) => resolveDisplayName(state.general.teamDisplayNames, k, k);

  const wipeCollection = async (colName: string, docsToDelete: Array<{ id: string; data: any }>) => {
    const { db } = getFirebaseState();
    if (!db || !docsToDelete.length) return 0;

    // Backup up to 100 docs before wipe
    if (colName !== 'deletedBackups' && colName !== 'auditLogs') {
      await addDoc(collection(db, 'deletedBackups'), {
        sourceCollection: colName,
        count: docsToDelete.length,
        snapshot: docsToDelete.slice(0, 100),
        createdAt: Date.now(),
        actorUid: state.profile.uid || state.profile.id,
      }).catch(() => {});
    }

    for (let i = 0; i < docsToDelete.length; i += 300) {
      const chunk = docsToDelete.slice(i, i + 300);
      const batch = writeBatch(db);
      chunk.forEach((d) => batch.delete(doc(db, colName, d.id)));
      await batch.commit();
    }
    return docsToDelete.length;
  };

  const runReset = async (scopeKey: string, label: string, collections: string[]) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const ok = await confirm(
      `Clear all records for "${label}"? Backups of up to 100 items are archived in deletedBackups before deletion.`,
      { title: `Reset ${label}`, okLabel: `Reset ${label}` }
    );
    if (!ok) return;

    setBusyScope(scopeKey);
    try {
      let total = 0;
      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        const rows = snap.docs
          .filter((d) => {
            if (colName === 'accessUsers' || colName === 'accessUsernames') {
              const role = (d.data() as any)?.role;
              return role !== 'admin' && role !== 'superAdmin';
            }
            return true;
          })
          .map((d) => ({ id: d.id, data: d.data() }));
        total += await wipeCollection(colName, rows);
      }

      await addDoc(collection(db, 'auditLogs'), {
        action: 'scoped_reset',
        scope: scopeKey,
        deletedCount: total,
        actorUid: state.profile.uid || state.profile.id,
        timestamp: Date.now(),
      }).catch(() => {});

      invalidateCache();
      await actions.syncSummary();
      await actions.refreshScopes(undefined, true);
      toast(`Cleared ${total} record(s) from ${label}.`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Reset failed.', 'error');
    } finally {
      setBusyScope('');
    }
  };

  const resetSingleTeam = async () => {
    const { db } = getFirebaseState();
    if (!db || !teamTarget) return;
    const ok = await confirm(
      `Delete all students, registrations, and pending requests belonging to "${teamLabel(teamTarget)}"?`,
      { title: 'Reset Team Data', okLabel: 'Delete Team Data' }
    );
    if (!ok) return;

    setBusyScope('singleTeam');
    try {
      let total = 0;
      for (const colName of ['students', 'registrations', 'registrationRequests']) {
        const snap = await getDocs(query(collection(db, colName), where('team', '==', teamTarget)));
        total += await wipeCollection(
          colName,
          snap.docs.map((d) => ({ id: d.id, data: d.data() }))
        );
      }
      invalidateCache();
      await actions.syncSummary();
      await actions.refreshScopes(['students', 'registrations'], true);
      toast(`Cleared ${total} records for ${teamLabel(teamTarget)}.`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Team reset failed.', 'error');
    } finally {
      setBusyScope('');
    }
  };

  const resetCards = [
    { key: 'registrations', label: 'Registrations & Requests', cols: ['registrations', 'registrationRequests', 'registrationApplications'] },
    { key: 'results', label: 'Results & Judging Sheets', cols: ['results', 'resultRevisions', 'teamScoreLedgers', 'judgeScores', 'judgeAssignments', 'publicJudgingStatuses'] },
    { key: 'students', label: 'All Students', cols: ['students'] },
    { key: 'events', label: 'All Events & Breaks', cols: ['events', 'scheduleBreaks'] },
    { key: 'notices', label: 'Notices', cols: ['notifications'] },
    { key: 'staff', label: 'Non-Admin Staff Accounts', cols: ['accessUsers', 'accessUsernames', 'teamLeaders'] },
    { key: 'logs', label: 'Audit Logs & Deletion Backups', cols: ['auditLogs', 'deletedBackups'] },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Data Reset &amp; Archiving</h1>
        <p className="text-xs text-slate-500">
          Safely clear scoped collections for a new festival season while keeping Branding &amp; Festival Setup intact.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Reset actions permanently remove records in the chosen scope after saving a 100-item snapshot to deletion backups. Admin logins remain untouched.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resetCards.map((c) => (
          <div
            key={c.key}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">{c.label}</h3>
              <p className="mt-1 font-mono-num text-[11px] text-slate-500">{c.cols.join(', ')}</p>
            </div>
            <button
              type="button"
              disabled={busyScope !== ''}
              onClick={() => runReset(c.key, c.label, c.cols)}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{busyScope === c.key ? 'Clearing…' : `Reset ${c.label}`}</span>
            </button>
          </div>
        ))}
      </div>

      {teams.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">Reset Single Team Data</h3>
            <p className="text-xs text-slate-500">Remove students, registrations, and requests for one team only.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={teamTarget}
              onChange={(e) => setTeamTarget(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {teams.map((t) => (
                <option key={t} value={t}>
                  {teamLabel(t)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busyScope !== ''}
              onClick={resetSingleTeam}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Reset Team</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
