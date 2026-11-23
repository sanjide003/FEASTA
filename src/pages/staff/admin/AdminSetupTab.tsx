import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { useDialog } from '../../../components/ui/DialogContext';
import { normalizeBranding } from '../../../lib/branding';
import { invalidateCache } from '../../../lib/dataCache';
import { normalizeFestSetup, slugKey } from '../../../lib/festConfig';
import { getFirebaseState } from '../../../lib/firebase';
import { assertPayloadSize, compressImageFile, MAX_IMAGE_LABEL } from '../../../lib/imageUpload';
import { normalizeRegistrationConfig } from '../../../lib/registrationUtils';
import { defaultScoringRules, normalizeScoringRules } from '../../../lib/scoreUtils';
import {
  chestSeriesKey,
  normalizeCategoryClassificationConfig,
  normalizeChestConfig,
} from '../../../lib/studentUtils';
import type { BrandingConfig, ChestConfig, GeneralConfig } from '../../../types/festival';
import type { AdminActions, AdminState } from './types';

type SetupSubtab = 'identity' | 'teams_chest' | 'categories_venues' | 'classification' | 'registration' | 'scoring';

export const AdminSetupTab: React.FC<{ state: AdminState; actions: AdminActions }> = ({ state, actions }) => {
  const { toast } = useDialog();
  const [subtab, setSubtab] = useState<SetupSubtab>('identity');
  const [saving, setSaving] = useState(false);

  // Local drafts synced with Firestore snapshots
  const [branding, setBranding] = useState<BrandingConfig>(() => normalizeBranding(state.branding));
  const [festSetup, setFestSetup] = useState(() => normalizeFestSetup(state.general.festSetup || {}));
  const [teams, setTeams] = useState<string[]>(state.general.teams || []);
  const [teamNames, setTeamNames] = useState<Record<string, string>>(state.general.teamDisplayNames || {});
  const [teamColors, setTeamColors] = useState<Record<string, string>>(state.general.teamColors || {});
  const [newTeamLabel, setNewTeamLabel] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#1D4ED8');

  const [chestCfg, setChestCfg] = useState<ChestConfig>(() => normalizeChestConfig(state.general.chestConfig || {}));

  const [categories, setCategories] = useState<string[]>(state.general.categories || []);
  const [catNames, setCatNames] = useState<Record<string, string>>(state.general.categoryDisplayNames || {});
  const [newCatLabel, setNewCatLabel] = useState('');
  const [stages, setStages] = useState<string[]>(state.general.stages || []);
  const [newStage, setNewStage] = useState('');
  const [days, setDays] = useState<Array<{ id?: string; label?: string; date: string }>>(
    state.general.festivalDays || []
  );

  const [classCfg, setClassCfg] = useState(() =>
    normalizeCategoryClassificationConfig(state.general.categoryClassification || {}, festSetup.eligibleClasses)
  );
  const [classesInput, setClassesInput] = useState(classCfg.classes.join(', '));

  const [regCfg, setRegCfg] = useState(() => normalizeRegistrationConfig(state.registrationConfig || {}));
  const [regLockAt, setRegLockAt] = useState<string>(() => {
    const ms = Number(state.scheduleConfig?.registrationLockAt || 0);
    return ms ? new Date(ms).toISOString().slice(0, 16) : '';
  });

  const [scoringRules, setScoringRules] = useState(() => normalizeScoringRules(state.scoringRules || defaultScoringRules()));

  useEffect(() => {
    setBranding(normalizeBranding(state.branding));
  }, [state.branding]);

  useEffect(() => {
    const setup = normalizeFestSetup(state.general.festSetup || {});
    setFestSetup(setup);
    setTeams(state.general.teams || []);
    setTeamNames(state.general.teamDisplayNames || {});
    setTeamColors(state.general.teamColors || {});
    setChestCfg(normalizeChestConfig(state.general.chestConfig || {}));
    setCategories(state.general.categories || []);
    setCatNames(state.general.categoryDisplayNames || {});
    setStages(state.general.stages || []);
    setDays(state.general.festivalDays || []);
    const cc = normalizeCategoryClassificationConfig(state.general.categoryClassification || {}, setup.eligibleClasses);
    setClassCfg(cc);
    setClassesInput(cc.classes.join(', '));
  }, [state.general]);

  useEffect(() => {
    setRegCfg(normalizeRegistrationConfig(state.registrationConfig || {}));
  }, [state.registrationConfig]);

  useEffect(() => {
    setScoringRules(normalizeScoringRules(state.scoringRules || defaultScoringRules()));
  }, [state.scoringRules]);

  const handleSaveIdentity = async () => {
    const { db } = getFirebaseState();
    if (!db) return;
    setSaving(true);
    try {
      const homePayload: BrandingConfig = {
        ...branding,
        configured: true,
        setupCompleted: true,
        festName1: branding.festName1.trim() || 'Festival Portal',
      };
      assertPayloadSize(homePayload, 'home_config');
      await Promise.all([
        setDoc(doc(db, 'settings', 'home_config'), homePayload, { merge: true }),
        setDoc(doc(db, 'settings', 'general'), { festSetup }, { merge: true }),
      ]);
      invalidateCache('doc:settings/');
      await actions.refreshScopes(['setup'], true);
      toast('Identity, gallery, and public layout saved.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to save identity settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGeneralConfig = async (extraMessage = 'Festival setup saved.') => {
    const { db } = getFirebaseState();
    if (!db) return;
    setSaving(true);
    try {
      const cleanClasses = classesInput
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      const nextClassCfg = { ...classCfg, classes: cleanClasses.length ? cleanClasses : classCfg.classes };
      const nextSetup = {
        ...festSetup,
        eligibleClasses: nextClassCfg.classes,
        studentFields: festSetup.studentFields.map((f) =>
          f.key === 'class' ? { ...f, options: nextClassCfg.classes } : f
        ),
      };
      const payload: GeneralConfig = {
        teams,
        teamDisplayNames: teamNames,
        teamColors,
        categories,
        categoryDisplayNames: catNames,
        stages,
        festivalDays: days.filter((d) => d.date),
        chestConfig: chestCfg,
        categoryClassification: nextClassCfg,
        festSetup: nextSetup,
      };
      await setDoc(doc(db, 'settings', 'general'), payload, { merge: true });
      invalidateCache('doc:settings/general');
      await actions.syncSummary(state.students.length, state.results);
      await actions.refreshScopes(['setup'], true);
      toast(extraMessage, 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to save setup.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRegistration = async () => {
    const { db } = getFirebaseState();
    if (!db) return;
    setSaving(true);
    try {
      const lockMs = regLockAt ? new Date(regLockAt).getTime() : null;
      await Promise.all([
        setDoc(doc(db, 'settings', 'registration_config'), regCfg, { merge: true }),
        setDoc(doc(db, 'settings', 'schedule_config'), { registrationLockAt: lockMs }, { merge: true }),
      ]);
      invalidateCache('doc:settings/');
      await actions.refreshScopes(['setup'], true);
      toast('Registration rules and lock deadline saved.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to save registration settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveScoring = async () => {
    const { db } = getFirebaseState();
    if (!db) return;
    setSaving(true);
    try {
      const normalized = normalizeScoringRules(scoringRules);
      await setDoc(doc(db, 'settings', 'scoring_rules'), normalized, { merge: true });
      invalidateCache('doc:settings/scoring_rules');
      await actions.refreshScopes(['setup'], true);
      toast('Scoring rules saved.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Unable to save scoring rules.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addTeam = () => {
    const label = newTeamLabel.trim();
    const key = slugKey(label);
    if (!key) return;
    if (teams.includes(key)) {
      toast('Team key already exists.', 'warning');
      return;
    }
    setTeams((prev) => [...prev, key]);
    setTeamNames((prev) => ({ ...prev, [key]: label }));
    setTeamColors((prev) => ({ ...prev, [key]: newTeamColor }));
    setNewTeamLabel('');
  };

  const addCategory = () => {
    const label = newCatLabel.trim();
    const key = slugKey(label);
    if (!key) return;
    if (categories.includes(key)) {
      toast('Category already exists.', 'warning');
      return;
    }
    setCategories((prev) => [...prev, key]);
    setCatNames((prev) => ({ ...prev, [key]: label }));
    setNewCatLabel('');
  };

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await compressImageFile(file);
      setBranding((prev) => ({ ...prev, logoUrl: url }));
      toast('Logo compressed and attached.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Image upload failed.', 'error');
    }
  };

  const handleGalleryUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const uploaded: string[] = [];
      for (const f of Array.from(files).slice(0, 8)) {
        uploaded.push(await compressImageFile(f));
      }
      setBranding((prev) => ({ ...prev, gallery: [...(prev.gallery || []), ...uploaded].slice(0, 12) }));
      toast(`Added ${uploaded.length} gallery photo(s). Click Save to persist.`, 'success');
    } catch (err: any) {
      toast(err?.message || 'Gallery upload failed.', 'error');
    }
  };

  const moveGalleryItem = (idx: number, dir: -1 | 1) => {
    const list = [...(branding.gallery || [])];
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    setBranding({ ...branding, gallery: list });
  };

  const chestMatrixKeys = () => {
    const cats = chestCfg.splitByCategory && categories.length ? categories : [''];
    const genders = chestCfg.splitByGender ? ['Boys', 'Girls'] : ['Boys'];
    const rows: Array<{ key: string; label: string }> = [];
    for (const t of teams) {
      for (const c of cats) {
        for (const g of genders) {
          const k = chestSeriesKey({
            team: t,
            category: c,
            gender: g,
            splitByCategory: chestCfg.splitByCategory,
            splitByGender: chestCfg.splitByGender,
          });
          const parts = [teamNames[t] || t];
          if (chestCfg.splitByCategory && c) parts.push(catNames[c] || c);
          if (chestCfg.splitByGender) parts.push(g);
          rows.push({ key: k, label: parts.join(' · ') });
        }
      }
    }
    return rows;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Festival Setup</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure branding, teams, chest numbering, classification, registration limits, and scoring matrices.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'identity', label: 'Identity & Public' },
            { id: 'teams_chest', label: 'Teams & Chest No' },
            { id: 'categories_venues', label: 'Categories & Venues' },
            { id: 'classification', label: 'Category Classification' },
            { id: 'registration', label: 'Registration Rules' },
            { id: 'scoring', label: 'Scoring Matrix' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              data-subtab={t.id}
              onClick={() => setSubtab(t.id as SetupSubtab)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                subtab === t.id
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* IDENTITY & GALLERY */}
      {subtab === 'identity' && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Festival Primary Name
              </label>
              <input
                type="text"
                value={branding.festName1}
                onChange={(e) => setBranding({ ...branding, festName1: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Secondary Title / Edition
              </label>
              <input
                type="text"
                value={branding.festName2}
                onChange={(e) => setBranding({ ...branding, festName2: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Tagline</label>
              <input
                type="text"
                value={branding.tagline}
                onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">About Subtitle</label>
              <input
                type="text"
                value={branding.aboutSubtitle}
                onChange={(e) => setBranding({ ...branding, aboutSubtitle: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Footer Note</label>
              <input
                type="text"
                value={branding.footerText}
                onChange={(e) => setBranding({ ...branding, footerText: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">About Description</label>
            <textarea
              rows={3}
              value={branding.aboutText}
              onChange={(e) => setBranding({ ...branding, aboutText: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Festival Logo ({MAX_IMAGE_LABEL})
              </label>
              <div className="flex items-center gap-3">
                {branding.logoUrl && (
                  <img
                    src={branding.logoUrl}
                    alt="Logo"
                    className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                  />
                )}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700">
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Home Page Visibility
              </label>
              <div className="flex flex-wrap gap-3 text-xs">
                {(['hero', 'about', 'leaders', 'gallery', 'schedule', 'teamStandings'] as const).map((sec) => (
                  <label key={sec} className="flex items-center gap-1.5 font-medium capitalize">
                    <input
                      type="checkbox"
                      checked={festSetup.publicView.landing.sections[sec] !== false}
                      onChange={(e) =>
                        setFestSetup((prev) => ({
                          ...prev,
                          publicView: {
                            ...prev.publicView,
                            landing: {
                              ...prev.publicView.landing,
                              sections: { ...prev.publicView.landing.sections, [sec]: e.target.checked },
                            },
                          },
                        }))
                      }
                    />
                    {sec.replace(/([A-Z])/g, ' $1')}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Photo Gallery compact 1.5cm thumbnails */}
          <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Exhibition Photo Gallery</p>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700">
                <ImagePlus className="h-3.5 w-3.5" />
                <span>Add Photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleGalleryUpload(e.target.files)}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              {(branding.gallery || []).map((src, idx) => (
                <div
                  key={`${idx}-${src.slice(0, 24)}`}
                  className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 p-1.5 dark:border-slate-700"
                >
                  <img src={src} alt={`Gallery ${idx + 1}`} className="h-14 w-14 rounded object-cover" />
                  <div className="flex items-center gap-1">
                    <ActionIconButton
                      icon={ArrowLeft}
                      label="Move left"
                      disabled={idx === 0}
                      onClick={() => moveGalleryItem(idx, -1)}
                    />
                    <ActionIconButton
                      icon={ArrowRight}
                      label="Move right"
                      disabled={idx === (branding.gallery?.length || 0) - 1}
                      onClick={() => moveGalleryItem(idx, 1)}
                    />
                    <ActionIconButton
                      icon={Trash2}
                      label="Remove photo"
                      tone="danger"
                      onClick={() =>
                        setBranding({
                          ...branding,
                          gallery: (branding.gallery || []).filter((_, i) => i !== idx),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Android App Packages (APK / AAB) */}
          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Android App Packages (APK / AAB)
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Paste hosted APK / AAB download links (e.g. from GitHub Actions TWA build or Firebase Storage) to enable direct package downloads from the home page.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Direct APK Download URL (.apk)
                </label>
                <input
                  type="url"
                  value={branding.appDownloads?.apkUrl || ''}
                  onChange={(e) =>
                    setBranding({
                      ...branding,
                      appDownloads: { ...(branding.appDownloads || {}), apkUrl: e.target.value },
                    })
                  }
                  placeholder="https://.../app-release-signed.apk"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Play Store Bundle URL (.aab)
                </label>
                <input
                  type="url"
                  value={branding.appDownloads?.aabUrl || ''}
                  onChange={(e) =>
                    setBranding({
                      ...branding,
                      appDownloads: { ...(branding.appDownloads || {}), aabUrl: e.target.value },
                    })
                  }
                  placeholder="https://.../app-release-bundle.aab"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  App Version
                </label>
                <input
                  type="text"
                  value={branding.appDownloads?.versionName || ''}
                  onChange={(e) =>
                    setBranding({
                      ...branding,
                      appDownloads: { ...(branding.appDownloads || {}), versionName: e.target.value },
                    })
                  }
                  placeholder="1.0.0"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Android Package ID
                </label>
                <input
                  type="text"
                  value={branding.appDownloads?.packageId || ''}
                  onChange={(e) =>
                    setBranding({
                      ...branding,
                      appDownloads: { ...(branding.appDownloads || {}), packageId: e.target.value },
                    })
                  }
                  placeholder="com.feastport.app"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveIdentity}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Identity &amp; Layout</span>
            </button>
          </div>
        </div>
      )}

      {/* TEAMS & CHEST NUMBERING */}
      {subtab === 'teams_chest' && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">Festival Teams</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newTeamLabel}
                onChange={(e) => setNewTeamLabel(e.target.value)}
                placeholder="New Team Name (e.g. Red House)"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="color"
                value={newTeamColor}
                onChange={(e) => setNewTeamColor(e.target.value)}
                className="h-8 w-12 rounded border border-slate-300 p-0.5"
              />
              <button
                type="button"
                onClick={addTeam}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" /> Add Team
              </button>
            </div>

            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {teams.map((t) => (
                <div key={t} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={teamColors[t] || '#1D4ED8'}
                      onChange={(e) => setTeamColors({ ...teamColors, [t]: e.target.value })}
                      className="h-7 w-9 rounded border border-slate-300 p-0.5"
                    />
                    <input
                      type="text"
                      value={teamNames[t] ?? t}
                      onChange={(e) => setTeamNames({ ...teamNames, [t]: e.target.value })}
                      className="rounded border border-slate-300 px-2.5 py-1 font-semibold dark:border-slate-700 dark:bg-slate-800"
                    />
                    <span className="font-mono-num text-[11px] text-slate-400">key: {t}</span>
                  </div>
                  <ActionIconButton
                    icon={Trash2}
                    label="Remove team"
                    tone="danger"
                    onClick={() => setTeams((prev) => prev.filter((x) => x !== t))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              Automated Chest Numbering
            </h2>
            <div className="flex flex-wrap gap-4 text-xs font-semibold">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={chestCfg.enabled}
                  onChange={(e) => setChestCfg({ ...chestCfg, enabled: e.target.checked })}
                />
                Enable Auto Chest Series
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={chestCfg.splitByCategory}
                  onChange={(e) => setChestCfg({ ...chestCfg, splitByCategory: e.target.checked })}
                />
                Separate per Category
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={chestCfg.splitByGender}
                  onChange={(e) => setChestCfg({ ...chestCfg, splitByGender: e.target.checked })}
                />
                Separate per Gender
              </label>
            </div>

            {chestCfg.enabled && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {chestMatrixKeys().map((item) => (
                  <div key={item.key} className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">{item.label}</label>
                    <input
                      type="text"
                      value={chestCfg.series[item.key] || ''}
                      onChange={(e) =>
                        setChestCfg({
                          ...chestCfg,
                          series: { ...chestCfg.series, [item.key]: e.target.value },
                        })
                      }
                      placeholder="e.g. 101 or R101"
                      className="w-full rounded border border-slate-300 px-2.5 py-1 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveGeneralConfig('Teams & chest configuration saved.')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Teams &amp; Chest Series</span>
            </button>
          </div>
        </div>
      )}

      {/* CATEGORIES & VENUES */}
      {subtab === 'categories_venues' && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Categories */}
            <div className="space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">Categories</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="New Category (e.g. Sub Junior)"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={addCategory}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {categories.map((c) => (
                  <div key={c} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <input
                      type="text"
                      value={catNames[c] ?? c}
                      onChange={(e) => setCatNames({ ...catNames, [c]: e.target.value })}
                      className="rounded border border-slate-300 px-2 py-1 font-semibold dark:border-slate-700 dark:bg-slate-800"
                    />
                    <ActionIconButton
                      icon={Trash2}
                      label="Remove category"
                      tone="danger"
                      onClick={() => setCategories((prev) => prev.filter((x) => x !== c))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Stage Venues & Festival Days */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">Stage Venues</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    placeholder="Stage Name (e.g. Main Stage)"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newStage.trim()) {
                        setStages((prev) => [...new Set([...prev, newStage.trim()])]);
                        setNewStage('');
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stages.map((st) => (
                    <div
                      key={st}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold dark:border-slate-700"
                    >
                      <span>{st}</span>
                      <ActionIconButton
                        icon={Trash2}
                        label="Remove stage"
                        tone="danger"
                        onClick={() => setStages((prev) => prev.filter((x) => x !== st))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Festival Days</h3>
                  <ActionIconButton
                    icon={Plus}
                    label="Add festival day"
                    onClick={() => setDays((prev) => [...prev, { id: `day_${prev.length + 1}`, label: `Day ${prev.length + 1}`, date: '' }])}
                  />
                </div>
                {days.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={d.label || ''}
                      onChange={(e) =>
                        setDays((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                      }
                      placeholder="Day 1"
                      className="w-28 rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                      type="date"
                      value={d.date || ''}
                      onChange={(e) =>
                        setDays((prev) => prev.map((x, i) => (i === idx ? { ...x, date: e.target.value } : x)))
                      }
                      className="flex-1 rounded border border-slate-300 px-2 py-1 font-mono-num text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <ActionIconButton
                      icon={Trash2}
                      label="Remove day"
                      tone="danger"
                      onClick={() => setDays((prev) => prev.filter((_, i) => i !== idx))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveGeneralConfig('Categories, venues, and festival days saved.')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Categories &amp; Venues</span>
            </button>
          </div>
        </div>
      )}

      {/* CATEGORY CLASSIFICATION */}
      {subtab === 'classification' && (
        <div
          id="setup-subview-classification"
          className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div id="category-classification-card" className="space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Category Classification Mode
              </h2>
              <p className="text-xs text-slate-500">
                Choose how categories are assigned when adding or importing students: manually, by class, or by DOB range.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold">Classification Mode</label>
                <select
                  value={classCfg.mode}
                  onChange={(e) => setClassCfg({ ...classCfg, mode: e.target.value as any })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="manual">Manual Category Selection</option>
                  <option value="class">Auto-classify by Class</option>
                  <option value="dob">Auto-classify by Date of Birth</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Configured Classes (comma-separated)</label>
                <input
                  type="text"
                  value={classesInput}
                  onChange={(e) => setClassesInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            {classCfg.mode === 'manual' && (
              <div className="flex flex-wrap gap-4 text-xs font-semibold">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={classCfg.showClassInManual}
                    onChange={(e) => setClassCfg({ ...classCfg, showClassInManual: e.target.checked })}
                  />
                  Show Class field in Manual Mode
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={classCfg.showDobInManual}
                    onChange={(e) => setClassCfg({ ...classCfg, showDobInManual: e.target.checked })}
                  />
                  Show DOB field in Manual Mode
                </label>
              </div>
            )}

            {classCfg.mode === 'class' && (
              <div className="space-y-3">
                {categories.map((cat) => {
                  const selected = classCfg.classRules[cat] || [];
                  const clsList = classesInput
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  return (
                    <div key={cat} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{catNames[cat] || cat}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {clsList.map((cls) => {
                          const on = selected.includes(cls);
                          return (
                            <label
                              key={cls}
                              className={`cursor-pointer rounded border px-2 py-1 text-xs ${
                                on ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700' : 'border-slate-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mr-1"
                                checked={on}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...selected, cls]
                                    : selected.filter((x) => x !== cls);
                                  setClassCfg({
                                    ...classCfg,
                                    classRules: { ...classCfg.classRules, [cat]: next },
                                  });
                                }}
                              />
                              {cls}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {classCfg.mode === 'dob' && (
              <div className="space-y-2">
                {categories.map((cat) => {
                  const rule = classCfg.dobRules[cat] || { from: '', to: '' };
                  return (
                    <div
                      key={cat}
                      className="grid items-center gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3 dark:border-slate-700"
                    >
                      <span className="text-xs font-bold">{catNames[cat] || cat}</span>
                      <input
                        type="date"
                        value={rule.from}
                        onChange={(e) =>
                          setClassCfg({
                            ...classCfg,
                            dobRules: { ...classCfg.dobRules, [cat]: { ...rule, from: e.target.value } },
                          })
                        }
                        className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                      />
                      <input
                        type="date"
                        value={rule.to}
                        onChange={(e) =>
                          setClassCfg({
                            ...classCfg,
                            dobRules: { ...classCfg.dobRules, [cat]: { ...rule, to: e.target.value } },
                          })
                        }
                        className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveGeneralConfig('Category classification rules saved.')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Classification Rules</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTRATION RULES */}
      {subtab === 'registration' && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">
              <input
                type="checkbox"
                checked={regCfg.registrationPortalEnabled}
                onChange={(e) =>
                  setRegCfg({
                    ...regCfg,
                    registrationPortalEnabled: e.target.checked,
                    studentApplicationsEnabled: e.target.checked,
                  })
                }
              />
              Enable Student Registration Portal
            </label>
            <div>
              <label className="mb-1 block text-xs font-semibold">Global Status</label>
              <select
                value={regCfg.globalStatus}
                onChange={(e) => setRegCfg({ ...regCfg, globalStatus: e.target.value as any })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="open">Open</option>
                <option value="unfilled_only">Unfilled Events Only</option>
                <option value="waitlist_only">Waitlist Only</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Team Leader Lock Deadline</label>
              <input
                type="datetime-local"
                value={regLockAt}
                onChange={(e) => setRegLockAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Max Participations per Student
            </h3>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(['single', 'group', 'onStage', 'offStage', 'general', 'total'] as const).map((bucket) => {
                const cfg = regCfg.participationLimits[bucket];
                return (
                  <div key={bucket} className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                    <p className="text-[11px] font-bold capitalize text-slate-700 dark:text-slate-200">{bucket}</p>
                    <select
                      value={cfg.mode}
                      onChange={(e) =>
                        setRegCfg({
                          ...regCfg,
                          participationLimits: {
                            ...regCfg.participationLimits,
                            [bucket]: { ...cfg, mode: e.target.value },
                          },
                        })
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="unlimited">Unlimited</option>
                      <option value="custom">Custom Limit</option>
                    </select>
                    {cfg.mode === 'custom' && (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={cfg.limit}
                        onChange={(e) =>
                          setRegCfg({
                            ...regCfg,
                            participationLimits: {
                              ...regCfg.participationLimits,
                              [bucket]: { ...cfg, limit: Number(e.target.value || 0) },
                            },
                          })
                        }
                        className="mt-1.5 w-full rounded border border-slate-300 px-2 py-1 font-mono-num text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveRegistration}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Registration Policy</span>
            </button>
          </div>
        </div>
      )}

      {/* SCORING MATRIX */}
      {subtab === 'scoring' && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap gap-5 text-xs font-semibold">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scoringRules.enabled.points}
                onChange={(e) =>
                  setScoringRules({ ...scoringRules, enabled: { ...scoringRules.enabled, points: e.target.checked } })
                }
              />
              Enable Position Points
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scoringRules.enabled.grades}
                onChange={(e) =>
                  setScoringRules({ ...scoringRules, enabled: { ...scoringRules.enabled, grades: e.target.checked } })
                }
              />
              Enable Additive Grade Points
            </label>
            <div className="flex items-center gap-2">
              <span>Multi-Judge Method:</span>
              <select
                value={scoringRules.policies.multipleJudgeMethod}
                onChange={(e) =>
                  setScoringRules({
                    ...scoringRules,
                    policies: { ...scoringRules.policies, multipleJudgeMethod: e.target.value },
                  })
                }
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="average">Average</option>
                <option value="trim_extremes">Trim Extremes</option>
                <option value="weighted">Weighted</option>
              </select>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {(['Single', 'Group'] as const).map((evType) => (
              <div key={evType} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {evType} Position Points
                  </h3>
                  <ActionIconButton
                    icon={Plus}
                    label={`Add ${evType} position`}
                    onClick={() => {
                      const cur = scoringRules.configs[evType].points;
                      setScoringRules({
                        ...scoringRules,
                        configs: {
                          ...scoringRules.configs,
                          [evType]: {
                            ...scoringRules.configs[evType],
                            points: [
                              ...cur,
                              {
                                key: `position_${cur.length + 1}`,
                                rank: cur.length + 1,
                                label: `Place ${cur.length + 1}`,
                                value: 1,
                                tiePolicy: 'full',
                              },
                            ],
                          },
                        },
                      });
                    }}
                  />
                </div>
                {scoringRules.configs[evType].points.map((pt: any, idx: number) => (
                  <div key={pt.key} className="flex items-center gap-2 text-xs">
                    <input
                      type="text"
                      value={pt.label}
                      onChange={(e) => {
                        const next = [...scoringRules.configs[evType].points];
                        next[idx] = { ...pt, label: e.target.value };
                        setScoringRules({
                          ...scoringRules,
                          configs: { ...scoringRules.configs, [evType]: { ...scoringRules.configs[evType], points: next } },
                        });
                      }}
                      className="flex-1 rounded border border-slate-300 px-2.5 py-1"
                    />
                    <input
                      type="number"
                      value={pt.value}
                      onChange={(e) => {
                        const next = [...scoringRules.configs[evType].points];
                        next[idx] = { ...pt, value: Number(e.target.value || 0) };
                        setScoringRules({
                          ...scoringRules,
                          configs: { ...scoringRules.configs, [evType]: { ...scoringRules.configs[evType], points: next } },
                        });
                      }}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right font-mono-num"
                    />
                    <ActionIconButton
                      icon={Trash2}
                      label="Remove position"
                      tone="danger"
                      onClick={() => {
                        const next = scoringRules.configs[evType].points.filter((_: any, i: number) => i !== idx);
                        setScoringRules({
                          ...scoringRules,
                          configs: { ...scoringRules.configs, [evType]: { ...scoringRules.configs[evType], points: next } },
                        });
                      }}
                    />
                  </div>
                ))}

                {scoringRules.enabled.grades && (
                  <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        {evType} Grade Thresholds
                      </span>
                      <ActionIconButton
                        icon={Plus}
                        label={`Add ${evType} grade`}
                        onClick={() => {
                          const cur = scoringRules.configs[evType].grades;
                          setScoringRules({
                            ...scoringRules,
                            configs: {
                              ...scoringRules.configs,
                              [evType]: {
                                ...scoringRules.configs[evType],
                                grades: [
                                  ...cur,
                                  { key: `${evType.toLowerCase()}_grade_${cur.length + 1}`, order: cur.length + 1, label: `Grade ${cur.length + 1}`, minimumPercentage: 50, value: 1 },
                                ],
                              },
                            },
                          });
                        }}
                      />
                    </div>
                    {scoringRules.configs[evType].grades.map((gr: any, idx: number) => (
                      <div key={gr.key} className="mb-1.5 flex items-center gap-2 text-xs">
                        <input
                          type="text"
                          value={gr.label}
                          onChange={(e) => {
                            const next = [...scoringRules.configs[evType].grades];
                            next[idx] = { ...gr, label: e.target.value };
                            setScoringRules({
                              ...scoringRules,
                              configs: { ...scoringRules.configs, [evType]: { ...scoringRules.configs[evType], grades: next } },
                            });
                          }}
                          className="flex-1 rounded border border-slate-300 px-2 py-1"
                        />
                        <input
                          type="number"
                          value={gr.minimumPercentage}
                          title="Min %"
                          onChange={(e) => {
                            const next = [...scoringRules.configs[evType].grades];
                            next[idx] = { ...gr, minimumPercentage: Number(e.target.value || 0) };
                            setScoringRules({
                              ...scoringRules,
                              configs: { ...scoringRules.configs, [evType]: { ...scoringRules.configs[evType], grades: next } },
                            });
                          }}
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-right font-mono-num"
                        />
                        <input
                          type="number"
                          value={gr.value}
                          title="Points"
                          onChange={(e) => {
                            const next = [...scoringRules.configs[evType].grades];
                            next[idx] = { ...gr, value: Number(e.target.value || 0) };
                            setScoringRules({
                              ...scoringRules,
                              configs: { ...scoringRules.configs, [evType]: { ...scoringRules.configs[evType], grades: next } },
                            });
                          }}
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-right font-mono-num"
                        />
                        <ActionIconButton
                          icon={Trash2}
                          label="Remove grade"
                          tone="danger"
                          onClick={() => {
                            const next = scoringRules.configs[evType].grades.filter((_: any, i: number) => i !== idx);
                            setScoringRules({
                              ...scoringRules,
                              configs: { ...scoringRules.configs, [evType]: { ...scoringRules.configs[evType], grades: next } },
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveScoring}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Scoring Rules</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
