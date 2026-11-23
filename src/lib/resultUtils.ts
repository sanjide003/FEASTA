import type { FestEvent, Registration, ResultDoc, Student } from '../types/festival';

export const resolveDisplayName = (
  map: Record<string, string> | undefined,
  key: unknown,
  fallback = ''
): string => {
  const k = String(key ?? '').trim();
  if (!k) return fallback;
  return String(map?.[k] || k);
};

export const normalizeStageValue = (value: unknown): string =>
  String(value || '')
    .trim()
    .replace(/^stage\s*/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const timeToMinutes = (value = ''): number => {
  const match = String(value || '')
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return 99999;
  let h = Number(match[1]);
  const m = Number(match[2] || 0);
  const ap = (match[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

export const formatTime12h = (value = ''): string => {
  const mins = timeToMinutes(value);
  if (mins >= 99999) return value || 'TBD';
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
};

export const eventTimestamp = (ev: Partial<FestEvent>): number => {
  const date = ev.scheduleDate || ev.date || '';
  const mins = timeToMinutes(ev.time || ev.startTime || '');
  if (!date || mins >= 99999) return Number.MAX_SAFE_INTEGER;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, Math.floor(mins / 60), mins % 60).getTime();
};

export function normalizeResultData(
  raw: Record<string, any> = {},
  {
    events = [],
    students = [],
    registrations = [],
  }: { events?: FestEvent[]; students?: Student[]; registrations?: Registration[] } = {}
): ResultDoc {
  const eventId = raw.eventId || raw.id || '';
  const event = events.find((e) => e.id === eventId);
  const eventName = raw.eventName || event?.name || '';
  const embedded = raw.winnerDetails && typeof raw.winnerDetails === 'object' ? raw.winnerDetails : {};

  const resolveWinner = (winner: any) => {
    if (!winner) return null;
    if (typeof winner === 'object') {
      const id = winner.id || winner.participantId || '';
      const cached = id ? embedded[id] : null;
      return {
        id,
        name: winner.name || cached?.name || 'Unknown',
        team: winner.team || cached?.team || '-',
        chestNo: winner.chestNo || cached?.chestNo || '',
        photoUrl: winner.photoUrl || cached?.photoUrl || '',
      };
    }
    const id = String(winner);
    if (embedded[id]) {
      return {
        id,
        name: embedded[id].name || 'Unknown',
        team: embedded[id].team || '-',
        chestNo: embedded[id].chestNo || '',
        photoUrl: embedded[id].photoUrl || '',
      };
    }
    const student = students.find((s) => s.id === id || String(s.chestNo) === id || s.name === id);
    if (student) {
      return {
        id: student.id || id,
        name: student.name,
        team: student.team || '-',
        chestNo: student.chestNo || '',
        photoUrl: student.showPhotoInResults === false ? '' : student.photoData || '',
      };
    }
    const reg = registrations.find((r) => r.id === id || `${r.team}-${r.slotIndex}` === id);
    if (reg) {
      const memberNames = (reg.studentIds || [])
        .map((sid) => students.find((s) => s.id === sid)?.name)
        .filter(Boolean);
      return {
        id,
        name: memberNames.length
          ? `${reg.team} (${memberNames.slice(0, 3).join(', ')}${memberNames.length > 3 ? '…' : ''})`
          : `${reg.team || 'Team'} Entry #${reg.slotIndex || 1}`,
        team: reg.team || '-',
        chestNo: reg.slotIndex ? `Entry ${reg.slotIndex}` : '',
        photoUrl: '',
      };
    }
    return { id, name: id, team: '-', chestNo: id, photoUrl: '' };
  };

  const legacyPlaces = raw.winners
    ? ['first', 'second', 'third'].flatMap((place, idx) => {
        const winners = Array.isArray(raw.winners[place]) ? raw.winners[place] : [raw.winners[place]].filter(Boolean);
        const resolved = winners.map(resolveWinner).filter(Boolean);
        return resolved.length
          ? [
              {
                key: place,
                rank: idx + 1,
                label: ['First', 'Second', 'Third'][idx],
                value: 0,
                earnedValue: 0,
                winners: resolved,
              },
            ]
          : [];
      })
    : [];

  const normalizeAward = (award: Record<string, any> = {}, index = 0) => ({
    ...award,
    key: award.key || `place${index + 1}`,
    rank: Number(award.rank || index + 1),
    label: award.label || `Place ${index + 1}`,
    value: Number(award.value || 0),
    earnedValue: Number(award.earnedValue ?? award.value ?? 0),
    winners: (Array.isArray(award.winners) ? award.winners : [award.winners]).map(resolveWinner).filter(Boolean),
  });

  const places =
    Array.isArray(raw.places) && raw.places.length
      ? raw.places.map(normalizeAward).filter((p: any) => p.winners.length)
      : legacyPlaces;

  const gradeAwards = Array.isArray(raw.gradeAwards)
    ? raw.gradeAwards
        .map((grade: Record<string, any> = {}) => ({
          ...grade,
          label: String(grade.label || ''),
          value: Number(grade.value || 0),
          winners: (Array.isArray(grade.winners) ? grade.winners : [grade.winners]).map(resolveWinner).filter(Boolean),
        }))
        .filter((g: any) => g.winners.length)
    : [];

  return {
    ...(raw as any),
    id: raw.id || eventId,
    eventId,
    eventName,
    category: raw.category || event?.category || 'General',
    stage: raw.stage || event?.stage || 'On-Stage',
    gender: raw.gender || event?.gender || 'Both',
    type: raw.type || event?.type || 'Single',
    places,
    gradeAwards,
    status: raw.status || 'published',
    publishedAt: raw.publishedAt || raw.createdAt || null,
    updatedAt: raw.updatedAt || raw.publishedAt || raw.createdAt || null,
    updatedBy: raw.updatedBy || 'admin-ui',
  };
}

export function printPage(mode = '') {
  if (typeof window === 'undefined') return;
  const className = mode ? `print-mode-${mode}` : '';
  const cleanup = () => {
    if (className) document.body.classList.remove(className);
    window.removeEventListener('afterprint', cleanup);
  };
  if (className) document.body.classList.add(className);
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1200);
}
