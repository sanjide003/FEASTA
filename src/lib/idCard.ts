import type { Student } from '../types/festival';

export function formatChestNumber(chestNo: unknown): string {
  const clean = String(chestNo ?? '').trim().replace(/^#+/, '');
  return clean || '—';
}

function fnv1a32(input: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function computeVerificationToken(student: Partial<Student> = {}): string {
  const id = String(student.id || '').trim();
  const chest = formatChestNumber(student.chestNo);
  const chestNorm = chest === '—' ? '' : chest.toUpperCase();
  const team = String(student.team || '').trim();
  const name = String(student.name || '').trim().toUpperCase();
  const canonical = `FESTPORT_ID_V1|${id}|${chestNorm}|${team}|${name}`;
  const partA = fnv1a32(canonical, 0x811c9dc5).toString(36).toUpperCase().padStart(7, '0').slice(-4);
  const partB = fnv1a32(`${canonical}#SIG2`, 0x9e3779b1).toString(36).toUpperCase().padStart(7, '0').slice(-4);
  return `${partA}${partB}`;
}

export function buildVerificationUrl(student: Partial<Student> = {}, origin = ''): string {
  const rawOrigin = origin || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
  const base = String(rawOrigin || '').replace(/\/+$/, '');
  const chest = formatChestNumber(student.chestNo);
  const token = computeVerificationToken(student);
  const params = new URLSearchParams();
  if (chest !== '—') {
    params.set('c', chest);
  } else if (student.id) {
    params.set('ref', String(student.id));
  }
  params.set('k', token);
  const path = `/verify.html?${params.toString()}`;
  return base && /^https?:\/\//i.test(base) ? `${base}${path}` : path;
}

export function safeAccentOnLight(color = '#1D4ED8'): string {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : '1D4ED8';
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 145 ? `#${hex}` : '#0F172A';
}

export function accentTintSurface(color = '#1D4ED8') {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : '1D4ED8';
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.08)`,
    border: `rgba(${r}, ${g}, ${b}, 0.24)`,
  };
}
