import React, { useMemo, useState } from 'react';
import { Plus, Printer, Save, Trash2 } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { useDialog } from '../../../components/ui/DialogContext';
import { getFirebaseState } from '../../../lib/firebase';
import { formatTime12h, printPage, resolveDisplayName } from '../../../lib/resultUtils';
import type { FestEvent } from '../../../types/festival';
import { ExcelWorkspace } from './ExcelWorkspace';
import type { AdminActions, AdminState } from './types';

export const AdminScheduleTab: React.FC<{ state: AdminState; actions: AdminActions }> = ({ state, actions }) => {
  const { toast, confirm } = useDialog();
  const [subtab, setSubtab] = useState<'events' | 'breaks' | 'excel' | 'print'>('events');
  const [stageFilter, setStageFilter] = useState('All');
  const [edits, setEdits] = useState<
    Record<string, { scheduleDate: string; scheduleStage: string; time: string; scheduleDuration: number }>
  >({});

  // Break creator state
  const [breakTitle, setBreakTitle] = useState('');
  const [breakDate, setBreakDate] = useState(state.general.festivalDays?.[0]?.date || '');
  const [breakStart, setBreakStart] = useState('12:30');
  const [breakEnd, setBreakEnd] = useState('13:30');
  const [breakStage, setBreakStage] = useState('All');

  const stages = state.general.stages || [];
  const catLabel = (k: string) => resolveDisplayName(state.general.categoryDisplayNames, k, k);

  const activeEvents = useMemo(
    () =>
      state.events
        .filter((e) => !e.cancelled)
        .filter((e) => stageFilter === 'All' || (e.scheduleStage || e.stage) === stageFilter)
        .sort((a, b) =>
          `${a.scheduleDate || a.date || '9999'} ${a.time || '99:99'}`.localeCompare(
            `${b.scheduleDate || b.date || '9999'} ${b.time || '99:99'}`
          )
        ),
    [state.events, stageFilter]
  );

  const rowValues = (ev: FestEvent) =>
    edits[ev.id] || {
      scheduleDate: ev.scheduleDate || ev.date || '',
      scheduleStage: ev.scheduleStage || '',
      time: ev.time || '',
      scheduleDuration: Number(ev.scheduleDuration || ev.duration || 30),
    };

  const saveEventSchedule = async (ev: FestEvent) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const vals = rowValues(ev);
    try {
      await updateDoc(doc(db, 'events', ev.id), {
        scheduleDate: vals.scheduleDate,
        scheduleStage: vals.scheduleStage,
        time: vals.time,
        scheduleDuration: Number(vals.scheduleDuration || 30),
        scheduleStatus: vals.scheduleDate && vals.time ? 'scheduled' : 'unscheduled',
        updatedAt: Date.now(),
      });
      await actions.refreshScopes(['events'], true);
      toast(`Saved schedule for "${ev.name}".`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to save schedule.', 'error');
    }
  };

  const createBreak = async (e: React.FormEvent) => {
    e.preventDefault();
    const { db } = getFirebaseState();
    if (!db) return;
    if (!breakTitle.trim() || !breakDate) return toast('Enter break title and date.', 'error');
    const now = Date.now();
    try {
      await addDoc(collection(db, 'scheduleBreaks'), {
        title: breakTitle.trim(),
        date: breakDate,
        startTime: breakStart,
        endTime: breakEnd,
        stage: breakStage === 'All' ? '' : breakStage,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      setBreakTitle('');
      await actions.refreshScopes(['schedule'], true);
      toast('Schedule break added.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to add break.', 'error');
    }
  };

  const removeBreak = async (id: string) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const ok = await confirm('Remove this schedule break?', { title: 'Delete Break', okLabel: 'Delete' });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'scheduleBreaks', id));
      await actions.refreshScopes(['schedule'], true);
      toast('Break deleted.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Delete failed.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Festival Schedule</h1>
          <p className="text-xs text-slate-500">Assign dates, venues, start times, breaks, or print stage timetables.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'events', label: 'Event Slots' },
            { id: 'breaks', label: `Breaks (${state.scheduleBreaks.length})` },
            { id: 'excel', label: 'Excel Schedule' },
            { id: 'print', label: 'Printable View' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubtab(t.id as any)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                subtab === t.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subtab === 'excel' && (
        <ExcelWorkspace
          scope="schedule"
          general={state.general}
          existingEvents={state.events}
          onCommitted={() => actions.refreshScopes(['events'], true)}
        />
      )}

      {subtab === 'events' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="All">All Venues / Types</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800">
                  <th className="px-3.5 py-2.5">Event</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Stage Venue</th>
                  <th className="px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5">Min</th>
                  <th className="px-3.5 py-2.5 text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeEvents.map((ev) => {
                  const vals = rowValues(ev);
                  return (
                    <tr key={ev.id}>
                      <td className="px-3.5 py-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{ev.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {catLabel(ev.category)} · {ev.stage}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={vals.scheduleDate}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [ev.id]: { ...vals, scheduleDate: e.target.value },
                            }))
                          }
                          className="rounded border border-slate-300 px-2 py-1 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={vals.scheduleStage}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [ev.id]: { ...vals, scheduleStage: e.target.value },
                            }))
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="">Select Stage</option>
                          {stages.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="time"
                          value={vals.time}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [ev.id]: { ...vals, time: e.target.value },
                            }))
                          }
                          className="rounded border border-slate-300 px-2 py-1 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={5}
                          value={vals.scheduleDuration}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [ev.id]: { ...vals, scheduleDuration: Number(e.target.value || 30) },
                            }))
                          }
                          className="w-16 rounded border border-slate-300 px-2 py-1 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      </td>
                      <td className="px-3.5 py-2 text-right">
                        <ActionIconButton
                          icon={Save}
                          label={`Save schedule for ${ev.name}`}
                          tone="primary"
                          onClick={() => saveEventSchedule(ev)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subtab === 'breaks' && (
        <div className="space-y-4">
          <form
            onSubmit={createBreak}
            className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <input
              type="text"
              value={breakTitle}
              onChange={(e) => setBreakTitle(e.target.value)}
              placeholder="Break title (e.g. Lunch Break)"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="date"
              value={breakDate}
              onChange={(e) => setBreakDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="time"
              value={breakStart}
              onChange={(e) => setBreakStart(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="time"
              value={breakEnd}
              onChange={(e) => setBreakEnd(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="flex gap-2">
              <select
                value={breakStage}
                onChange={(e) => setBreakStage(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="All">All Stages</option>
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </form>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {state.scheduleBreaks.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{b.title}</p>
                  <p className="font-mono-num text-[11px] text-slate-500">
                    {b.date} · {formatTime12h(b.startTime)} – {formatTime12h(b.endTime)}
                    {b.stage ? ` · ${b.stage}` : ' · All Stages'}
                  </p>
                </div>
                <ActionIconButton icon={Trash2} label="Delete break" tone="danger" onClick={() => removeBreak(b.id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {subtab === 'print' && (
        <div className="space-y-4">
          <div className="no-print flex justify-end">
            <button
              type="button"
              onClick={() => printPage('schedule')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Timetable</span>
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-lg font-bold text-slate-900">Official Festival Schedule</h2>
            <table className="mt-3 w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-[11px] font-bold uppercase text-slate-600">
                  <th className="py-2">Date</th>
                  <th className="py-2">Time</th>
                  <th className="py-2">Venue</th>
                  <th className="py-2">Event</th>
                  <th className="py-2">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeEvents
                  .filter((e) => e.scheduleDate || e.time)
                  .map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-2 font-mono-num">{ev.scheduleDate || 'TBA'}</td>
                      <td className="py-2 font-mono-num">{ev.time ? formatTime12h(ev.time) : 'TBA'}</td>
                      <td className="py-2">{ev.scheduleStage || ev.stage}</td>
                      <td className="py-2 font-semibold">{ev.name}</td>
                      <td className="py-2">{catLabel(ev.category)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
