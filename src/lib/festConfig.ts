import type { FestEvent, FestSetup, PublicViewConfig, StudentFieldDef } from '../types/festival';

export const DEFAULT_PUBLIC_VIEW: Readonly<PublicViewConfig> = Object.freeze({
  landing: {
    sections: {
      hero: true,
      about: true,
      leaders: true,
      gallery: true,
      schedule: true,
      teamStandings: true,
      footer: true,
    },
    customLinks: [],
  },
  resultsPage: {
    defaultTab: 'result' as const,
    tabs: { result: true, team: true },
    resultsTab: {
      showCategories: true,
      includeGeneral: true,
      scoreDisplay: 'total',
      cardFields: {
        category: true,
        gender: true,
        team: true,
        chestNo: true,
        position: true,
        grade: true,
        totalPoints: true,
      },
    },
    teamsTab: {
      cardFields: { rank: true, total: true, medals: true, progress: true },
      breakdowns: { overall: true, category: true, gender: true, awards: true },
      showTimeline: true,
    },
  },
});

const mergePublicView = (raw: any = {}): PublicViewConfig => {
  const v = raw || {};
  const l = v.landing || {};
  const r = v.resultsPage || {};
  const rt = r.resultsTab || {};
  const tt = r.teamsTab || {};
  return {
    landing: {
      sections: { ...DEFAULT_PUBLIC_VIEW.landing.sections, ...(l.sections || {}) },
      customLinks: Array.isArray(l.customLinks)
        ? l.customLinks
            .filter((item: any) => String(item?.label || '').trim() && String(item?.url || '').trim())
            .map((item: any) => ({
              label: String(item.label || '').trim(),
              url: String(item.url || '').trim(),
            }))
        : [],
    },
    resultsPage: {
      defaultTab: r.defaultTab === 'team' ? 'team' : 'result',
      tabs: { ...DEFAULT_PUBLIC_VIEW.resultsPage.tabs, ...(r.tabs || {}) },
      resultsTab: {
        ...DEFAULT_PUBLIC_VIEW.resultsPage.resultsTab,
        ...rt,
        cardFields: { ...DEFAULT_PUBLIC_VIEW.resultsPage.resultsTab.cardFields, ...(rt.cardFields || {}) },
      },
      teamsTab: {
        ...DEFAULT_PUBLIC_VIEW.resultsPage.teamsTab,
        ...tt,
        cardFields: { ...DEFAULT_PUBLIC_VIEW.resultsPage.teamsTab.cardFields, ...(tt.cardFields || {}) },
        breakdowns: { ...DEFAULT_PUBLIC_VIEW.resultsPage.teamsTab.breakdowns, ...(tt.breakdowns || {}) },
      },
    },
  };
};

export const DEFAULT_FEST_SETUP: Readonly<FestSetup> = Object.freeze<FestSetup>({
  setupVersion: 3,
  preset: 'institutional_arts_fest',
  organisationMode: 'team',
  participantTypes: ['student'],
  allowedGenders: ['Boys', 'Girls'],
  registrationChannels: ['admin', 'teamLeader', 'self'],
  scheduleMode: 'full',
  judgingMode: 'enabled',
  resultWorkflow: 'hybrid',
  teamScoringMode: 'enabled',
  eligibleClasses: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '+1', '+2'],
  registrationApprovalRequired: true,
  competitionPolicies: {
    groupPositionPoints: { first: 10, second: 7, third: 5 },
    directRankGradeMode: 'disabled',
    minimumPositionPolicy: 'none',
    minimumPositionPercentage: null,
    jointPositionMethod: 'competition',
    multipleJudgeMethod: 'average',
    trimMinimumJudges: 5,
    generalGenderMode: 'both',
    publishedCorrectionMode: 'revision_reversal',
  },
  studentFields: [
    { key: 'name', label: 'Student Name', type: 'text', enabled: true, required: true, system: true },
    {
      key: 'class',
      label: 'Class',
      type: 'select',
      options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '+1', '+2'],
      enabled: true,
      required: true,
      system: true,
    },
    { key: 'guardianName', label: 'Guardian Name', type: 'text', enabled: true, required: false, system: false },
    { key: 'phone', label: 'Phone Number', type: 'tel', enabled: true, required: false, system: false },
  ],
  publicModules: {
    home: true,
    results: true,
    about: true,
    leaders: true,
    gallery: true,
    schedule: true,
    registration: true,
    login: true,
    teamStandings: true,
    tv: true,
  },
  publicView: DEFAULT_PUBLIC_VIEW,
});

