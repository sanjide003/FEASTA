import type { FestEvent, FestSetup, RegistrationMode, Student } from '../types/festival';

export const REGISTRATION_MODES = Object.freeze(['open', 'unfilled_only', 'waitlist_only', 'closed'] as const);
export const APPLICATION_STATUSES = Object.freeze([
  'applied',
  'under_review',
  'waitlisted',
  'selected',
  'finalized',
  'not_selected',
  'removed',
] as const);

const fieldMode = (value: unknown, fallback = 'optional') =>
  ['off', 'optional', 'required'].includes(String(value)) ? String(value) : fallback;

const limitValue = (raw: any) => ({
  enabled: raw?.enabled !== false,
  mode: raw?.mode === 'custom' ? 'custom' : 'unlimited',
  limit: Math.max(0, Math.min(100, Number(raw?.limit || 0))),
});

const stringListOrNull = (value: unknown) => {
  const items = Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
  return items.length ? items : null;
};

const effectiveRegistrationChannels = (event: Partial<FestEvent>, setup: Partial<FestSetup> = {}) => {
  const eventChannels = Array.isArray(event?.allowedRegistrationChannels)
    ? event.allowedRegistrationChannels.filter(Boolean)
    : null;
  return eventChannels?.length ? eventChannels : setup.registrationChannels || ['self'];
};

export const normalizeRegistrationConfig = (raw: Record<string, any> = {}) => ({
  registrationPortalEnabled: raw.registrationPortalEnabled ?? raw.studentApplicationsEnabled ?? true,
  studentApplicationsEnabled: raw.registrationPortalEnabled ?? raw.studentApplicationsEnabled ?? true,
  globalStatus: (REGISTRATION_MODES.includes(raw.globalStatus) ? raw.globalStatus : 'open') as RegistrationMode,
  openAt: Number(raw.openAt || 0),
  closeAt: Number(raw.closeAt || 0),
  selectionDeadlineAt: Number(raw.selectionDeadlineAt || 0),
  finalizationLockAt: Number(raw.finalizationLockAt || 0),
  acceptWhenFull: raw.acceptWhenFull !== false,
  unfilledEventsOnly: raw.unfilledEventsOnly === true,
  waitingListEnabled: raw.waitingListEnabled !== false,
  fullEventVisibility: ['waitlist', 'show_locked', 'hidden'].includes(raw.fullEventVisibility)
    ? raw.fullEventVisibility
    : raw.waitingListEnabled === false
    ? 'show_locked'
    : 'waitlist',
  allowTeamLeaderPause: raw.allowTeamLeaderPause !== false,
  allowTeamLeaderFinalize: raw.allowTeamLeaderFinalize !== false,
  profileEditEnabled: raw.profileEditEnabled === true,
  allowApplicationMediaAddMissing: raw.allowApplicationMediaAddMissing === true,
  allowApplicationMediaReplace: raw.allowApplicationMediaReplace === true,
  applicationNoteMaxLength: Math.max(25, Math.min(500, Number(raw.applicationNoteMaxLength || 250))),
  applicationLinksEnabled: raw.applicationLinksEnabled !== false,
  applicationFields: {
    description: fieldMode(raw.applicationFields?.description, raw.applicationNoteEnabled === false ? 'off' : 'optional'),
    youtube: fieldMode(raw.applicationFields?.youtube, raw.applicationLinksEnabled === false ? 'off' : 'optional'),
    reference: fieldMode(raw.applicationFields?.reference, raw.applicationLinksEnabled === false ? 'off' : 'optional'),
    images: fieldMode(raw.applicationFields?.images),
  },
  showEventRules: raw.showEventRules !== false,
  showJudgingCriteria: raw.showJudgingCriteria !== false,
  generalEventEligibleCategories: stringListOrNull(raw.generalEventEligibleCategories),
  applicationImageMaxCount: 1,
  applicationImageMaxSizeKb: 300,
  participationLimits: {
    offStage: limitValue(raw.participationLimits?.offStage),
    onStage: limitValue(raw.participationLimits?.onStage),
    single: limitValue(raw.participationLimits?.single),
    group: limitValue(raw.participationLimits?.group),
    general: limitValue(raw.participationLimits?.general),
    total: limitValue(raw.participationLimits?.total),
    excludeGeneralFromTotal: raw.participationLimits?.excludeGeneralFromTotal === true,
    generalCounting: {
      stage: raw.participationLimits?.generalCounting?.stage !== false,
      type: raw.participationLimits?.generalCounting?.type !== false,
      independent: raw.participationLimits?.generalCounting?.independent !== false,
    },
    noticeHeading: String(raw.participationLimits?.noticeHeading || '').trim(),
    noticeContent: String(raw.participationLimits?.noticeContent || '').trim(),
  },
  verificationSessionMinutes: Math.max(5, Math.min(120, Number(raw.verificationSessionMinutes || 30))),
  maxVerificationAttempts: Math.max(3, Math.min(10, Number(raw.maxVerificationAttempts || 5))),
});

