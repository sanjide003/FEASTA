import type { CategoryClassificationConfig, ChestConfig, Student } from '../types/festival';

const CHEST_REGEX = /^[A-Za-z0-9_-]+$/;
const CHEST_SEED_REGEX = /^([A-Za-z0-9_-]*?)(\d+)$/;

export const studentGender = (student: Partial<Student> | null | undefined) =>
  student?.gender === 'Girls' ? 'Girls' : 'Boys';
export const chestKey = (team: string, category: string, gender: string) => `${team}-${category}-${gender}`;
export const legacyChestKey = (team: string, category: string) => `${team}-${category}`;

export function defaultChestConfig(): ChestConfig {
  return {
    enabled: false,
    splitByCategory: false,
    splitByGender: false,
    series: {},
  };
}

export function normalizeChestConfig(raw: Partial<ChestConfig> = {}): ChestConfig {
  const src = raw && typeof raw === 'object' ? raw : {};
  const series: Record<string, string> = {};
  if (src.series && typeof src.series === 'object') {
    for (const [k, v] of Object.entries(src.series)) {
      const cleaned = String(v ?? '').trim();
      if (k && cleaned) series[k] = cleaned;
    }
  }
  return {
    enabled: Boolean(src.enabled),
    splitByCategory: Boolean(src.splitByCategory),
    splitByGender: Boolean(src.splitByGender),
    series,
  };
}

export function chestSeriesKey({
  team = '',
  category = '',
  gender = 'Boys',
  splitByCategory = false,
  splitByGender = false,
} = {}) {
  const parts = [String(team || '').trim()];
  if (splitByCategory) parts.push(String(category || '').trim());
  if (splitByGender) parts.push(gender === 'Girls' ? 'Girls' : 'Boys');
  return parts.join('::');
}

export function parseChestSeed(rawSeed: unknown) {
  const seed = String(rawSeed ?? '').trim();
  if (!seed || seed.length > 32 || !CHEST_REGEX.test(seed)) return null;
  const match = seed.match(CHEST_SEED_REGEX);
  if (!match) return null;
  const [, prefix, digits] = match;
  const startNum = Number(digits);
  if (!Number.isSafeInteger(startNum) || startNum < 0) return null;
  return {
    raw: seed,
    prefix,
    digits,
    padLength: digits.length,
    startNum,
  };
}

export function formatChestCandidate(parsedSeed: { prefix: string; padLength: number }, num: number) {
  const padded = String(Math.max(0, num)).padStart(parsedSeed.padLength, '0');
  return `${parsedSeed.prefix}${padded}`;
}

export function getConfiguredChestSeed(
  config: Partial<ChestConfig>,
  { team = '', category = '', gender = 'Boys' } = {}
) {
  const cfg = normalizeChestConfig(config);
  const key = chestSeriesKey({
    team,
    category,
    gender,
    splitByCategory: cfg.splitByCategory,
    splitByGender: cfg.splitByGender,
  });
  return String(cfg.series[key] || '').trim();
}