const allowed = <T extends string>(value: any, choices: readonly T[], fallback: T): T =>
  choices.includes(value) ? value : fallback;

const list = (value: any, choices: string[], fallback: string[]) => {
  const clean = Array.isArray(value) ? [...new Set(value.filter((item) => choices.includes(item)))] : [];
  return clean.length ? clean : [...fallback];
};

const optionalChoice = (value: any, choices: string[], fallback = '') =>
  choices.includes(value) ? value : fallback;

const optionalNumber = (value: any, fallback: number | null = null) =>
  value === '' || value === null || value === undefined || !Number.isFinite(Number(value))
    ? fallback
    : Number(value);

export function normalizeCompetitionPolicies(value: Record<string, any> = {}) {
  const d = DEFAULT_FEST_SETUP.competitionPolicies;
  return {
    groupPositionPoints: {
      first: optionalNumber(value?.groupPositionPoints?.first, d.groupPositionPoints.first),
      second: optionalNumber(value?.groupPositionPoints?.second, d.groupPositionPoints.second),
      third: optionalNumber(value?.groupPositionPoints?.third, d.groupPositionPoints.third),
    },
    directRankGradeMode: optionalChoice(
      value.directRankGradeMode,
      ['disabled', 'manual', 'converted_score', 'per_event'],
      d.directRankGradeMode
    ),
    minimumPositionPolicy: optionalChoice(
      value.minimumPositionPolicy,
      ['none', 'percentage', 'per_event'],
      d.minimumPositionPolicy
    ),
    minimumPositionPercentage: optionalNumber(value.minimumPositionPercentage, d.minimumPositionPercentage),
    jointPositionMethod: optionalChoice(
      value.jointPositionMethod,
      ['competition', 'dense', 'shared_points', 'admin_manual', 'per_event'],
      d.jointPositionMethod
    ),
    multipleJudgeMethod: optionalChoice(
      value.multipleJudgeMethod,
      ['average', 'trim_extremes', 'weighted', 'admin_manual', 'per_event'],
      d.multipleJudgeMethod
    ),
    trimMinimumJudges: optionalNumber(value.trimMinimumJudges, d.trimMinimumJudges),
    generalGenderMode: optionalChoice(
      value.generalGenderMode,
      ['both', 'mixed', 'separate', 'admin_decision', 'per_event'],
      d.generalGenderMode
    ),
    publishedCorrectionMode: optionalChoice(
      value.publishedCorrectionMode,
      ['revision_reversal', 'locked', 'admin_overwrite'],
      d.publishedCorrectionMode
    ),
  };
}

export function normalizeStudentFields(value: any): StudentFieldDef[] {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_FEST_SETUP.studentFields;
  const clean: StudentFieldDef[] = source
    .map((field: any, index: number) => {
      const key = String(field?.key || field?.label || `field_${index + 1}`)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const type: StudentFieldDef['type'] =
        key === 'class'
          ? 'select'
          : allowed(field?.type, ['text', 'tel', 'email', 'number', 'date', 'select'] as const, 'text');
      const options: string[] =
        type === 'select' && Array.isArray(field?.options)
          ? [...new Set<string>(field.options.map((item: any) => String(item).trim()).filter(Boolean))].slice(0, 100)
          : [];
      return {
        key,
        label: String(field?.label || key).trim().slice(0, 60),
        type,
        options,
        enabled: field?.enabled !== false,
        required: !!field?.required,
        system: ['name', 'class', 'guardianName', 'phone'].includes(key) || !!field?.system,
      } satisfies StudentFieldDef;
    })
    .filter((field: StudentFieldDef) => Boolean(field.key && field.label));

  const unique = [...new Map(clean.map((field) => [field.key, field])).values()];
  const name = unique.find((field) => field.key === 'name') || {
    key: 'name',
    label: 'Student Name',
    type: 'text' as const,
    enabled: true,
    required: true,
    system: true,
  };
  name.enabled = true;
  name.required = true;
  name.system = true;
  return [name, ...unique.filter((field) => field.key !== 'name')];
}

