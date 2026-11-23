import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getFirebaseState } from '../../../lib/firebase';
import { invalidateCache } from '../../../lib/dataCache';
import { buildTeamScoreLedger } from '../../../lib/scoreUtils';
import type {
  AccessUser,
  BrandingConfig,
  FestEvent,
  GeneralConfig,
  JudgeAssignment,
  JudgeScore,
  Notice,
  Registration,
  RegistrationRequest,
  ResultDoc,
  ScheduleBreak,
  Student,
  TvConfig,
} from '../../../types/festival';

export type AdminScope =
  | 'overview'
  | 'setup'
  | 'students'
  | 'events'
  | 'registrations'
  | 'schedule'
  | 'results'
  | 'staff'
  | 'tv'
  | 'notices'
  | 'reset';

export interface AdminState {
  profile: AccessUser;
  branding: BrandingConfig;
  general: GeneralConfig;
  registrationConfig: Record<string, any>;
  scheduleConfig: Record<string, any>;
  scoringRules: Record<string, any>;
  tvConfig: TvConfig;
  tvControl: TvConfig;
  students: Student[];
  events: FestEvent[];
  registrations: Registration[];
  requests: RegistrationRequest[];
  results: ResultDoc[];
  scheduleBreaks: ScheduleBreak[];
  staffUsers: AccessUser[];
  judgeAssignments: JudgeAssignment[];
  judgeScores: JudgeScore[];
  notices: Notice[];
}

export interface AdminActions {
  refreshScopes: (scopes?: string[], force?: boolean) => Promise<void>;
  syncSummary: (overrideStudentsCount?: number, overrideResults?: ResultDoc[]) => Promise<void>;
  navigateTab: (tab: AdminScope) => void;
}

export async function syncPublicSummary(
  teams: string[] = [],
  events: FestEvent[] = [],
  overrideStudentCount?: number,
  overrideResults?: ResultDoc[]
) {
  const { db } = getFirebaseState();
  if (!db) return;
  try {
    let studentCount = overrideStudentCount;
    if (typeof studentCount !== 'number') {
      const stuSnap = await getDocs(collection(db, 'students'));
      studentCount = stuSnap.size;
    }

    let pubResults = overrideResults;
    if (!pubResults) {
      const resSnap = await getDocs(query(collection(db, 'results'), where('status', '==', 'published')));
      pubResults = resSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ResultDoc));
    } else {
      pubResults = pubResults.filter((r) => !r.status || r.status === 'published');
    }

    const teamTotals: Record<string, number> = {};
    teams.forEach((t) => {
      teamTotals[t] = 0;
    });
    const ledger = buildTeamScoreLedger(
      pubResults,
      (winnerId, _type, res) => res?.winnerDetails?.[winnerId]?.team || '',
      events
    );
    ledger.forEach((item) => {
      teamTotals[item.team] = (teamTotals[item.team] || 0) + Number(item.points || 0);
    });

    await setDoc(
      doc(db, 'settings', 'public_summary'),
      {
        studentCount,
        publishedCount: pubResults.length,
        teamScores: teamTotals,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    invalidateCache('doc:settings/public_summary');
  } catch (err) {
    console.warn('syncPublicSummary warning:', err);
  }
}