export function resolveNextAutoChestNo({
  config,
  students = [],
  team = '',
  category = '',
  gender = 'Boys',
}: {
  config?: Partial<ChestConfig>;
  students?: Array<Partial<Student>>;
  team?: string;
  category?: string;
  gender?: string;
} = {}) {
  const cfg = normalizeChestConfig(config);
  if (!cfg.enabled) {
    return { ok: false, chestNo: '', reason: 'Automated chest numbering is disabled.' };
  }
  if (!team) {
    return { ok: false, chestNo: '', reason: 'Select a Team first.' };
  }
  if (cfg.splitByCategory && !category) {
    return { ok: false, chestNo: '', reason: 'Select a Category first.' };
  }
  if (cfg.splitByGender && !gender) {
    return { ok: false, chestNo: '', reason: 'Select a Gender first.' };
  }

  const seed = getConfiguredChestSeed(cfg, { team, category, gender });
  if (!seed) {
    return {
      ok: false,
      chestNo: '',
      reason: 'No starting chest number saved for this Team/Category/Gender in Festival Setup.',
    };
  }

  const parsed = parseChestSeed(seed);
  if (!parsed) {
    return {
      ok: false,
      chestNo: '',
      reason: `Invalid starting chest format "${seed}". End with digits (e.g., 101 or R101).`,
    };
  }

  const takenLower = new Set<string>();
  let maxMatchingNum = parsed.startNum - 1;
  const normalizedGender = gender === 'Girls' ? 'Girls' : 'Boys';
  const prefixLower = parsed.prefix.toLowerCase();

  for (const s of students) {
    const cRaw = String(s?.chestNo || '').trim();
    if (!cRaw) continue;
    takenLower.add(cRaw.toLowerCase());

    const sameTeam = s?.team === team;
    const sameCat = !cfg.splitByCategory || s?.category === category;
    const sameGender = !cfg.splitByGender || studentGender(s) === normalizedGender;
    if (!sameTeam || !sameCat || !sameGender) continue;

    const p = parseChestSeed(cRaw);
    if (!p || p.prefix.toLowerCase() !== prefixLower) continue;
    if (p.startNum > maxMatchingNum) {
      maxMatchingNum = p.startNum;
    }
  }

  let candidateNum = maxMatchingNum + 1;
  let guard = 0;
  let candidate = formatChestCandidate(parsed, candidateNum);
  while (takenLower.has(candidate.toLowerCase()) && guard < 100000) {
    candidateNum += 1;
    guard += 1;
    candidate = formatChestCandidate(parsed, candidateNum);
  }

  if (takenLower.has(candidate.toLowerCase())) {
    return { ok: false, chestNo: '', reason: 'Unable to find an unused chest number in this series.' };
  }

  return { ok: true, chestNo: candidate, reason: '', seed };
}

export function validateManualChestNo(
  rawChestNo: unknown,
  students: Array<Partial<Student>> = [],
  excludeStudentId = ''
) {
  const chestNo = String(rawChestNo ?? '').trim();
  if (!chestNo) return { ok: false, chestNo: '', error: 'Chest number is required.' };
  if (chestNo.length > 32) return { ok: false, chestNo, error: 'Chest number must be 32 characters or fewer.' };
  if (!CHEST_REGEX.test(chestNo)) {
    return { ok: false, chestNo, error: 'Chest number allows only letters, numbers, "-" or "_".' };
  }
  const lower = chestNo.toLowerCase();
  const conflict = students.find(
    (s) => s?.id !== excludeStudentId && String(s?.chestNo || '').trim().toLowerCase() === lower
  );
  if (conflict) {
    return {
      ok: false,
      chestNo,
      error: `Duplicate chest number "${chestNo}" is already assigned to ${conflict.name || 'another student'}.`,
    };
  }
  return { ok: true, chestNo, error: '' };
}

export const DEFAULT_CLASS_LIST = Object.freeze(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '+1', '+2']);
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function defaultCategoryClassificationConfig(classes: readonly string[] = DEFAULT_CLASS_LIST): CategoryClassificationConfig {
  const cleanClasses =
    Array.isArray(classes) && classes.length
      ? [...new Set(classes.map((c) => String(c ?? '').trim()).filter(Boolean))]
      : [...DEFAULT_CLASS_LIST];
  return {
    mode: 'manual',
    showClassInManual: false,
    showDobInManual: false,
    classes: cleanClasses,
    classRules: {},
    dobRules: {},
  };
}

export function normalizeCategoryClassificationConfig(
  raw: Record<string, any> = {},
  fallbackClasses: readonly string[] = DEFAULT_CLASS_LIST
): CategoryClassificationConfig {
  const src = raw && typeof raw === 'object' ? raw : {};
  const mode = (['manual', 'class', 'dob'].includes(src.mode) ? src.mode : 'manual') as 'manual' | 'class' | 'dob';
  const rawClasses = Array.isArray(src.classes)
    ? src.classes
    : typeof src.classes === 'string'
    ? src.classes.split(',')
    : fallbackClasses;
  const classes = [...new Set((rawClasses || []).map((c: unknown) => String(c ?? '').trim()).filter(Boolean))];
  const finalClasses = classes.length ? classes : [...DEFAULT_CLASS_LIST];

  const classRules: Record<string, string[]> = {};
  if (src.classRules && typeof src.classRules === 'object') {
    for (const [catKey, list] of Object.entries(src.classRules)) {
      if (!catKey || !Array.isArray(list)) continue;
      const cleanList = [...new Set(list.map((c) => String(c ?? '').trim()).filter(Boolean))];
      if (cleanList.length) classRules[catKey] = cleanList;
    }
  }

  const dobRules: Record<string, { from: string; to: string }> = {};
  if (src.dobRules && typeof src.dobRules === 'object') {
    for (const [catKey, range] of Object.entries(src.dobRules)) {
      if (!catKey || !range || typeof range !== 'object') continue;
      const r = range as Record<string, any>;
      const from = ISO_DATE_REGEX.test(String(r.from || '').trim()) ? String(r.from).trim() : '';
      const to = ISO_DATE_REGEX.test(String(r.to || '').trim()) ? String(r.to).trim() : '';
      if (from || to) dobRules[catKey] = { from, to };
    }
  }

  return {
    mode,
    showClassInManual: Boolean(src.showClassInManual),
    showDobInManual: Boolean(src.showDobInManual),
    classes: finalClasses,
    classRules,
    dobRules,
  };
}

