import React, { useMemo, useState } from 'react';
import { Check, Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { CompactDataTable, type TableColumn } from '../../../components/ui/CompactDataTable';
import { useDialog } from '../../../components/ui/DialogContext';
import { Modal } from '../../../components/ui/Modal';
import { getFirebaseState } from '../../../lib/firebase';
import { resolveDisplayName } from '../../../lib/resultUtils';
import type { Registration, RegistrationRequest } from '../../../types/festival';
import type { AdminActions, AdminState } from './types';

export const AdminRegistrationsTab: React.FC<{ state: AdminState; actions: AdminActions }> = ({ state, actions }) => {
  const { toast, confirm } = useDialog();
  const [subtab, setSubtab] = useState<'entries' | 'requests'>('entries');
  const [teamFilter, setTeamFilter] = useState('All');
  const [eventFilter, setEventFilter] = useState('All');

  // Add/Edit Registration modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<Registration | null>(null);
  const [formEventId, setFormEventId] = useState(state.events[0]?.id || '');
  const [formTeam, setFormTeam] = useState(state.general.teams?.[0] || '');
  const [formSlotIndex, setFormSlotIndex] = useState(1);
  const [formStudentIds, setFormStudentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Request inspect modal
  const [inspectReq, setInspectReq] = useState<RegistrationRequest | null>(null);

  const teams = state.general.teams || [];
  const teamLabel = (k: string) => resolveDisplayName(state.general.teamDisplayNames, k, k);
  const catLabel = (k: string) => resolveDisplayName(state.general.categoryDisplayNames, k, k);

  const activeEvents = useMemo(
    () => state.events.filter((e) => !e.cancelled).sort((a, b) => a.name.localeCompare(b.name)),
    [state.events]
  );

  const filteredRegs = useMemo(() => {
    return state.registrations.filter((r) => {
      if (teamFilter !== 'All' && r.team !== teamFilter) return false;
      if (eventFilter !== 'All' && r.eventId !== eventFilter) return false;
      return true;
    });
  }, [state.registrations, teamFilter, eventFilter]);

  const pendingReqs = useMemo(
    () => state.requests.filter((r) => ['pending', 'applied', 'under_review', 'waitlisted'].includes(r.status)),
    [state.requests]
  );

  const selectedModalEvent = useMemo(
    () => state.events.find((e) => e.id === formEventId) || null,
    [state.events, formEventId]
  );

  const modalEligibleStudents = useMemo(() => {
    if (!formTeam || !selectedModalEvent) return [];
    return state.students
      .filter((s) => {
        if (s.team !== formTeam) return false;
        if (selectedModalEvent.category && selectedModalEvent.category !== 'General' && s.category !== selectedModalEvent.category) {
          return false;
        }
        if (
          selectedModalEvent.gender &&
          !['Both', 'Mixed'].includes(selectedModalEvent.gender) &&
          s.gender !== selectedModalEvent.gender
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.students, formTeam, selectedModalEvent]);

  const openAddModal = () => {
    setEditingReg(null);
    setFormEventId(activeEvents[0]?.id || '');
    setFormTeam(teams[0] || '');
    setFormSlotIndex(1);
    setFormStudentIds([]);
    setModalOpen(true);
  };

  const openEditModal = (r: Registration) => {
    setEditingReg(r);
    setFormEventId(r.eventId);
    setFormTeam(r.team);
    setFormSlotIndex(Number(r.slotIndex || 1));
    setFormStudentIds([...(r.studentIds || [])]);
    setModalOpen(true);
  };

  const saveRegistration = async () => {
    const { db, auth } = getFirebaseState();
    if (!db || !auth?.currentUser || !selectedModalEvent) return;
    if (!formStudentIds.length) return toast('Select at least one participant.', 'warning');

    setSaving(true);
    const now = Date.now();
    const uid = auth.currentUser.uid;
    try {
      if (editingReg) {
        await updateDoc(doc(db, 'registrations', editingReg.id), {
          eventId: selectedModalEvent.id,
          eventName: selectedModalEvent.name,
          team: formTeam,
          slotIndex: formSlotIndex,
          studentIds: formStudentIds,
          lastUpdatedByUid: uid,
          lastUpdatedAt: now,
        });
        toast('Registration updated.', 'success');
      } else {
        await addDoc(collection(db, 'registrations'), {
          eventId: selectedModalEvent.id,
          eventName: selectedModalEvent.name,
          team: formTeam,
          slotIndex: formSlotIndex,
          studentIds: formStudentIds,
          participantIds: [],
          managedGender: selectedModalEvent.gender === 'Girls' ? 'Girls' : selectedModalEvent.gender === 'Boys' ? 'Boys' : 'Both',
          createdByUid: uid,
          lastUpdatedByUid: uid,
          createdAt: now,
          lastUpdatedAt: now,
        });
        toast('Registration slot added.', 'success');
      }
      setModalOpen(false);
      await actions.refreshScopes(['registrations'], true);
    } catch (err: any) {
      toast(err?.message || 'Unable to save registration.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteRegistration = async (r: Registration) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const ok = await confirm(`Remove this ${teamLabel(r.team)} entry for "${r.eventName || r.eventId}"?`, {
      title: 'Delete Entry',
      okLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'registrations', r.id));
      await actions.refreshScopes(['registrations'], true);
      toast('Entry removed.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Delete failed.', 'error');
    }
  };

  const decideRequest = async (req: RegistrationRequest, decision: 'approved' | 'rejected') => {
    const { db, auth } = getFirebaseState();
    if (!db || !auth?.currentUser) return;
    const uid = auth.currentUser.uid;
    const now = Date.now();
    try {
      if (decision === 'approved') {
        for (const eid of req.eventIds || []) {
          const ev = state.events.find((e) => e.id === eid);
          if (!ev) continue;
          const teamRegs = state.registrations.filter((r) => r.eventId === eid && r.team === req.team);
          const maxMembers = ev.type === 'Group' ? Math.max(1, Number(ev.groupSize || 1)) : 1;
          const openReg = teamRegs.find((r) => (r.studentIds || []).length < maxMembers);
          if (openReg) {
            const nextIds = [...new Set([...(openReg.studentIds || []), req.relatedStudentId])];
            await updateDoc(doc(db, 'registrations', openReg.id), {
              studentIds: nextIds,
              lastUpdatedByUid: uid,
              lastUpdatedAt: now,
            });
          } else {
            await addDoc(collection(db, 'registrations'), {
              eventId: ev.id,
              eventName: ev.name,
              team: req.team,
              slotIndex: teamRegs.length + 1,
              studentIds: [req.relatedStudentId],
              participantIds: [],
              managedGender: req.gender || 'Both',
              createdByUid: uid,
              lastUpdatedByUid: uid,
              createdAt: now,
              lastUpdatedAt: now,
            });
          }
        }
      }

      await updateDoc(doc(db, 'registrationRequests', req.id), {
        status: decision,
        decisionByUid: uid,
        decisionByName: state.profile.displayName || state.profile.username,
        decisionByRole: state.profile.role,
        decisionByUsername: state.profile.username,
        decisionAt: now,
        reviewedAt: now,
      });
      setInspectReq(null);
      await actions.refreshScopes(['registrations'], true);
      toast(`Request ${decision}.`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to process request.', 'error');
    }
  };

  const deleteRequest = async (req: RegistrationRequest) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const ok = await confirm(`Delete request from ${req.name}?`, { title: 'Delete Request', okLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'registrationRequests', req.id));
      await actions.refreshScopes(['registrations'], true);
      toast('Request deleted.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Delete failed.', 'error');
    }
  };

  const entryColumns: TableColumn<Registration>[] = [
    {
      key: 'event',
      header: 'Event',
      render: (r) => {
        const ev = state.events.find((e) => e.id === r.eventId);
        return (
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{ev?.name || r.eventName || r.eventId}</p>
            <p className="text-[11px] text-slate-500">
              {ev ? `${catLabel(ev.category)} · ${ev.type} · Slot #${r.slotIndex || 1}` : `Slot #${r.slotIndex || 1}`}
            </p>
          </div>
        );
      },
    },
    {
      key: 'team',
      header: 'Team',
      render: (r) => <span className="font-semibold text-slate-800 dark:text-slate-200">{teamLabel(r.team)}</span>,
    },
    {
      key: 'participants',
      header: 'Participants',
      render: (r) => {
        const names = (r.studentIds || []).map((sid) => {
          const st = state.students.find((x) => x.id === sid);
          return st ? `${st.name}${st.chestNo ? ` (#${st.chestNo})` : ''}` : sid;
        });
        return <span className="line-clamp-2 max-w-sm text-xs text-slate-700 dark:text-slate-300">{names.join(', ') || '—'}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionIconButton icon={Pencil} label="Edit slot" tone="primary" onClick={() => openEditModal(r)} />
          <ActionIconButton icon={Trash2} label="Delete slot" tone="danger" onClick={() => deleteRegistration(r)} />
        </div>
      ),
    },
  ];

  const reqColumns: TableColumn<RegistrationRequest>[] = [
    {
      key: 'name',
      header: 'Applicant',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{r.name}</p>
          <p className="text-[11px] text-slate-500">
            {teamLabel(r.team)} · {catLabel(r.category || '')} · {r.gender}
          </p>
        </div>
      ),
    },
    {
      key: 'events',
      header: 'Events',
      render: (r) => (
        <span className="line-clamp-2 max-w-xs text-xs text-slate-700 dark:text-slate-300">
          {(r.eventIds || []).map((eid) => state.events.find((e) => e.id === eid)?.name || eid).join(', ')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span
          className={`text-xs font-semibold capitalize ${
            r.status === 'approved' ? 'text-emerald-700' : r.status === 'rejected' ? 'text-red-600' : 'text-amber-700'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => {
        const pending = ['pending', 'applied', 'under_review', 'waitlisted'].includes(r.status);
        return (
          <div className="flex items-center justify-end gap-1.5">
            <ActionIconButton icon={Eye} label="Inspect application" onClick={() => setInspectReq(r)} />
            {pending && (
              <>
                <ActionIconButton icon={Check} label="Approve" tone="success" onClick={() => decideRequest(r, 'approved')} />
                <ActionIconButton icon={X} label="Reject" tone="danger" onClick={() => decideRequest(r, 'rejected')} />
              </>
            )}
            <ActionIconButton icon={Trash2} label="Delete request" tone="danger" onClick={() => deleteRequest(r)} />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Registrations</h1>
          <p className="text-xs text-slate-500">Manage official event entries and review student applications.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubtab('entries')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              subtab === 'entries' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            Team Entries ({state.registrations.length})
          </button>
          <button
            type="button"
            onClick={() => setSubtab('requests')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              subtab === 'requests' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            Requests ({pendingReqs.length} pending)
          </button>
        </div>
      </div>

      {subtab === 'entries' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="All">All Teams</option>
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {teamLabel(t)}
                  </option>
                ))}
              </select>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="All">All Events</option>
                {activeEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Entry</span>
            </button>
          </div>

          <CompactDataTable
            rows={filteredRegs}
            columns={entryColumns}
            rowKey={(r) => r.id}
            defaultPageSize={25}
            pageSizeOptions={[25, 50, 100]}
            itemLabel="entries"
          />
        </div>
      ) : (
        <CompactDataTable
          rows={state.requests}
          columns={reqColumns}
          rowKey={(r) => r.id}
          defaultPageSize={25}
          pageSizeOptions={[25, 50, 100]}
          itemLabel="requests"
        />
      )}

      {/* Add/Edit Registration Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingReg ? 'Edit Registration Slot' : 'Add Registration Entry'}
        maxWidthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={saveRegistration}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
            >
              {saving ? 'Saving…' : 'Save Registration'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">Event</label>
              <select
                value={formEventId}
                onChange={(e) => {
                  setFormEventId(e.target.value);
                  setFormStudentIds([]);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              >
                {activeEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({catLabel(e.category)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Slot #</label>
              <input
                type="number"
                min={1}
                value={formSlotIndex}
                onChange={(e) => setFormSlotIndex(Number(e.target.value || 1))}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono-num text-xs"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">Team</label>
            <select
              value={formTeam}
              onChange={(e) => {
                setFormTeam(e.target.value);
                setFormStudentIds([]);
              }}
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
            <label className="mb-1 block text-xs font-semibold">Eligible Participants ({modalEligibleStudents.length})</label>
            <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
              {modalEligibleStudents.map((st) => {
                const checked = formStudentIds.includes(st.id);
                return (
                  <label
                    key={st.id}
                    className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-xs ${
                      checked ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setFormStudentIds((prev) =>
                          checked ? prev.filter((x) => x !== st.id) : [...prev, st.id]
                        )
                      }
                    />
                    <span className="truncate">{st.name}</span>
                    {st.chestNo && <span className="ml-auto font-mono-num text-[10px] text-slate-500">{st.chestNo}</span>}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Inspect Request Modal */}
      <Modal
        open={Boolean(inspectReq)}
        onClose={() => setInspectReq(null)}
        title={inspectReq?.name || 'Request'}
        footer={
          inspectReq && ['pending', 'applied', 'under_review', 'waitlisted'].includes(inspectReq.status) ? (
            <>
              <button
                type="button"
                onClick={() => decideRequest(inspectReq, 'rejected')}
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => decideRequest(inspectReq, 'approved')}
                className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white"
              >
                Approve &amp; Register
              </button>
            </>
          ) : undefined
        }
      >
        {inspectReq && (
          <div className="space-y-3 text-xs">
            <p>
              <strong>Team:</strong> {teamLabel(inspectReq.team)} · <strong>Gender:</strong> {inspectReq.gender}
            </p>
            <p>
              <strong>Events:</strong>{' '}
              {(inspectReq.eventIds || []).map((eid) => state.events.find((e) => e.id === eid)?.name || eid).join(', ')}
            </p>
            {inspectReq.note && <p className="rounded bg-slate-50 p-2.5">{inspectReq.note}</p>}
            {inspectReq.images?.[0]?.data && (
              <img src={inspectReq.images[0].data} alt="Attachment" className="max-h-56 rounded border" />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