export function normalizeFestSetup(raw: Partial<FestSetup> = {}): FestSetup {
  const base = DEFAULT_FEST_SETUP;
  const setup: FestSetup = {
    ...base,
    ...raw,
    organisationMode: allowed(raw.organisationMode, ['team', 'open', 'hybrid'] as const, base.organisationMode),
    participantTypes: ['student'],
    allowedGenders: list(raw.allowedGenders, ['Boys', 'Girls'], base.allowedGenders),
    registrationChannels: list(raw.registrationChannels, ['admin', 'teamLeader', 'self'], base.registrationChannels),
    scheduleMode: allowed(raw.scheduleMode, ['disabled', 'basic', 'full'] as const, base.scheduleMode),
    judgingMode: allowed(raw.judgingMode, ['disabled', 'enabled', 'optional'] as const, base.judgingMode),
    resultWorkflow: allowed(raw.resultWorkflow, ['direct', 'judged', 'hybrid'] as const, base.resultWorkflow),
    teamScoringMode: allowed(raw.teamScoringMode, ['disabled', 'enabled', 'per_event'] as const, base.teamScoringMode),
    eligibleClasses: Array.isArray(raw.eligibleClasses)
      ? [...new Set(raw.eligibleClasses.map((v) => String(v).trim()).filter(Boolean))]
      : [...base.eligibleClasses],
    publicModules: { ...base.publicModules, ...(raw.publicModules || {}) },
    publicView: mergePublicView(raw.publicView),
    studentFields: normalizeStudentFields(raw.studentFields),
    competitionPolicies: normalizeCompetitionPolicies(raw.competitionPolicies),
  };

  const classField = setup.studentFields.find((field) => field.key === 'class');
  if (classField) {
    if ((!classField.options || !classField.options.length) && setup.eligibleClasses.length) {
      classField.options = [...setup.eligibleClasses];
    }
    setup.eligibleClasses = [...(classField.options || [])];
  }
  if (setup.judgingMode === 'disabled' && setup.resultWorkflow === 'judged') setup.resultWorkflow = 'direct';
  if (setup.scheduleMode === 'disabled') setup.publicModules.schedule = false;
  if (setup.organisationMode === 'open') {
    setup.registrationChannels = setup.registrationChannels.filter((c) => c !== 'teamLeader');
  }
  return setup;
}

export const scheduleEnabled = (setup?: Partial<FestSetup>) => normalizeFestSetup(setup).scheduleMode !== 'disabled';
export const judgingEnabled = (setup?: Partial<FestSetup>) => normalizeFestSetup(setup).judgingMode !== 'disabled';
export const directPublishingEnabled = (setup?: Partial<FestSetup>) =>
  ['direct', 'hybrid'].includes(normalizeFestSetup(setup).resultWorkflow);
export const teamModeEnabled = (setup?: Partial<FestSetup>) => normalizeFestSetup(setup).organisationMode !== 'open';
export const selfRegistrationEnabled = (setup?: Partial<FestSetup>) =>
  normalizeFestSetup(setup).registrationChannels.includes('self');

export function eventContributesToTeamScore(
  event: Partial<FestEvent> = {},
  setup: Partial<FestSetup> = DEFAULT_FEST_SETUP
) {
  const mode = normalizeFestSetup(setup).teamScoringMode;
  const policy = event.scoreContribution || 'default';
  if (policy === 'display_only' || policy === 'individual') return false;
  if (policy === 'team') return true;
  return mode === 'enabled';
}

export function readableTextColor(color = '#1D4ED8') {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : '1D4ED8';
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? '#0F172A' : '#FFFFFF';
}

export const teamColor = (name: string, colors: Record<string, string> = {}) =>
  /^#[0-9a-f]{6}$/i.test(colors?.[name] || '') ? colors[name] : '#1D4ED8';

export const slugKey = (name: string) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || '';
