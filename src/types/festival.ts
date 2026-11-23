export type GenderScope = 'Boys' | 'Girls' | 'Both';
export type EventGender = 'Boys' | 'Girls' | 'Both' | 'Mixed';
export type EventStage = 'On-Stage' | 'Off-Stage';
export type EventType = 'Single' | 'Group';
export type RegistrationMode = 'open' | 'unfilled_only' | 'waitlist_only' | 'closed';

export interface BrandingConfig {
  configured?: boolean;
  setupCompleted?: boolean;
  festName1: string;
  festName2: string;
  tagline: string;
  logoUrl: string;
  aboutSubtitle: string;
  aboutText: string;
  footerText: string;
  gallery?: string[];
  social?: {
    wa?: string;
    ig?: string;
    fb?: string;
    yt?: string;
    tg?: string;
  };
}

export interface StudentFieldDef {
  key: string;
  label: string;
  type: 'text' | 'tel' | 'email' | 'number' | 'date' | 'select';
  options?: string[];
  enabled: boolean;
  required: boolean;
  system: boolean;
}

export interface PublicViewConfig {
  landing: {
    sections: {
      hero: boolean;
      about: boolean;
      leaders: boolean;
      gallery: boolean;
      schedule: boolean;
      teamStandings: boolean;
      footer: boolean;
    };
    customLinks: Array<{ label: string; url: string }>;
  };
  resultsPage: {
    defaultTab: 'result' | 'team';
    tabs: { result: boolean; team: boolean };
    resultsTab: {
      showCategories: boolean;
      includeGeneral: boolean;
      scoreDisplay: string;
      cardFields: {
        category: boolean;
        gender: boolean;
        team: boolean;
        chestNo: boolean;
        position: boolean;
        grade: boolean;
        totalPoints: boolean;
      };
    };
    teamsTab: {
      cardFields: { rank: boolean; total: boolean; medals: boolean; progress: boolean };
      breakdowns: { overall: boolean; category: boolean; gender: boolean; awards: boolean };
      showTimeline: boolean;
    };
  };
}

export interface FestSetup {
  setupVersion: number;
  preset: string;
  organisationMode: 'team' | 'open' | 'hybrid';
  participantTypes: string[];
  allowedGenders: string[];
  registrationChannels: string[];
  scheduleMode: 'disabled' | 'basic' | 'full';
  judgingMode: 'disabled' | 'enabled' | 'optional';
  resultWorkflow: 'direct' | 'judged' | 'hybrid';
  teamScoringMode: 'disabled' | 'enabled' | 'per_event';
  eligibleClasses: string[];
  registrationApprovalRequired: boolean;
  competitionPolicies: Record<string, any>;
  studentFields: StudentFieldDef[];
  publicModules: Record<string, boolean>;
  publicView: PublicViewConfig;
  categories?: string[];
}

export interface GeneralConfig {
  teams?: string[];
  teamColors?: Record<string, string>;
  teamDisplayNames?: Record<string, string>;
  categories?: string[];
  categoryDisplayNames?: Record<string, string>;
  stages?: string[];
  festivalDays?: Array<{ id?: string; label?: string; date: string }>;
  festSetup?: Partial<FestSetup>;
  chestConfig?: ChestConfig;
  categoryClassification?: CategoryClassificationConfig;
}

export interface ChestConfig {
  enabled: boolean;
  splitByCategory: boolean;
  splitByGender: boolean;
  series: Record<string, string>;
}

export interface CategoryClassificationConfig {
  mode: 'manual' | 'class' | 'dob';
  showClassInManual: boolean;
  showDobInManual: boolean;
  classes: string[];
  classRules: Record<string, string[]>;
  dobRules: Record<string, { from: string; to: string }>;
}

export interface Student {
  id: string;
  name: string;
  team: string;
  category: string;
  gender: 'Boys' | 'Girls' | string;
  chestNo?: string | number;
  photoData?: string;
  details?: Record<string, string>;
  class?: string;
  dob?: string;
  importedAt?: number;
  updatedAt?: number;
  showPhotoInResults?: boolean;
}

