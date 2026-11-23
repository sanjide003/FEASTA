import React, { useMemo, useState } from 'react';
import {
  CreditCard,
  ImagePlus,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Wand2,
} from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ParticipantIdCard } from '../../../components/ParticipantIdCard';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { CompactDataTable, type TableColumn } from '../../../components/ui/CompactDataTable';
import { useDialog } from '../../../components/ui/DialogContext';
import { Modal } from '../../../components/ui/Modal';
import { normalizeFestSetup } from '../../../lib/festConfig';
import { getFirebaseState } from '../../../lib/firebase';
import { compressImageFile } from '../../../lib/imageUpload';
import { printPage, resolveDisplayName } from '../../../lib/resultUtils';
import {
  buildStudentDetailsPatch,
  getStudentFieldVisibility,
  normalizeCategoryClassificationConfig,
  resolveCategoryFromStudentInputs,
  resolveNextAutoChestNo,
  studentClassValue,
  studentDobValue,
  validateManualChestNo,
} from '../../../lib/studentUtils';
import type { Student } from '../../../types/festival';
import { ExcelWorkspace } from './ExcelWorkspace';
import type { AdminActions, AdminState } from './types';

export const AdminStudentsTab: React.FC<{ state: AdminState; actions: AdminActions }> = ({ state, actions }) => {
  const { toast, confirm } = useDialog();
  const [subtab, setSubtab] = useState<'directory' | 'excel'>('directory');

  // Filters
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('All');
  const [catFilter, setCatFilter] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');

  // Create form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [team, setTeam] = useState(state.general.teams?.[0] || '');
  const [gender, setGender] = useState<'Boys' | 'Girls'>('Boys');
  const [category, setCategory] = useState(state.general.categories?.[0] || '');
  const [cls, setCls] = useState('');
  const [dob, setDob] = useState('');
  const [chestNo, setChestNo] = useState('');
  const [photoData, setPhotoData] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit Modal state
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    team: '',
    gender: 'Boys',
    category: '',
    cls: '',
    dob: '',
    chestNo: '',
    photoData: '',
  });

  // ID Card preview & bulk print modals
  const [previewCardStudent, setPreviewCardStudent] = useState<Student | null>(null);
  const [printBulkOpen, setPrintBulkOpen] = useState(false);

  const teams = state.general.teams || [];
  const categories = state.general.categories || [];
  const teamLabel = (k: string) => resolveDisplayName(state.general.teamDisplayNames, k, k);
  const catLabel = (k: string) => resolveDisplayName(state.general.categoryDisplayNames, k, k);

  const festSetup = useMemo(() => normalizeFestSetup(state.general.festSetup || {}), [state.general.festSetup]);
  const classCfg = useMemo(
    () => normalizeCategoryClassificationConfig(state.general.categoryClassification || {}, festSetup.eligibleClasses),
    [state.general.categoryClassification, festSetup.eligibleClasses]
  );
  const fieldVis = useMemo(() => getStudentFieldVisibility(classCfg), [classCfg]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.students
      .filter((s) => {
        if (teamFilter !== 'All' && s.team !== teamFilter) return false;
        if (catFilter !== 'All' && s.category !== catFilter) return false;
        if (genderFilter !== 'All' && s.gender !== genderFilter) return false;
        if (q && !`${s.name} ${s.chestNo || ''} ${teamLabel(s.team)}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => String(a.chestNo || a.name).localeCompare(String(b.chestNo || b.name), undefined, { numeric: true }));
  }, [state.students, search, teamFilter, catFilter, genderFilter, state.general.teamDisplayNames]);

  const confirmedEventsForStudent = (studentId: string) => {
    const eventIds = new Set<string>();
    state.registrations.forEach((r) => {
      if ((r.studentIds || []).includes(studentId)) eventIds.add(r.eventId);
    });
    return [...eventIds]
      .map((eid) => state.events.find((e) => e.id === eid))
      .filter(Boolean)
      .map((e) => ({
        id: e!.id,
        name: e!.name,
        stage: e!.stage,
        type: e!.type,
        date: e!.scheduleDate || e!.date,
        time: e!.time,
        venue: e!.scheduleStage,
      }));
  };

  const resolveAutoChest = (targetTeam: string, targetCat: string, targetGender: string) => {
    const res = resolveNextAutoChestNo({
      config: state.general.chestConfig,
      students: state.students,
      team: targetTeam,
      category: targetCat,
      gender: targetGender,
    });
    if (!res.ok) {
      toast(res.reason, 'warning');
      return '';
    }
    return res.chestNo;
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const { db } = getFirebaseState();
    if (!db) return;
    if (!name.trim()) return toast('Student name is required.', 'error');
    if (!team) return toast('Select a team.', 'error');

    let finalCategory = category;
    if (classCfg.mode !== 'manual') {
      const resolved = resolveCategoryFromStudentInputs({
        config: classCfg,
        categories,
        classValue: cls,
        dobValue: dob,
      });
      if (!resolved.matched) {
        return toast(`Could not resolve category from ${classCfg.mode.toUpperCase()} rules.`, 'error');
      }
      finalCategory = resolved.category;
    }

    let finalChest = chestNo.trim();
    if (!finalChest && state.general.chestConfig?.enabled) {
      finalChest = resolveAutoChest(team, finalCategory, gender);
    }
    if (finalChest) {
      const val = validateManualChestNo(finalChest, state.students);
      if (!val.ok) return toast(val.error, 'error');
      finalChest = val.chestNo;
    }

    setSaving(true);
    try {
      const now = Date.now();
      const details = buildStudentDetailsPatch({}, { classValue: cls, dobValue: dob });
      await addDoc(collection(db, 'students'), {
        name: name.trim(),
        team,
        category: finalCategory,
        gender,
        ...(finalChest ? { chestNo: finalChest } : {}),
        ...(photoData ? { photoData } : {}),
        details,
        updatedAt: now,
      });
      await actions.syncSummary(state.students.length + 1, state.results);
      await actions.refreshScopes(['students'], true);
      setName('');
      setChestNo('');
      setPhotoData('');
      toast('Student added.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to add student.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditStudent = (st: Student) => {
    setEditStudent(st);
    setEditForm({
      name: st.name,
      team: st.team,
      gender: st.gender === 'Girls' ? 'Girls' : 'Boys',
      category: st.category || '',
      cls: studentClassValue(st),
      dob: studentDobValue(st),
      chestNo: String(st.chestNo || ''),
      photoData: st.photoData || '',
    });
  };

  const handleSaveEdit = async () => {
    const { db } = getFirebaseState();
    if (!db || !editStudent) return;
    if (!editForm.name.trim()) return toast('Student name is required.', 'error');

    let finalCategory = editForm.category;
    if (classCfg.mode !== 'manual') {
      const resolved = resolveCategoryFromStudentInputs({
        config: classCfg,
        categories,
        classValue: editForm.cls,
        dobValue: editForm.dob,
      });
      if (resolved.matched) finalCategory = resolved.category;
    }

    if (editForm.chestNo.trim()) {
      const val = validateManualChestNo(editForm.chestNo, state.students, editStudent.id);
      if (!val.ok) return toast(val.error, 'error');
    }

    setSaving(true);
    try {
      const details = buildStudentDetailsPatch(editStudent.details || {}, {
        classValue: editForm.cls,
        dobValue: editForm.dob,
      });
      const payload: Record<string, any> = {
        name: editForm.name.trim(),
        team: editForm.team,
        gender: editForm.gender,
        category: finalCategory,
        details,
        updatedAt: Date.now(),
        photoData: editForm.photoData || '',
      };
      if (editForm.chestNo.trim()) payload.chestNo = editForm.chestNo.trim();
      await updateDoc(doc(db, 'students', editStudent.id), payload);
      setEditStudent(null);
      await actions.refreshScopes(['students'], true);
      toast('Student updated.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Failed to update student.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async (st: Student) => {
    const { db } = getFirebaseState();
    if (!db) return;
    const ok = await confirm(`Delete student "${st.name}"? Existing event entries referencing this ID will break.`, {
      title: 'Delete Student',
      okLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'students', st.id));
      await actions.syncSummary(Math.max(0, state.students.length - 1), state.results);
      await actions.refreshScopes(['students'], true);
      toast('Student removed.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to delete student.', 'error');
    }
  };

  const columns: TableColumn<Student>[] = [
    {
      key: 'chest',
      header: 'Chest',
      render: (s) => <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">{s.chestNo || '—'}</span>,
    },
    {
      key: 'name',
      header: 'Participant',
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{s.name}</p>
          <p className="text-[11px] text-slate-500">
            {teamLabel(s.team)} · {catLabel(s.category)} · {s.gender}
            {studentClassValue(s) ? ` · Class ${studentClassValue(s)}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionIconButton icon={CreditCard} label="Preview ID card" onClick={() => setPreviewCardStudent(s)} />
          <ActionIconButton icon={Pencil} label="Edit student" tone="primary" onClick={() => openEditStudent(s)} />
          <ActionIconButton icon={Trash2} label="Delete student" tone="danger" onClick={() => handleDeleteStudent(s)} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Students &amp; ID Cards</h1>
          <p className="text-xs text-slate-500">Manage participant roster, chest numbers, Excel imports, and printable badges.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubtab('directory')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              subtab === 'directory' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            Directory ({state.students.length})
          </button>
          <button
            type="button"
            onClick={() => setSubtab('excel')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              subtab === 'excel' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            Excel Import / Export
          </button>
        </div>
      </div>

      {subtab === 'excel' ? (
        <ExcelWorkspace
          scope="students"
          general={state.general}
          existingStudents={state.students}
          onCommitted={async () => {
            await actions.refreshScopes(['students'], true);
            await actions.syncSummary(undefined, state.results);
          }}
        />
      ) : (
        <div className="space-y-4">
          {/* Toolbar & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or chest…"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="All">All Teams</option>
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {teamLabel(t)}
                  </option>
                ))}
              </select>
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
              </select>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="All">All Genders</option>
                <option value="Boys">Boys</option>
                <option value="Girls">Girls</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPrintBulkOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print ID Cards ({Math.min(filteredStudents.length, 40)})</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm((p) => !p)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Student</span>
              </button>
            </div>
          </div>

          {/* Add Student Panel */}
          {showAddForm && (
            <form
              onSubmit={handleCreateStudent}
              className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Team *</label>
                <select
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {teamLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Gender *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'Boys' | 'Girls')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="Boys">Boys</option>
                  <option value="Girls">Girls</option>
                </select>
              </div>
              {classCfg.mode === 'manual' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {catLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {fieldVis.showClass && (
                <div>
                  <label className="mb-1 block text-xs font-semibold">Class</label>
                  <select
                    value={cls}
                    onChange={(e) => setCls(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Select Class</option>
                    {classCfg.classes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {fieldVis.showDob && (
                <div>
                  <label className="mb-1 block text-xs font-semibold">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold">Chest Number</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={chestNo}
                    onChange={(e) => setChestNo(e.target.value)}
                    placeholder="Auto or manual"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <ActionIconButton
                    icon={Wand2}
                    label="Generate next auto chest number"
                    onClick={() => {
                      const next = resolveAutoChest(team, category, gender);
                      if (next) setChestNo(next);
                    }}
                  />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>{photoData ? 'Photo Ready' : 'Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        try {
                          setPhotoData(await compressImageFile(f));
                        } catch (err: any) {
                          toast(err?.message || 'Image error.', 'error');
                        }
                      }
                    }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="ml-auto rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  {saving ? 'Saving…' : 'Save Student'}
                </button>
              </div>
            </form>
          )}

          <CompactDataTable
            rows={filteredStudents}
            columns={columns}
            rowKey={(s) => s.id}
            defaultPageSize={25}
            pageSizeOptions={[25, 50, 100]}
            itemLabel="students"
          />
        </div>
      )}

      {/* Edit Student Modal */}
      <Modal
        open={Boolean(editStudent)}
        onClose={() => setEditStudent(null)}
        title={`Edit Student — ${editStudent?.name || ''}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditStudent(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveEdit}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold">Full Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Chest Number</label>
            <input
              type="text"
              value={editForm.chestNo}
              onChange={(e) => setEditForm({ ...editForm, chestNo: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono-num text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Team</label>
            <select
              value={editForm.team}
              onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}
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
            <label className="mb-1 block text-xs font-semibold">Gender</label>
            <select
              value={editForm.gender}
              onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            >
              <option value="Boys">Boys</option>
              <option value="Girls">Girls</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Category</label>
            <select
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {catLabel(c)}
                </option>
              ))}
            </select>
          </div>
          {fieldVis.showClass && (
            <div>
              <label className="mb-1 block text-xs font-semibold">Class</label>
              <input
                type="text"
                value={editForm.cls}
                onChange={(e) => setEditForm({ ...editForm, cls: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              />
            </div>
          )}
          {fieldVis.showDob && (
            <div>
              <label className="mb-1 block text-xs font-semibold">Date of Birth</label>
              <input
                type="date"
                value={editForm.dob}
                onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Single ID Card Preview */}
      <Modal
        open={Boolean(previewCardStudent)}
        onClose={() => setPreviewCardStudent(null)}
        title="Participant ID Badge"
      >
        {previewCardStudent && (
          <ParticipantIdCard
            student={previewCardStudent}
            confirmedEvents={confirmedEventsForStudent(previewCardStudent.id)}
            branding={state.branding}
            teamColors={state.general.teamColors}
            teamDisplayNames={state.general.teamDisplayNames}
            categoryDisplayNames={state.general.categoryDisplayNames}
          />
        )}
      </Modal>

      {/* Bulk Printable ID Cards Modal (Preview) + Non-Fixed Print Sheet */}
      {printBulkOpen && (
        <div className="hidden print:grid print-id-cards-sheet print-card-grid gap-6">
          {filteredStudents.slice(0, 40).map((st) => (
            <div key={`print-${st.id}`} className="print-card-item">
              <ParticipantIdCard
                student={st}
                confirmedEvents={confirmedEventsForStudent(st.id)}
                branding={state.branding}
                teamColors={state.general.teamColors}
                teamDisplayNames={state.general.teamDisplayNames}
                categoryDisplayNames={state.general.categoryDisplayNames}
                hintText=""
              />
            </div>
          ))}
        </div>
      )}

      <div className="no-print">
        <Modal
          open={printBulkOpen}
          onClose={() => setPrintBulkOpen(false)}
          title="Printable ID Cards"
          subtitle={`Showing up to 40 of ${filteredStudents.length} filtered participants`}
          maxWidthClass="max-w-5xl"
          footer={
            <button
              type="button"
              onClick={() => printPage('id-cards')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print ID Card Sheet</span>
            </button>
          }
        >
          <div className="grid gap-6 sm:grid-cols-2">
            {filteredStudents.slice(0, 40).map((st) => (
              <ParticipantIdCard
                key={st.id}
                student={st}
                confirmedEvents={confirmedEventsForStudent(st.id)}
                branding={state.branding}
                teamColors={state.general.teamColors}
                teamDisplayNames={state.general.teamDisplayNames}
                categoryDisplayNames={state.general.categoryDisplayNames}
                hintText=""
              />
            ))}
          </div>
        </Modal>
      </div>
    </div>
  );
};