export function getStudentFieldVisibility(config: Record<string, any> = {}) {
  const cfg = normalizeCategoryClassificationConfig(config);
  return {
    mode: cfg.mode,
    showClass: cfg.mode === 'class' || (cfg.mode === 'manual' && cfg.showClassInManual),
    showDob: cfg.mode === 'dob' || (cfg.mode === 'manual' && cfg.showDobInManual),
  };
}

export function normalizeClassValue(rawValue: unknown, configuredClasses: readonly string[] = DEFAULT_CLASS_LIST) {
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) return '';
  const stripped = trimmed.replace(/^class\s+/i, '').trim();
  const list =
    Array.isArray(configuredClasses) && configuredClasses.length ? configuredClasses : DEFAULT_CLASS_LIST;
  const exact = list.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;
  const noPrefix = list.find((c) => c.toLowerCase() === stripped.toLowerCase());
  if (noPrefix) return noPrefix;
  return trimmed;
}

export function resolveCategoryFromStudentInputs({
  config = {},
  categories = [],
  classValue = '',
  dobValue = '',
}: {
  config?: Record<string, any>;
  categories?: string[];
  classValue?: string;
  dobValue?: string;
} = {}) {
  const cfg = normalizeCategoryClassificationConfig(config);
  const catOrder =
    Array.isArray(categories) && categories.length
      ? categories
      : [...new Set([...Object.keys(cfg.classRules), ...Object.keys(cfg.dobRules)])];

  if (cfg.mode === 'class') {
    const normClass = normalizeClassValue(classValue, cfg.classes);
    if (!normClass) return { matched: false, category: '', mode: 'class' as const };
    const targetLower = normClass.toLowerCase();
    for (const catKey of catOrder) {
      const list = cfg.classRules[catKey] || [];
      if (list.some((c) => String(c).trim().toLowerCase() === targetLower)) {
        return { matched: true, category: catKey, mode: 'class' as const };
      }
    }
    return { matched: false, category: '', mode: 'class' as const };
  }

  if (cfg.mode === 'dob') {
    const dob = String(dobValue ?? '').trim();
    if (!ISO_DATE_REGEX.test(dob)) return { matched: false, category: '', mode: 'dob' as const };
    for (const catKey of catOrder) {
      const rule = cfg.dobRules[catKey];
      if (!rule || (!rule.from && !rule.to)) continue;
      if (rule.from && rule.to && rule.from > rule.to) continue;
      const afterFrom = !rule.from || dob >= rule.from;
      const beforeTo = !rule.to || dob <= rule.to;
      if (afterFrom && beforeTo) {
        return { matched: true, category: catKey, mode: 'dob' as const };
      }
    }
    return { matched: false, category: '', mode: 'dob' as const };
  }

  return { matched: false, category: '', mode: 'manual' as const };
}

export const studentClassValue = (student: Partial<Student> = {}) =>
  String(student?.details?.class ?? student?.class ?? '').trim();
export const studentDobValue = (student: Partial<Student> = {}) =>
  String(student?.details?.dob ?? student?.dob ?? '').trim();

export function buildStudentDetailsPatch(
  existingDetails: Record<string, any> = {},
  { classValue = '', dobValue = '' } = {}
) {
  const next = existingDetails && typeof existingDetails === 'object' ? { ...existingDetails } : {};
  const cleanClass = String(classValue ?? '').trim();
  const cleanDob = String(dobValue ?? '').trim();
  if (cleanClass) next.class = cleanClass;
  else delete next.class;
  if (cleanDob) next.dob = cleanDob;
  else delete next.dob;
  return next;
}