export const normalizeTeamRegistrationPolicy = (raw: Record<string, any> = {}) => ({
  studentApplicationsEnabled: raw.studentApplicationsEnabled !== false,
  mode: (REGISTRATION_MODES.includes(raw.mode) ? raw.mode : 'open') as RegistrationMode,
  ...raw,
});

export function registrationWindowOpen(config: Record<string, any>, now = Date.now()) {
  const value = normalizeRegistrationConfig(config);
  return (
    value.studentApplicationsEnabled &&
    value.globalStatus !== 'closed' &&
    (!value.openAt || now >= value.openAt) &&
    (!value.closeAt || now < value.closeAt)
  );
}

export const selfRegistrationAllowed = (setup?: Partial<FestSetup>) =>
  !Array.isArray(setup?.registrationChannels) || setup.registrationChannels.includes('self');

export const eventLimitBuckets = (event: Partial<FestEvent>, config: Record<string, any> = {}) => {
  const limits = normalizeRegistrationConfig(config).participationLimits;
  const general = event?.category === 'General';
  const counting = limits.generalCounting || {};
  return [
    !general || counting.stage ? (event?.stage === 'On-Stage' ? 'onStage' : 'offStage') : '',
    !general || counting.type ? (event?.type === 'Group' ? 'group' : 'single') : '',
    general && counting.independent ? 'general' : '',
    general ? '' : 'total',
  ].filter(Boolean) as Array<'offStage' | 'onStage' | 'single' | 'group' | 'general' | 'total'>;
};

export function participationUsage(eventIds: string[] = [], events: Array<Partial<FestEvent>> = [], config: Record<string, any> = {}) {
  const value = normalizeRegistrationConfig(config);
  const unique = new Set(eventIds.filter(Boolean));
  const usage = { offStage: 0, onStage: 0, single: 0, group: 0, general: 0, total: 0 };
  const exclude = value.participationLimits.excludeGeneralFromTotal;
  for (const id of unique) {
    const event = events.find((item) => item.id === id);
    if (!event) continue;
    for (const bucket of eventLimitBuckets(event, value)) usage[bucket]++;
    if (event.category === 'General' && !exclude) usage.total++;
  }
  return usage;
}

export function participationLimitDecision(
  config: Record<string, any>,
  event: Partial<FestEvent>,
  usage: Record<string, number> = {}
) {
  const value = normalizeRegistrationConfig(config);
  const limits = value.participationLimits;
  const buckets = eventLimitBuckets(event, value);
  const checks = [...buckets];
  if (event.category === 'General' && !limits.excludeGeneralFromTotal) checks.push('total');
  const active = checks.filter((key) => (limits as any)[key].enabled !== false);
  const exceeded = active
    .filter((key) => (limits as any)[key].mode === 'custom' && Number(usage[key] || 0) + 1 > (limits as any)[key].limit)
    .map((key) => ({ key, limit: (limits as any)[key].limit, count: Number(usage[key] || 0) }));
  return { allowed: !exceeded.length, exceeded, buckets: active };
}

