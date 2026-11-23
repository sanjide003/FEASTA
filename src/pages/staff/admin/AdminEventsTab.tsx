import React, { useMemo, useState } from 'react';
import { Ban, Copy, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { CompactDataTable, type TableColumn } from '../../../components/ui/CompactDataTable';
import { useDialog } from '../../../components/ui/DialogContext';
import { Modal } from '../../../components/ui/Modal';
import {
  eventToFirestore,
  formatCriteriaLines,
  normalizeEventRow,
  parseCriteria,
  RESULT_METHODS,
  validateEvent,
} from '../../../lib/eventUtils';
import { normalizeFestSetup } from '../../../lib/festConfig';
import { getFirebaseState } from '../../../lib/firebase';
import { resolveDisplayName } from '../../../lib/resultUtils';
import type { FestEvent } from '../../../types/festival';
import { ExcelWorkspace } from './ExcelWorkspace';
import type { AdminActions, AdminState } from './types';

interface EventFormDraft {
  name: string;
  code: string;
  category: string;
  gender: string;
  stage: string;
  type: string;
  entriesPerTeam: number;
  membersPerEntry: number;
  resultMethod: string;
  maximumMark: number;
  criteriaText: string;
  rules: string;
}

const emptyEventForm = (firstCat = 'Junior'): EventFormDraft => ({
  name: '',
  code: '',
  category: firstCat,
  gender: 'Boys',
  stage: 'On-Stage',
  type: 'Single',
  entriesPerTeam: 2,
  membersPerEntry: 2,
  resultMethod: 'criteria',
  maximumMark: 100,
  criteriaText: 'Content - 40\nDelivery - 40\nLanguage - 20',
  rules: '',
});

export const AdminEventsTab: React.FC<{ state: AdminState; actions: AdminActions }> = ({ state, actions }) => {
  const { toast, confirm } = useDialog();
  const [subtab, setSubtab] = useState<'catalog' | 'excel'>('catalog');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);

  const categories = state.general.categories || [];
  const festSetup = useMemo(() => normalizeFestSetup(state.general.festSetup || {}), [state.general.festSetup]);
  const catLabel = (k: string) => resolveDisplayName(state.general.categoryDisplayNames, k, k);

  const [form, setForm] = useState<EventFormDraft>(() => emptyEventForm(categories[0] || 'General'));
  const [editingId, setEditingId] = useState<string>('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsedFormCriteria = useMemo(() => parseCriteria(form.criteriaText), [form.criteriaText]);

  const handleCriteriaChange = (text: string) => {
    const parsed = parseCriteria(text);
    setForm((prev) => ({
      ...prev,
      criteriaText: text,
      ...(parsed.total > 0 && prev.resultMethod === 'criteria' ? { maximumMark: parsed.total } : {}),
    }));
  };

  // Creates or updates strictly ONE event (preserving selected gender without splitting!)
  const saveEvent = async (draft: EventFormDraft, existingId = '') => {
    const { db } = getFirebaseState();
    if (!db) return;
    if (!draft.name.trim()) return toast('Event name is required.', 'error');

    const normalized = normalizeEventRow({
      id: existingId,
      name: draft.name,
      code: draft.code,
      category: draft.category,
      gender: draft.gender,
      stage: draft.stage,
      type: draft.type,
      entriesPerTeam: draft.entriesPerTeam,
      membersPerEntry: draft.type === 'Group' ? draft.membersPerEntry : 1,
      resultMethod: draft.resultMethod,
      maximumMark:
        draft.resultMethod === 'criteria' && parsedFormCriteria.total > 0
          ? parsedFormCriteria.total
          : draft.maximumMark,
      criteriaText: draft.criteriaText,
      rules: draft.rules,
    });

    const validation = validateEvent(
      normalized,
      { ...festSetup, categories },
      state.events
    );
    if (validation.errors.length) {
      return toast(validation.errors[0], 'error');
    }

    setSaving(true);
    try {
      const payload = eventToFirestore(normalized, { setup: festSetup, validation });
      if (existingId) {
        await updateDoc(doc(db, 'events', existingId), payload);
        toast(`Updated "${normalized.name}".`, 'success');
      } else {
        await addDoc(collection(db, 'events'), payload);
        toast(`Created "${normalized.name}".`, 'success');
      }
      setEditModalOpen(false);
      setEditingId('');
      setForm(emptyEventForm(categories[0] || 'General'));
      setShowForm(false);
      await actions.refreshScopes(['events'], true);
    } catch (err: any) {
      toast(err?.message || 'Unable to save event.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditEvent = (ev: FestEvent) => {
    setEditingId(ev.id);
    setForm({
      name: ev.name,
      code: ev.code || '',
      category: ev.category || categories[0] || 'General',
      gender: ev.gender || 'Both',
      stage: ev.stage || 'On-Stage',
      type: ev.type || 'Single',
      entriesPerTeam: Number(ev.limit || ev.entriesPerTeam || 1),
      membersPerEntry: Number(ev.groupSize || ev.membersPerEntry || 2),
      resultMethod: ev.resultMethod || 'manual',
      maximumMark: Number(ev.maximumMark || 100),
      criteriaText: formatCriteriaLines(ev.criteria || []),
      rules: ev.notes || ev.rules || '',
    });
    setEditModalOpen(true);
  };

  const duplicateEvent = async (ev: FestEvent) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const normalized = normalizeEventRow({
      ...ev,
      id: '',
      name: `${ev.name} Copy`,
      code: ev.code ? `${ev.code}-COPY` : '',
    });
    const payload = eventToFirestore(normalized, { setup: festSetup });
    try {
      await addDoc(collection(db, 'events'), payload);
      await actions.refreshScopes(['events'], true);
      toast(`Duplicated "${ev.name}".`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Duplicate failed.', 'error');
    }
  };

  const toggleCancelEvent = async (ev: FestEvent) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const willCancel = !ev.cancelled;
    try {
      await updateDoc(doc(db, 'events', ev.id), {
        cancelled: willCancel,
        cancelledAt: willCancel ? Date.now() : 0,
        updatedAt: Date.now(),
      });
      await actions.refreshScopes(['events'], true);
      toast(willCancel ? `Cancelled "${ev.name}".` : `Restored "${ev.name}".`, 'info');
    } catch (err: any) {
      toast(err?.message || 'Action failed.', 'error');
    }
  };

  const deleteEvent = async (ev: FestEvent) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const ok = await confirm(`Delete "${ev.name}" permanently?`, {
      title: 'Delete Event',
      okLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'events', ev.id));
      await actions.refreshScopes(['events'], true);
      toast('Event deleted.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to delete event.', 'error');
    }
  };

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.events
      .filter((ev) => {
        if (catFilter !== 'All' && ev.category !== catFilter) return false;
        if (stageFilter !== 'All' && ev.stage !== stageFilter) return false;
        if (q && !`${ev.name} ${ev.code || ''} ${ev.category}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.events, search, catFilter, stageFilter]);

  const columns: TableColumn<FestEvent>[] = [
    {
      key: 'event',
      header: 'Competition Event',
      render: (ev) => (
        <div className={ev.cancelled ? 'opacity-50 line-through' : ''}>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {ev.name} {ev.code && <span className="font-mono-num text-[11px] text-slate-400">({ev.code})</span>}
          </p>
          <p className="text-[11px] text-slate-500">
            {catLabel(ev.category)} · {ev.stage} · {ev.type} · {ev.gender} · {ev.resultMethod || 'manual'}
          </p>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Slots & Max Mark',
      render: (ev) => (
        <div className="font-mono-num text-xs text-slate-700 dark:text-slate-300">
          <span>{ev.limit || 1}/team</span>
          {ev.type === 'Group' && <span> · {ev.groupSize || 2} members</span>}
          <span> · Max {ev.maximumMark || 100}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (ev) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionIconButton icon={Pencil} label="Edit event" tone="primary" onClick={() => openEditEvent(ev)} />
          <ActionIconButton icon={Copy} label="Duplicate event" onClick={() => duplicateEvent(ev)} />
          <ActionIconButton
            icon={ev.cancelled ? RotateCcw : Ban}
            label={ev.cancelled ? 'Restore event' : 'Cancel event'}
            tone="warning"
            onClick={() => toggleCancelEvent(ev)}
          />
          <ActionIconButton icon={Trash2} label="Delete event" tone="danger" onClick={() => deleteEvent(ev)} />
        </div>
      ),
    },
  ];

  const renderEventFields = () => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-semibold">Event Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Malayalam Elocution"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold">Event Code</label>
        <input
          type="text"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="Optional"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold">Category</label>
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {catLabel(c)}
            </option>
          ))}
          <option value="General">General</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold">Gender Scope (Creates single event)</label>
        <select
          value={form.gender}
          onChange={(e) => setForm({ ...form, gender: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="Boys">Boys</option>
          <option value="Girls">Girls</option>
          <option value="Both">Both</option>
          <option value="Mixed">Mixed</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold">Stage Type</label>
        <select
          value={form.stage}
          onChange={(e) => setForm({ ...form, stage: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="On-Stage">On-Stage</option>
          <option value="Off-Stage">Off-Stage</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold">Participation Type</label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="Single">Single</option>
          <option value="Group">Group</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold">Entries per Team</label>
        <input
          type="number"
          min={1}
          value={form.entriesPerTeam}
          onChange={(e) => setForm({ ...form, entriesPerTeam: Number(e.target.value || 1) })}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
        />
      </div>
      {form.type === 'Group' && (
        <div>
          <label className="mb-1 block text-xs font-semibold">Group Size</label>
          <input
            type="number"
            min={2}
            value={form.membersPerEntry}
            onChange={(e) => setForm({ ...form, membersPerEntry: Number(e.target.value || 2) })}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-semibold">Result Method</label>
        <select
          value={form.resultMethod}
          onChange={(e) => setForm({ ...form, resultMethod: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
        >
          {RESULT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold">
          Maximum Mark {form.resultMethod === 'criteria' && parsedFormCriteria.total > 0 ? `(Auto: ${parsedFormCriteria.total})` : ''}
        </label>
        <input
          type="number"
          min={1}
          value={form.maximumMark}
          onChange={(e) => setForm({ ...form, maximumMark: Number(e.target.value || 100) })}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
        />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="mb-1 block text-xs font-semibold">
          Judging Criteria (Enter one per line: Criteria Name - Marks)
        </label>
        <textarea
          rows={4}
          value={form.criteriaText}
          onChange={(e) => handleCriteriaChange(e.target.value)}
          placeholder={'Content - 40\nDelivery - 40\nLanguage - 20'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
        />
        {parsedFormCriteria.criteria.length > 0 && (
          <p className="mt-1 text-[11px] font-medium text-emerald-700">
            Parsed {parsedFormCriteria.criteria.length} criteria · Total: {parsedFormCriteria.total} marks
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Events Catalog</h1>
          <p className="text-xs text-slate-500">Create individual competitions with line-by-line judging criteria or bulk import.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubtab('catalog')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              subtab === 'catalog' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            Catalog ({state.events.length})
          </button>
          <button
            type="button"
            onClick={() => setSubtab('excel')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              subtab === 'excel' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            Excel Events
          </button>
        </div>
      </div>

      {subtab === 'excel' ? (
        <ExcelWorkspace
          scope="events"
          general={state.general}
          existingEvents={state.events}
          onCommitted={() => actions.refreshScopes(['events'], true)}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search event…"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {catLabel(c)}
                  </option>
                ))}
                <option value="General">General</option>
              </select>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="All">All Stages</option>
                <option value="On-Stage">On-Stage</option>
                <option value="Off-Stage">Off-Stage</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingId('');
                setForm(emptyEventForm(categories[0] || 'General'));
                setShowForm((p) => !p);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Event</span>
            </button>
          </div>

          {showForm && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              {renderEventFields()}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => saveEvent(form)}
                  className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  {saving ? 'Saving…' : 'Create Single Event'}
                </button>
              </div>
            </div>
          )}

          <CompactDataTable
            rows={filteredEvents}
            columns={columns}
            rowKey={(e) => e.id}
            defaultPageSize={25}
            pageSizeOptions={[25, 50, 100]}
            itemLabel="events"
          />
        </div>
      )}

      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Event"
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => saveEvent(form, editingId)}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
            >
              {saving ? 'Saving…' : 'Update Event'}
            </button>
          </>
        }
      >
        {renderEventFields()}
      </Modal>
    </div>
  );
};
