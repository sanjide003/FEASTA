import React, { useMemo, useState } from 'react';
import {
  KeyRound,
  Mail,
  Pencil,
  Plus,
  Power,
  Trash2,
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { deleteDoc, deleteField, doc, setDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { CompactDataTable, type TableColumn } from '../../../components/ui/CompactDataTable';
import { useDialog } from '../../../components/ui/DialogContext';
import { Modal } from '../../../components/ui/Modal';
import { slugKey } from '../../../lib/festConfig';
import { createSecondaryStaffAuthUser, getFirebaseState } from '../../../lib/firebase';
import { resolveDisplayName } from '../../../lib/resultUtils';
import { staffEmailLookupKey } from '../../../lib/staffAuth';
import type { AccessUser, GenderScope } from '../../../types/festival';
import type { AdminActions, AdminState } from './types';

export const AdminStaffTab: React.FC<{ state: AdminState; actions: AdminActions }> = ({ state, actions }) => {
  const { toast, confirm } = useDialog();
  const [roleFilter, setRoleFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [cName, setCName] = useState('');
  const [cUsername, setCUsername] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cRole, setCRole] = useState<'teamLeader' | 'judge' | 'admin'>('teamLeader');
  const [cTeam, setCTeam] = useState(state.general.teams?.[0] || '');
  const [cGenderScope, setCGenderScope] = useState<GenderScope>('Both');
  const [saving, setSaving] = useState(false);

  // Edit modal — strictly never displays or stores plaintext passwords
  const [editingStaff, setEditingStaff] = useState<AccessUser | null>(null);
  const [eName, setEName] = useState('');
  const [eUsername, setEUsername] = useState('');
  const [eRole, setERole] = useState<'teamLeader' | 'judge' | 'admin' | 'superAdmin'>('teamLeader');
  const [eTeam, setETeam] = useState('');
  const [eGenderScope, setEGenderScope] = useState<GenderScope>('Both');
  const [eNewPassword, setENewPassword] = useState('');

  const teams = state.general.teams || [];
  const teamLabel = (k: string) => resolveDisplayName(state.general.teamDisplayNames, k, k);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.staffUsers
      .filter((u) => {
        if (roleFilter !== 'All' && u.role !== roleFilter) return false;
        if (q && !`${u.username} ${u.displayName || ''} ${u.email}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [state.staffUsers, roleFilter, search]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const { db } = getFirebaseState();
    if (!db) return;
    const usernameSlug = slugKey(cUsername);
    if (!usernameSlug) return toast('Enter a valid username.', 'error');
    if (cPassword.length < 6) return toast('Password must be at least 6 characters.', 'error');
    if (cRole === 'teamLeader' && !cTeam) return toast('Select a team for the team leader.', 'error');

    const email = cEmail.trim() || `${usernameSlug}@fest.local`;
    setSaving(true);
    try {
      const uid = await createSecondaryStaffAuthUser(email, cPassword);
      const now = Date.now();
      const targetCol = cRole === 'admin' ? 'adminUsers' : 'accessUsers';
      const usernameCol = cRole === 'admin' ? 'adminUsernames' : 'accessUsernames';

      const displayName = cName.trim() || usernameSlug;
      const userPayload: Record<string, any> = {
        username: usernameSlug,
        displayName,
        email,
        role: cRole,
        active: true,
        authUid: uid,
        accessDocId: uid,
        createdAt: now,
        updatedAt: now,
        ...(cRole === 'teamLeader' ? { team: cTeam, genderScope: cGenderScope } : {}),
      };

      const lookupPayload = {
        username: usernameSlug,
        displayName,
        email,
        role: cRole,
        authUid: uid,
        accessDocId: uid,
        active: true,
        ...(cRole === 'teamLeader' ? { team: cTeam, genderScope: cGenderScope } : {}),
      };

      const extraWrites: Array<Promise<unknown>> = [
        setDoc(doc(db, targetCol, uid), userPayload),
        setDoc(doc(db, usernameCol, usernameSlug), lookupPayload),
      ];
      if (usernameCol === 'accessUsernames') {
        extraWrites.push(setDoc(doc(db, 'accessUsernames', staffEmailLookupKey(email)), lookupPayload));
      }
      if (cRole === 'teamLeader') {
        extraWrites.push(
          setDoc(doc(db, 'teamLeaders', uid), {
            uid,
            authUid: uid,
            username: usernameSlug,
            name: displayName,
            displayName,
            role: 'Team Leader',
            team: cTeam,
            genderScope: cGenderScope,
            active: true,
            updatedAt: now,
          })
        );
      } else if (cRole === 'judge') {
        extraWrites.push(
          setDoc(doc(db, 'judges', uid), {
            uid,
            authUid: uid,
            username: usernameSlug,
            name: displayName,
            displayName,
            email,
            active: true,
            updatedAt: now,
          })
        );
      }
      await Promise.all(extraWrites);

      setCName('');
      setCUsername('');
      setCEmail('');
      setCPassword('');
      setShowCreate(false);
      await actions.refreshScopes(['staff'], true);
      toast(`Created staff account "${usernameSlug}".`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to create staff user.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (u: AccessUser) => {
    setEditingStaff(u);
    setEName(u.displayName || u.username);
    setEUsername(u.username);
    setERole((u.role as any) || 'teamLeader');
    setETeam(u.team || teams[0] || '');
    setEGenderScope(u.genderScope || 'Both');
    setENewPassword('');
  };

  const saveEditStaff = async () => {
    const { db, functions } = getFirebaseState();
    if (!db || !editingStaff) return;
    const newSlug = slugKey(eUsername);
    if (!newSlug) return toast('Valid username is required.', 'error');
    if (eNewPassword && eNewPassword.length < 6) {
      return toast('New password must be at least 6 characters.', 'error');
    }

    setSaving(true);
    try {
      const targetUid = editingStaff.authUid || editingStaff.uid || editingStaff.id;
      const displayName = eName.trim() || newSlug;
      if (eNewPassword) {
        const updateCreds = httpsCallable(functions, 'updateStaffCredentials');
        await updateCreds({
          uid: targetUid,
          identifier: editingStaff.email || newSlug,
          password: eNewPassword,
          role: eRole,
          displayName,
          team: eRole === 'teamLeader' ? eTeam : '',
          genderScope: eRole === 'teamLeader' ? eGenderScope : '',
          active: editingStaff.active !== false,
        });
      }

      const colName = editingStaff.sourceCollection || (editingStaff.role === 'admin' || editingStaff.role === 'superAdmin' ? 'adminUsers' : 'accessUsers');
      const unameCol = colName === 'adminUsers' ? 'adminUsernames' : 'accessUsernames';

      await updateDoc(doc(db, colName, editingStaff.id), {
        displayName,
        username: newSlug,
        role: eRole,
        accessPassword: deleteField(),
        ...(eRole === 'teamLeader' ? { team: eTeam, genderScope: eGenderScope } : {}),
        updatedAt: Date.now(),
      });

      if (editingStaff.username && editingStaff.username !== newSlug) {
        await deleteDoc(doc(db, unameCol, editingStaff.username)).catch(() => {});
      }
      const lookupPayload = {
        username: newSlug,
        displayName,
        email: editingStaff.email,
        role: eRole,
        authUid: targetUid,
        accessDocId: editingStaff.id,
        active: editingStaff.active !== false,
        ...(eRole === 'teamLeader' ? { team: eTeam, genderScope: eGenderScope } : {}),
      };
      await setDoc(doc(db, unameCol, newSlug), lookupPayload);
      if (unameCol === 'accessUsernames' && editingStaff.email) {
        await setDoc(doc(db, 'accessUsernames', staffEmailLookupKey(editingStaff.email)), lookupPayload).catch(() => {});
      }
      if (eRole === 'teamLeader') {
        await setDoc(
          doc(db, 'teamLeaders', editingStaff.id),
          {
            uid: targetUid,
            authUid: targetUid,
            username: newSlug,
            name: displayName,
            displayName,
            role: 'Team Leader',
            team: eTeam,
            genderScope: eGenderScope,
            active: editingStaff.active !== false,
            updatedAt: Date.now(),
          },
          { merge: true }
        ).catch(() => {});
      }

      setEditingStaff(null);
      await actions.refreshScopes(['staff'], true);
      toast('Staff account updated.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to update staff credentials.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: AccessUser) => {
    const { db } = getFirebaseState();
    if (!db) return;
    if ((u.uid || u.id) === (state.profile.uid || state.profile.id)) {
      return toast('You cannot deactivate your own admin account.', 'warning');
    }
    const nextActive = u.active === false;
    const colName = u.sourceCollection || 'accessUsers';
    const unameCol = colName === 'adminUsers' ? 'adminUsernames' : 'accessUsernames';
    try {
      await Promise.all([
        updateDoc(doc(db, colName, u.id), { active: nextActive, updatedAt: Date.now() }),
        u.username ? updateDoc(doc(db, unameCol, u.username), { active: nextActive }).catch(() => {}) : Promise.resolve(),
      ]);
      await actions.refreshScopes(['staff'], true);
      toast(`${u.username} ${nextActive ? 'activated' : 'deactivated'}.`, 'info');
    } catch (err: any) {
      toast(err?.message || 'Toggle failed.', 'error');
    }
  };

  const deleteStaff = async (u: AccessUser) => {
    const { db } = getFirebaseState();
    if (!db) return;
    if ((u.uid || u.id) === (state.profile.uid || state.profile.id)) {
      return toast('You cannot delete your currently signed-in account.', 'warning');
    }
    const ok = await confirm(`Delete staff account "${u.displayName || u.username}"?`, {
      title: 'Delete Staff Account',
      okLabel: 'Delete',
    });
    if (!ok) return;
    const colName = u.sourceCollection || 'accessUsers';
    const unameCol = colName === 'adminUsers' ? 'adminUsernames' : 'accessUsernames';
    try {
      await Promise.all([
        deleteDoc(doc(db, colName, u.id)),
        u.username ? deleteDoc(doc(db, unameCol, u.username)).catch(() => {}) : Promise.resolve(),
      ]);
      await actions.refreshScopes(['staff'], true);
      toast('Staff account removed.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Delete failed.', 'error');
    }
  };

  const sendResetMail = async (u: AccessUser) => {
    const { auth } = getFirebaseState();
    if (!auth || !u.email || u.email.endsWith('@fest.local')) {
      return toast('Password reset emails require a real email address. Use Edit -> Set New Password instead.', 'info');
    }
    try {
      await sendPasswordResetEmail(auth, u.email);
      toast(`Password reset link sent to ${u.email}.`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Failed to send reset email.', 'error');
    }
  };

  const columns: TableColumn<AccessUser>[] = [
    {
      key: 'user',
      header: 'Staff Member',
      render: (u) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {u.displayName || u.username}{' '}
            <span className="font-mono-num text-[11px] font-normal text-slate-400">@{u.username}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            {u.role}
            {u.team ? ` · ${teamLabel(u.team)} (${u.genderScope || 'Both'})` : ''}
            {u.active === false ? ' · Inactive' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Login Email',
      render: (u) => <span className="font-mono-num text-xs text-slate-600 dark:text-slate-300">{u.email}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionIconButton icon={Pencil} label="Edit user & set new password" tone="primary" onClick={() => openEditModal(u)} />
          <ActionIconButton
            icon={Power}
            label={u.active === false ? 'Activate account' : 'Deactivate account'}
            tone="warning"
            onClick={() => toggleActive(u)}
          />
          {!u.email.endsWith('@fest.local') && (
            <ActionIconButton icon={Mail} label="Send password reset email" onClick={() => sendResetMail(u)} />
          )}
          <ActionIconButton icon={Trash2} label="Delete staff account" tone="danger" onClick={() => deleteStaff(u)} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Staff &amp; Logins</h1>
          <p className="text-xs text-slate-500">
            Manage Team Leaders, Judges, and Administrators. Passwords are encrypted and can be replaced anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((p) => !p)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Staff Account</span>
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreateStaff}
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <input
            type="text"
            required
            placeholder="Display Name *"
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="text"
            required
            placeholder="Username (e.g. redlead) *"
            value={cUsername}
            onChange={(e) => setCUsername(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="email"
            placeholder="Email (optional, defaults @fest.local)"
            value={cEmail}
            onChange={(e) => setCEmail(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Initial Password (min 6 chars) *"
            value={cPassword}
            onChange={(e) => setCPassword(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={cRole}
            onChange={(e) => setCRole(e.target.value as any)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="teamLeader">Team Leader</option>
            <option value="judge">Judge</option>
            <option value="admin">Administrator</option>
          </select>
          {cRole === 'teamLeader' && (
            <>
              <select
                value={cTeam}
                onChange={(e) => setCTeam(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {teamLabel(t)}
                  </option>
                ))}
              </select>
              <select
                value={cGenderScope}
                onChange={(e) => setCGenderScope(e.target.value as GenderScope)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="Both">Both Genders</option>
                <option value="Boys">Boys Only</option>
                <option value="Girls">Girls Only</option>
              </select>
            </>
          )}
          <div className="flex justify-end lg:col-start-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white"
            >
              {saving ? 'Provisioning…' : 'Create Account'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff…"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="All">All Roles</option>
          <option value="teamLeader">Team Leaders</option>
          <option value="judge">Judges</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      <CompactDataTable
        rows={filteredStaff}
        columns={columns}
        rowKey={(u) => `${u.sourceCollection || 'u'}-${u.id}`}
        defaultPageSize={25}
        pageSizeOptions={[25, 50, 100]}
        itemLabel="staff accounts"
      />

      {/* Edit Staff & Set New Password Modal */}
      <Modal
        open={Boolean(editingStaff)}
        onClose={() => setEditingStaff(null)}
        title={`Edit Staff — ${editingStaff?.displayName || editingStaff?.username || ''}`}
        subtitle="Update username, role, or set a brand-new password (existing password is hidden for security)."
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingStaff(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={saveEditStaff}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
            >
              {saving ? 'Saving…' : 'Save Account'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Display Name</label>
              <input
                type="text"
                value={eName}
                onChange={(e) => setEName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Username</label>
              <input
                type="text"
                value={eUsername}
                onChange={(e) => setEUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          {eRole === 'teamLeader' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold">Assigned Team</label>
                <select
                  value={eTeam}
                  onChange={(e) => setETeam(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                >
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {teamLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Gender Scope</label>
                <select
                  value={eGenderScope}
                  onChange={(e) => setEGenderScope(e.target.value as GenderScope)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                >
                  <option value="Both">Both</option>
                  <option value="Boys">Boys</option>
                  <option value="Girls">Girls</option>
                </select>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <KeyRound className="h-3.5 w-3.5 text-blue-700" />
              <span>Set New Password (Leave blank to keep existing)</span>
            </label>
            <input
              type="password"
              value={eNewPassword}
              onChange={(e) => setENewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