export interface CriterionItem {
  key: string;
  name: string;
  maximumMark: number;
  required?: boolean;
  order?: number;
  tieBreakPriority?: number;
}

export interface FestEvent {
  id: string;
  code?: string;
  name: string;
  section?: string;
  category: string;
  gender: EventGender | string;
  type: EventType | string;
  stage: EventStage | string;
  limit?: number;
  entriesPerTeam?: number;
  groupSize?: number;
  membersPerEntry?: number;
  minimumMembers?: number;
  maximumMembers?: number;
  eligibleClasses?: string[];
  allowedParticipantTypes?: string[];
  allowedRegistrationChannels?: string[];
  resultWorkflow?: string;
  resultMethod?: string;
  maximumMark?: number;
  criteria?: CriterionItem[];
  criteriaUnparsed?: string[];
  objectiveRule?: { correctMark: number; wrongPenalty: number };
  countRule?: { wrongPenalty: number };
  timeRule?: { direction: 'lower' | 'higher' };
  multipleJudgeMethod?: string;
  tieBreakMethod?: string;
  gradeMode?: string;
  scoreContribution?: string;
  scoringPolicy?: string;
  scoringOverride?: Record<string, any>;
  duration?: number;
  preparationTime?: number;
  rules?: string;
  description?: string;
  notes?: string;
  status?: string;
  scheduleDate?: string;
  scheduleDay?: string;
  scheduleDayId?: string;
  scheduleStage?: string;
  scheduleStageId?: string;
  scheduleDuration?: number;
  scheduleEndTime?: string;
  scheduleNotes?: string;
  scheduleOrder?: number;
  scheduleStatus?: string;
  time?: string;
  startTime?: string;
  date?: string;
  cancelled?: boolean;
  cancelReason?: string;
  cancelledAt?: number;
  cancelledByUid?: string;
  updatedAt?: number;
}

export interface Registration {
  id: string;
  eventId: string;
  eventName?: string;
  team: string;
  slotIndex?: number;
  studentIds: string[];
  managedGender?: GenderScope | string;
  createdByUid?: string;
  lastUpdatedByUid?: string;
  createdAt?: number;
  lastUpdatedAt?: number;
}

export interface RegistrationRequest {
  id: string;
  name: string;
  participantType: string;
  gender: 'Boys' | 'Girls' | string;
  phone?: string;
  email?: string;
  team: string;
  category?: string;
  relatedStudentId: string;
  relationship?: string;
  groupMembers?: any[];
  eventIds: string[];
  eventName?: string;
  note?: string;
  youtubeUrl?: string;
  referenceUrl?: string;
  images?: Array<{ name?: string; type?: string; size?: number; data: string }>;
  status: string;
  submittedAt?: number;
  decisionByUid?: string;
  decisionByName?: string;
  decisionByRole?: string;
  decisionByUsername?: string;
  decisionAt?: number;
  reviewedAt?: number;
}

