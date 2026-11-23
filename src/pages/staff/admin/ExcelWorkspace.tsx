import React, { useCallback, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderUp,
  Plus,
  Table2,
  Trash2,
} from 'lucide-react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { useDialog } from '../../../components/ui/DialogContext';
import { eventToFirestore, normalizeEventRow, validateEvent } from '../../../lib/eventUtils';
import { normalizeFestSetup } from '../../../lib/festConfig';
import { getFirebaseState } from '../../../lib/firebase';
import {
  buildStudentDetailsPatch,
  normalizeCategoryClassificationConfig,
  normalizeClassValue,
  resolveCategoryFromStudentInputs,
  resolveNextAutoChestNo,
  validateManualChestNo,
} from '../../../lib/studentUtils';
import type { FestEvent, GeneralConfig, Student } from '../../../types/festival';

type ExcelScope = 'students' | 'events' | 'schedule';

interface FieldSpec {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

interface StagingRow {
  uid: string;
  skip: boolean;
  cells: Record<string, string>;
}

const SCOPE_FIELDS: Record<ExcelScope, FieldSpec[]> = {
  students: [
    { key: 'name', label: 'Name', required: true, aliases: ['name', 'student name', 'full name', 'participant'] },
    { key: 'team', label: 'Team', required: true, aliases: ['team', 'house', 'group'] },
    { key: 'gender', label: 'Gender', required: true, aliases: ['gender', 'sex'] },
    { key: 'category', label: 'Category', aliases: ['category', 'section', 'division'] },
    { key: 'class', label: 'Class', aliases: ['class', 'grade', 'std', 'standard'] },
    { key: 'dob', label: 'DOB (YYYY-MM-DD)', aliases: ['dob', 'date of birth', 'birthdate'] },
    { key: 'chestNo', label: 'Chest No', aliases: ['chest no', 'chest', 'chest number', 'chestno'] },
  ],
  events: [
    { key: 'name', label: 'Event Name', required: true, aliases: ['event name', 'name', 'title', 'event'] },
    { key: 'code', label: 'Code', aliases: ['code', 'event code'] },
    { key: 'category', label: 'Category', required: true, aliases: ['category', 'section', 'division'] },
    { key: 'gender', label: 'Gender', required: true, aliases: ['gender', 'scope'] },
    { key: 'stage', label: 'Stage Type', required: true, aliases: ['stage type', 'stage', 'venue type'] },
    { key: 'type', label: 'Type (Single/Group)', required: true, aliases: ['type', 'event type', 'solo/group'] },
    { key: 'entriesPerTeam', label: 'Entries / Team', aliases: ['entries / team', 'entries', 'limit', 'slots'] },
    { key: 'membersPerEntry', label: 'Members / Entry', aliases: ['members / entry', 'members', 'group size'] },
    { key: 'resultMethod', label: 'Result Method', aliases: ['result method', 'method', 'scoring'] },
    { key: 'maximumMark', label: 'Max Mark', aliases: ['max mark', 'maximum mark', 'max'] },
    { key: 'criteriaText', label: 'Criteria (Line / ;)', aliases: ['criteria', 'criteria text'] },
  ],
  schedule: [
    { key: 'id', label: 'Event ID', required: true, aliases: ['event id', 'id'] },
    { key: 'name', label: 'Event Name', aliases: ['event name', 'name'] },
    { key: 'scheduleDate', label: 'Date (YYYY-MM-DD)', aliases: ['date', 'schedule date'] },
    { key: 'scheduleStage', label: 'Stage Venue', aliases: ['stage venue', 'venue', 'stage'] },
    { key: 'time', label: 'Start Time (HH:MM)', aliases: ['start time', 'time'] },
    { key: 'scheduleDuration', label: 'Duration (min)', aliases: ['duration', 'minutes'] },
    { key: 'scheduleNotes', label: 'Schedule Notes', aliases: ['notes', 'schedule notes'] },
  ],
};

function buildTemplateSampleRows(scope: ExcelScope, general: GeneralConfig): Record<string, string>[] {
  const teams = general.teams?.length ? general.teams : ['red_house', 'blue_house'];
  const cats = general.categories?.length ? general.categories : ['Junior', 'Senior'];
  const stages = general.stages?.length ? general.stages : ['Stage 1', 'Stage 2'];
  if (scope === 'students') {
    return [
      { name: 'Amina Rahman', team: teams[0], gender: 'Girls', category: cats[0], class: '8', dob: '2012-04-12', chestNo: '101' },
      { name: 'Zayd Kareem', team: teams[1] || teams[0], gender: 'Boys', category: cats[0], class: '7', dob: '2013-02-19', chestNo: '102' },
      { name: 'Fathima Noura', team: teams[0], gender: 'Girls', category: cats[1] || cats[0], class: '10', dob: '2010-08-05', chestNo: '201' },
      { name: 'Imran Ali', team: teams[1] || teams[0], gender: 'Boys', category: cats[1] || cats[0], class: '+1', dob: '2009-11-22', chestNo: '202' },
    ];
  }
  if (scope === 'events') {
    return [
      { name: 'Malayalam Speech', code: 'E01', category: cats[0], gender: 'Boys', stage: 'On-Stage', type: 'Single', entriesPerTeam: '2', membersPerEntry: '1', resultMethod: 'criteria', maximumMark: '100', criteriaText: 'Content - 40; Delivery - 40; Language - 20' },
      { name: 'Essay Writing', code: 'E02', category: cats[0], gender: 'Girls', stage: 'Off-Stage', type: 'Single', entriesPerTeam: '3', membersPerEntry: '1', resultMethod: 'criteria', maximumMark: '100', criteriaText: 'Structure - 50; Originality - 50' },
      { name: 'Group Song', code: 'E03', category: cats[1] || cats[0], gender: 'Both', stage: 'On-Stage', type: 'Group', entriesPerTeam: '1', membersPerEntry: '6', resultMethod: 'criteria', maximumMark: '100', criteriaText: 'Harmony - 50; Rhythm - 50' },
      { name: 'Quiz Competition', code: 'E04', category: 'General', gender: 'Mixed', stage: 'On-Stage', type: 'Group', entriesPerTeam: '1', membersPerEntry: '2', resultMethod: 'objective', maximumMark: '50', criteriaText: '' },
    ];
  }
  return [
    { id: 'event_doc_id_1', name: 'Malayalam Speech', scheduleDate: '2026-03-10', scheduleStage: stages[0], time: '09:30', scheduleDuration: '45', scheduleNotes: 'Opening slot' },
    { id: 'event_doc_id_2', name: 'Essay Writing', scheduleDate: '2026-03-10', scheduleStage: stages[1] || stages[0], time: '10:00', scheduleDuration: '60', scheduleNotes: 'Bring pens' },
    { id: 'event_doc_id_3', name: 'Group Song', scheduleDate: '2026-03-10', scheduleStage: stages[0], time: '11:15', scheduleDuration: '60', scheduleNotes: '' },
    { id: 'event_doc_id_4', name: 'Quiz Competition', scheduleDate: '2026-03-11', scheduleStage: stages[0], time: '14:00', scheduleDuration: '90', scheduleNotes: 'Prelims + Finals' },
  ];
}

function makeEmptyRow(fields: FieldSpec[]): StagingRow {
  const cells: Record<string, string> = {};
  fields.forEach((f) => {
    cells[f.key] = '';
  });
  return { uid: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, skip: false, cells };
}

interface ExcelWorkspaceProps {
  scope: ExcelScope;
  general: GeneralConfig;
  existingStudents?: Student[];
  existingEvents?: FestEvent[];
  onCommitted: () => Promise<void>;
}

export const ExcelWorkspace: React.FC<ExcelWorkspaceProps> = ({
  scope,
  general,
  existingStudents = [],
  existingEvents = [],
  onCommitted,
}) => {
  const { toast, confirm } = useDialog();
  const fields = SCOPE_FIELDS[scope];

  const [rows, setRows] = useState<StagingRow[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRecords, setRawRecords] = useState<Record<string, any>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [workbookSheets, setWorkbookSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [loadedWb, setLoadedWb] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [committing, setCommitting] = useState(false);

  const festSetup = useMemo(() => normalizeFestSetup(general.festSetup || {}), [general.festSetup]);
  const classCfg = useMemo(
    () => normalizeCategoryClassificationConfig(general.categoryClassification || {}, festSetup.eligibleClasses),
    [general.categoryClassification, festSetup.eligibleClasses]
  );

  const applyColumnMapping = useCallback(
    (records: Record<string, any>[], mapping: Record<string, string>) => {
      const nextRows: StagingRow[] = records.map((rec, idx) => {
        const cells: Record<string, string> = {};
        fields.forEach((f) => {
          const sourceHeader = mapping[f.key];
          cells[f.key] = sourceHeader ? String(rec[sourceHeader] ?? '').trim() : '';
        });
        return { uid: `imp_${Date.now()}_${idx}`, skip: false, cells };
      });
      setRows(nextRows);
    },
    [fields]
  );

  const parseSheetFromWorkbook = async (wb: any, sheetName: string) => {
    const XLSX = await import('xlsx');
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
    const headers = jsonRows.length ? Object.keys(jsonRows[0]) : [];
    const autoMap: Record<string, string> = {};
    fields.forEach((f) => {
      const match = headers.find((h) => {
        const norm = h.trim().toLowerCase();
        return norm === f.key.toLowerCase() || norm === f.label.toLowerCase() || f.aliases.includes(norm);
      });
      if (match) autoMap[f.key] = match;
    });
    setRawHeaders(headers);
    setRawRecords(jsonRows);
    setColumnMap(autoMap);
    applyColumnMapping(jsonRows, autoMap);
  };

  const handleFileUpload = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const dataSheets = wb.SheetNames.filter((n) => n !== 'Reference Guide');
      const first = dataSheets[0] || wb.SheetNames[0];
      setLoadedWb(wb);
      setWorkbookSheets(wb.SheetNames);
      setSelectedSheet(first);
      await parseSheetFromWorkbook(wb, first);
      toast(`Loaded ${file.name} (${first}).`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to parse spreadsheet.', 'error');
    }
  };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const sampleRows = buildTemplateSampleRows(scope, general);
    const ordered = sampleRows.map((row) => {
      const out: Record<string, string> = {};
      fields.forEach((f) => {
        out[f.label] = row[f.key] || '';
      });
      return out;
    });
    const wb = XLSX.utils.book_new();
    const mainSheet = XLSX.utils.json_to_sheet(ordered);
    XLSX.utils.book_append_sheet(wb, mainSheet, `${scope.toUpperCase()}_DATA`);

    const guideRows = [
      { Field: 'Teams Configured', AllowedValues: (general.teams || []).join(', ') || 'red_house, blue_house' },
      { Field: 'Categories Configured', AllowedValues: (general.categories || []).join(', ') || 'Junior, Senior' },
      { Field: 'Stage Venues', AllowedValues: (general.stages || []).join(', ') || 'Stage 1, Stage 2' },
      { Field: 'Category Mode', AllowedValues: classCfg.mode },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guideRows), 'Reference Guide');
    XLSX.writeFile(wb, `feastport_${scope}_template.xlsx`);
    toast(`Downloaded ${scope} template with Reference Guide.`, 'success');
  };

  const exportCurrentData = async (format: 'xlsx' | 'csv') => {
    const XLSX = await import('xlsx');
    let data: Record<string, any>[] = [];
    if (scope === 'students') {
      data = existingStudents.map((s) => ({
        Name: s.name,
        Team: s.team,
        Gender: s.gender,
        Category: s.category,
        Class: s.details?.class || s.class || '',
        'DOB (YYYY-MM-DD)': s.details?.dob || s.dob || '',
        'Chest No': s.chestNo || '',
      }));
    } else if (scope === 'events') {
      data = existingEvents.map((e) => ({
        'Event Name': e.name,
        Code: e.code || '',
        Category: e.category,
        Gender: e.gender,
        'Stage Type': e.stage,
        'Type (Single/Group)': e.type,
        'Entries / Team': e.limit || 1,
        'Members / Entry': e.groupSize || 1,
        'Result Method': e.resultMethod || 'manual',
        'Max Mark': e.maximumMark || 100,
        'Criteria (Line / ;)': (e.criteria || []).map((c) => `${c.name} - ${c.maximumMark}`).join('; '),
      }));
    } else {
      data = existingEvents.map((e) => ({
        'Event ID': e.id,
        'Event Name': e.name,
        'Date (YYYY-MM-DD)': e.scheduleDate || e.date || '',
        'Stage Venue': e.scheduleStage || '',
        'Start Time (HH:MM)': e.time || '',
        'Duration (min)': e.scheduleDuration || 30,
        'Schedule Notes': e.scheduleNotes || '',
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, scope);
    if (format === 'csv') {
      XLSX.writeFile(wb, `feastport_${scope}_export.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, `feastport_${scope}_export.xlsx`);
    }
  };

  const loadActiveEventsIntoScheduleEditor = () => {
    const mapped: StagingRow[] = existingEvents
      .filter((e) => !e.cancelled)
      .map((e) => ({
        uid: `ev_${e.id}`,
        skip: false,
        cells: {
          id: e.id,
          name: e.name,
          scheduleDate: e.scheduleDate || e.date || '',
          scheduleStage: e.scheduleStage || '',
          time: e.time || '',
          scheduleDuration: String(e.scheduleDuration || e.duration || 30),
          scheduleNotes: e.scheduleNotes || '',
        },
      }));
    setRows(mapped);
    setEditMode(true);
    toast(`Loaded ${mapped.length} events into schedule sheet editor.`, 'info');
  };

  const startBlankSheet = () => {
    setRows([makeEmptyRow(fields), makeEmptyRow(fields), makeEmptyRow(fields), makeEmptyRow(fields)]);
    setEditMode(true);
  };

  // Validate rows & generate inline per-cell diagnostics
  const validatedRows = useMemo(() => {
    const teamSet = new Set(general.teams || []);
    const catSet = new Set(general.categories || []);
    const seenChests = new Set(
      existingStudents.map((s) => String(s.chestNo || '').trim().toLowerCase()).filter(Boolean)
    );
    const existingEventsById = new Map(existingEvents.map((e) => [e.id, e]));

    return rows.map((row) => {
      const cellErrors: Record<string, string> = {};
      if (row.skip) return { row, cellErrors, hasError: false };

      if (scope === 'students') {
        if (!row.cells.name) cellErrors.name = 'Required';
        if (!row.cells.team) cellErrors.team = 'Required';
        else if (teamSet.size && !teamSet.has(row.cells.team)) cellErrors.team = 'Unknown team key';
        if (!['Boys', 'Girls'].includes(row.cells.gender)) cellErrors.gender = 'Use Boys or Girls';
        if (classCfg.mode === 'manual') {
          if (!row.cells.category) cellErrors.category = 'Required';
          else if (catSet.size && !catSet.has(row.cells.category)) cellErrors.category = 'Unknown category';
        } else if (classCfg.mode === 'class') {
          const res = resolveCategoryFromStudentInputs({
            config: classCfg,
            categories: general.categories || [],
            classValue: row.cells.class,
          });
          if (!res.matched) cellErrors.class = 'No matching class rule';
        } else if (classCfg.mode === 'dob') {
          const res = resolveCategoryFromStudentInputs({
            config: classCfg,
            categories: general.categories || [],
            dobValue: row.cells.dob,
          });
          if (!res.matched) cellErrors.dob = 'DOB outside configured range';
        }
        if (row.cells.chestNo) {
          const low = row.cells.chestNo.trim().toLowerCase();
          if (seenChests.has(low)) cellErrors.chestNo = 'Duplicate chest number';
          seenChests.add(low);
        }
      } else if (scope === 'events') {
        const norm = normalizeEventRow(row.cells);
        const val = validateEvent(norm, { ...festSetup, categories: general.categories || [] }, existingEvents);
        if (!row.cells.name) cellErrors.name = 'Required';
        if (!row.cells.category) cellErrors.category = 'Required';
        if (val.errors.length) cellErrors.name = cellErrors.name || val.errors[0];
      } else {
        if (!row.cells.id || !existingEventsById.has(row.cells.id)) cellErrors.id = 'Unknown event ID';
        if (row.cells.scheduleDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.cells.scheduleDate)) {
          cellErrors.scheduleDate = 'Use YYYY-MM-DD';
        }
      }

      return { row, cellErrors, hasError: Object.keys(cellErrors).length > 0 };
    });
  }, [rows, scope, general, existingStudents, existingEvents, classCfg, festSetup]);

  const validReadyCount = validatedRows.filter((v) => !v.row.skip && !v.hasError).length;
  const errorCount = validatedRows.filter((v) => !v.row.skip && v.hasError).length;

  const commitValidRows = async () => {
    const { db } = getFirebaseState();
    if (!db) return;
    const ready = validatedRows.filter((v) => !v.row.skip && !v.hasError).map((v) => v.row);
    if (!ready.length) {
      toast('No valid rows ready to commit.', 'warning');
      return;
    }
    const ok = await confirm(`Commit ${ready.length} valid ${scope} row(s) to database?`, {
      title: 'Confirm Batch Commit',
      okLabel: `Commit ${ready.length} Rows`,
      tone: 'primary',
    });
    if (!ok) return;

    setCommitting(true);
    try {
      const now = Date.now();
      const virtualStudents = [...existingStudents];
      for (let i = 0; i < ready.length; i += 300) {
        const chunk = ready.slice(i, i + 300);
        const batch = writeBatch(db);

        chunk.forEach((row) => {
          if (scope === 'students') {
            const cls = normalizeClassValue(row.cells.class, classCfg.classes);
            const dob = row.cells.dob || '';
            let cat = row.cells.category;
            if (classCfg.mode !== 'manual') {
              const res = resolveCategoryFromStudentInputs({
                config: classCfg,
                categories: general.categories || [],
                classValue: cls,
                dobValue: dob,
              });
              if (res.matched) cat = res.category;
            }
            let chestNo = row.cells.chestNo.trim();
            if (!chestNo && general.chestConfig?.enabled) {
              const auto = resolveNextAutoChestNo({
                config: general.chestConfig,
                students: virtualStudents,
                team: row.cells.team,
                category: cat,
                gender: row.cells.gender,
              });
              if (auto.ok) chestNo = auto.chestNo;
            }
            const ref = doc(collection(db, 'students'));
            const details = buildStudentDetailsPatch({}, { classValue: cls, dobValue: dob });
            const payload: Record<string, any> = {
              name: row.cells.name.trim(),
              team: row.cells.team.trim(),
              category: cat.trim(),
              gender: row.cells.gender === 'Girls' ? 'Girls' : 'Boys',
              ...(chestNo ? { chestNo } : {}),
              details,
              importedAt: now,
              updatedAt: now,
            };
            virtualStudents.push({ id: ref.id, ...(payload as any) });
            batch.set(ref, payload);
          } else if (scope === 'events') {
            const norm = normalizeEventRow(row.cells);
            const val = validateEvent(norm, { ...festSetup, categories: general.categories || [] }, []);
            const payload = eventToFirestore(norm, { setup: festSetup, validation: val });
            const ref = doc(collection(db, 'events'));
            batch.set(ref, payload);
          } else {
            const evRef = doc(db, 'events', row.cells.id.trim());
            batch.update(evRef, {
              scheduleDate: row.cells.scheduleDate.trim(),
              scheduleStage: row.cells.scheduleStage.trim(),
              time: row.cells.time.trim(),
              scheduleDuration: Number(row.cells.scheduleDuration || 30),
              scheduleNotes: row.cells.scheduleNotes.trim(),
              updatedAt: now,
            });
          }
        });

        await batch.commit();
      }

      toast(`Successfully committed ${ready.length} ${scope} row(s).`, 'success');
      setRows([]);
      await onCommitted();
    } catch (err: any) {
      toast(err?.message || 'Batch commit failed.', 'error');
    } finally {
      setCommitting(false);
    }
  };

  const visibleItems = errorsOnly ? validatedRows.filter((v) => v.hasError) : validatedRows;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Template (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() => exportCurrentData('xlsx')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export .xlsx</span>
          </button>
          <button
            type="button"
            onClick={() => exportCurrentData('csv')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            data-excel-action="start-blank-sheet"
            onClick={startBlankSheet}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
          >
            <Table2 className="h-3.5 w-3.5" />
            <span>Start Blank Sheet</span>
          </button>
          {scope === 'schedule' && (
            <button
              type="button"
              onClick={loadActiveEventsIntoScheduleEditor}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <span>Load Active Events</span>
            </button>
          )}
        </div>

        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-blue-700">
          <FolderUp className="h-3.5 w-3.5" />
          <span>Upload .xlsx / .csv</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              handleFileUpload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {/* Staging controls */}
      {rows.length > 0 && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Total: <strong className="font-mono-num">{rows.length}</strong> · Ready:{' '}
                <strong className="font-mono-num text-emerald-700">{validReadyCount}</strong> · Errors:{' '}
                <strong className="font-mono-num text-red-600">{errorCount}</strong>
              </span>

              {workbookSheets.length > 1 && (
                <select
                  value={selectedSheet}
                  onChange={(e) => {
                    setSelectedSheet(e.target.value);
                    if (loadedWb) parseSheetFromWorkbook(loadedWb, e.target.value);
                  }}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
                >
                  {workbookSheets.map((sh) => (
                    <option key={sh} value={sh}>
                      Sheet: {sh}
                    </option>
                  ))}
                </select>
              )}

              <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={editMode}
                  onChange={(e) => setEditMode(e.target.checked)}
                />
                Edit Mode
              </label>

              <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={errorsOnly}
                  onChange={(e) => setErrorsOnly(e.target.checked)}
                />
                Errors Only
              </label>
            </div>

            <div className="flex items-center gap-2">
              <ActionIconButton
                icon={Plus}
                label="Add blank row"
                onClick={() => setRows((prev) => [...prev, makeEmptyRow(fields)])}
              />
              <button
                type="button"
                disabled={committing || validReadyCount === 0}
                onClick={commitValidRows}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-40"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{committing ? 'Committing…' : `Commit Valid Rows (${validReadyCount})`}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800">
                  <th className="w-10 px-2 py-2 text-center">Skip</th>
                  {fields.map((f) => (
                    <th key={f.key} className="px-2.5 py-2 whitespace-nowrap">
                      <div>
                        {f.label}
                        {f.required ? ' *' : ''}
                      </div>
                      {editMode && rawHeaders.length > 0 && (
                        <select
                          data-excel-map={scope}
                          value={columnMap[f.key] || ''}
                          onChange={(e) => {
                            const nextMap = { ...columnMap, [f.key]: e.target.value };
                            setColumnMap(nextMap);
                            applyColumnMapping(rawRecords, nextMap);
                          }}
                          className="mt-1 w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-normal normal-case"
                        >
                          <option value="">-- Unmapped --</option>
                          {rawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      )}
                    </th>
                  ))}
                  <th className="w-12 px-2 py-2 text-right">Row</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleItems.map(({ row, cellErrors, hasError }) => (
                  <tr
                    key={row.uid}
                    className={
                      row.skip
                        ? 'bg-slate-50/70 opacity-50'
                        : hasError
                        ? 'bg-red-50/40 dark:bg-red-950/20'
                        : ''
                    }
                  >
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={row.skip}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r) => (r.uid === row.uid ? { ...r, skip: e.target.checked } : r))
                          )
                        }
                      />
                    </td>
                    {fields.map((f) => {
                      const err = cellErrors[f.key];
                      return (
                        <td key={f.key} className="px-2.5 py-1.5 align-top">
                          {editMode ? (
                            <input
                              type="text"
                              value={row.cells[f.key] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.uid === row.uid ? { ...r, cells: { ...r.cells, [f.key]: val } } : r
                                  )
                                );
                              }}
                              className={`w-full min-w-[110px] rounded border px-2 py-1 text-xs ${
                                err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                              }`}
                            />
                          ) : (
                            <span className="text-slate-800 dark:text-slate-200">{row.cells[f.key] || '—'}</span>
                          )}
                          {err && (
                            <p data-cell-msg={f.key} className="mt-0.5 text-[10px] font-semibold text-red-600">
                              {err}
                            </p>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right">
                      <ActionIconButton
                        icon={Trash2}
                        label="Remove row"
                        tone="danger"
                        onClick={() => setRows((prev) => prev.filter((r) => r.uid !== row.uid))}
                      />
                    </td>
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