export const eventCapacity = (event: Partial<FestEvent>) =>
  Math.max(1, Number(event?.limit || 1)) *
  (event?.type === 'Group' ? Math.max(1, Number(event?.maximumMembers || event?.groupSize || 1)) : 1);

export function capacityState(event: Partial<FestEvent>, selectedCount = 0) {
  const capacity = eventCapacity(event);
  const count = Math.max(0, Number(selectedCount || 0));
  return {
    capacity,
    count,
    remaining: Math.max(0, capacity - count),
    state: count > capacity ? 'overloaded' : count === capacity ? 'full' : 'available',
    excess: Math.max(0, count - capacity),
  };
}

export function eventCategoryEligible(participant: Partial<Student>, event: Partial<FestEvent>, config: Record<string, any> = {}) {
  if (!event?.category || event.category === 'All') return true;
  if (event.category === 'General') {
    const allowed = normalizeRegistrationConfig(config).generalEventEligibleCategories;
    return allowed === null || allowed.includes(participant?.category || 'General');
  }
  return event.category === participant?.category;
}

export function participantEligibleForEvent(
  participant: any,
  event: Partial<FestEvent>,
  setup: Partial<FestSetup> = {},
  config: Record<string, any> = {}
) {
  if (!participant?.id || !event?.id || event.status === 'draft') return false;
  const participantType = participant.participantType || 'student';
  if (participantType === 'student' && !participant.team) return false;
  const types = event.allowedParticipantTypes || setup.participantTypes || ['student'];
  if (types.length && !types.includes(participantType)) return false;
  const genders = [event.gender, (event as any).genderScope].filter(Boolean);
  if (genders.length && !genders.includes('Both') && !genders.includes(participant.gender || 'Boys')) return false;
  if (!eventCategoryEligible(participant, event, config)) return false;
  if (participantType === 'student' && Array.isArray(event.eligibleClasses) && event.eligibleClasses.length) {
    const studentClass = participant.details?.class || participant.class || '';
    if (!event.eligibleClasses.map(String).includes(String(studentClass))) return false;
  }
  return effectiveRegistrationChannels(event, setup).includes('self');
}

export const studentEligibleForEvent = (
  student: Partial<Student>,
  event: Partial<FestEvent>,
  setup?: Partial<FestSetup>,
  config: Record<string, any> = {}
) => participantEligibleForEvent({ ...student, participantType: 'student' }, event, setup, config);

export const registrationPhase = (config: Record<string, any>, now = Date.now()) => {
  const value = normalizeRegistrationConfig(config);
  if (!registrationWindowOpen(value, now)) return 'applications_closed';
  if (value.selectionDeadlineAt && now >= value.selectionDeadlineAt) return 'selection_closed';
  if (value.finalizationLockAt && now >= value.finalizationLockAt) return 'finalization_locked';
  return 'open';
};

export function applicationDecision(
  config: Record<string, any>,
  teamPolicy: Record<string, any>,
  capacity: { state: string }
) {
  const global = normalizeRegistrationConfig(config);
  const team = normalizeTeamRegistrationPolicy(teamPolicy);
  if (!registrationWindowOpen(global) || !team.studentApplicationsEnabled || team.mode === 'closed') {
    return { allowed: false, status: 'closed' };
  }
  const full = capacity.state !== 'available';
  if (full && global.fullEventVisibility !== 'waitlist') return { allowed: false, status: 'full' };
  if (full && (global.unfilledEventsOnly || team.mode === 'unfilled_only' || !global.acceptWhenFull)) {
    return { allowed: false, status: 'full' };
  }
  if (full && (global.waitingListEnabled || team.mode === 'waitlist_only')) {
    return { allowed: true, status: 'waitlisted' };
  }
  return { allowed: true, status: 'applied' };
}