export interface ScheduleBreak {
  id: string;
  title: string;
  category?: string;
  date: string;
  day?: string;
  dayId?: string;
  startTime: string;
  endTime: string;
  stage?: string;
  stageId?: string;
  stageIds?: string[];
  stages?: string[];
  duration?: number;
  afterEventId?: string;
  order?: number;
  active?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface AccessUser {
  id: string;
  uid?: string;
  authUid?: string;
  username: string;
  displayName?: string;
  email: string;
  role: 'admin' | 'superAdmin' | 'teamLeader' | 'judge' | string;
  team?: string;
  genderScope?: GenderScope;
  active?: boolean;
  sourceCollection?: 'accessUsers' | 'adminUsers';
  createdAt?: number;
  updatedAt?: number;
}

export interface JudgeAssignment {
  id: string;
  judgeId: string;
  judgeAuthId?: string;
  judgeAccessDocId?: string;
  judgeName?: string;
  eventId: string;
  eventName?: string;
  category?: string;
  gender?: string;
  date?: string;
  time?: string;
  stage?: string;
  active?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface JudgeScoreMark {
  participantId: string;
  rawMark?: number;
  mark?: number;
  evaluation?: 'awarded' | 'absent' | 'disqualified' | 'no-award' | 'withheld' | string;
  position?: string;
  positionValue?: number;
  grade?: string;
  gradeValue?: number;
  criterionMarks?: Record<string, number>;
  correctCount?: number;
  wrongCount?: number;
  countValue?: number;
  penaltyCount?: number;
  timeSeconds?: number;
  eliminationOrder?: number;
  notes?: string;
}

export interface JudgeScore {
  id: string;
  assignmentId: string;
  judgeId: string;
  judgeName?: string;
  judgeWeight?: number;
  eventId: string;
  eventName?: string;
  status: 'draft' | 'submitted';
  publishStatus?: 'unpublished' | 'published';
  publishedResultId?: string;
  marks: JudgeScoreMark[];
  scoringSnapshot?: Record<string, any>;
  scoreVersion?: number;
  submittedAt?: number;
  updatedAt?: number;
}

export interface WinnerSnapshot {
  id: string;
  name: string;
  team: string;
  chestNo?: string | number;
  photoUrl?: string;
  memberCount?: number;
}

export interface ResultPlace {
  key: string;
  rank: number;
  label: string;
  value: number;
  earnedValue?: number;
  tiePolicy?: 'full' | 'shared';
  winners: any[];
}

export interface ResultGradeAward {
  key?: string;
  order?: number;
  label: string;
  minimumPercentage?: number | null;
  value: number;
  winners: any[];
}

export interface ResultDoc {
  id: string;
  eventId: string;
  eventName?: string;
  category?: string;
  stage?: string;
  gender?: string;
  type?: string;
  places: ResultPlace[];
  gradeAwards?: ResultGradeAward[];
  winners?: Record<string, any>;
  winnerDetails?: Record<string, WinnerSnapshot>;
  scoringSnapshot?: Record<string, any>;
  sourceType?: string;
  status?: 'published' | 'archived' | 'draft';
  publishedAt?: number | null;
  updatedAt?: number | null;
  createdAt?: number | null;
  publishedByUid?: string;
  updatedBy?: string;
  revision?: number;
  revisionReason?: string;
  previousRevision?: Record<string, any> | null;
}

export interface Notice {
  id: string;
  title: string;
  message: string;
  team: string;
  priority?: 'normal' | 'urgent';
  createdAt?: number;
  createdByUid?: string;
}

export interface TvConfig {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  badgeText?: string;
  refreshIntervalSec?: number;
  rotationSec?: number;
  tickerText?: string;
  ticker?: string;
  theme?: 'dark' | 'emerald' | 'gold' | 'indigo' | string;
  sections?: Record<string, any>;
  show?: Record<string, boolean>;
  content?: Record<string, boolean>;
  sectionOrder?: string[];
  resultQueue?: string[];
  selectedResultIds?: string[];
  animationStyle?: 'cinematic' | 'spotlight' | 'ticker-rise' | 'confetti' | 'card-flip' | 'fade-scale' | 'ticker-slide' | string;
  mediaMode?: 'dashboard' | 'youtube' | 'video' | 'image' | 'ticker' | 'announcements' | 'idle' | string;
  mode?: string;
  mediaUrl?: string;
  mediaCaption?: string;
  videoUrl?: string;
  videoUrls?: string[];
  imageUrls?: string[];
  announcements?: string[];
  background?: { color?: string; imageUrl?: string; videoUrl?: string; slideDuration?: number };
  resultOrder?: 'latest' | 'manual' | 'rotation';
  interruptPolicy?: 'finish-cycle' | 'immediate';
  afterQueue?: 'loop' | 'idle' | 'standings';
  liveMode?: boolean;
  draftMode?: boolean;
  updatedAt?: number;
}
