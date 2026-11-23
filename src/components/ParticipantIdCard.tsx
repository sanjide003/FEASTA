import React, { useMemo, useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import type { BrandingConfig, Student } from '../types/festival';
import { currentYear, isValidImageSrc } from '../lib/branding';
import { readableTextColor, teamColor } from '../lib/festConfig';
import { accentTintSurface, buildVerificationUrl, formatChestNumber, safeAccentOnLight } from '../lib/idCard';
import { buildQrPathData } from '../lib/qrSvg';

export interface ConfirmedEventItem {
  id: string;
  name: string;
  stage?: string;
  type?: string;
  date?: string;
  time?: string;
  venue?: string;
}

interface ParticipantIdCardProps {
  student: Partial<Student>;
  confirmedEvents?: ConfirmedEventItem[];
  branding?: Partial<BrandingConfig>;
  teamColors?: Record<string, string>;
  teamDisplayNames?: Record<string, string>;
  categoryDisplayNames?: Record<string, string>;
  festYear?: string;
  verificationUrl?: string;
  hintText?: string;
  initialFlipped?: boolean;
}

export const ParticipantIdCard: React.FC<ParticipantIdCardProps> = ({
  student,
  confirmedEvents = [],
  branding = {},
  teamColors = {},
  teamDisplayNames = {},
  categoryDisplayNames = {},
  festYear = currentYear(),
  verificationUrl,
  hintText = 'Flip the badge to view confirmed competition entries and verification QR.',
  initialFlipped = false,
}) => {
  const [flipped, setFlipped] = useState(initialFlipped);
  const [logoFailed, setLogoFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const color = teamColor(student.team || '', teamColors);
  const headerFg = readableTextColor(color);
  const headerMuted = headerFg === '#FFFFFF' ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.72)';
  const headerSurface = headerFg === '#FFFFFF' ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.08)';
  const headerBorder = headerFg === '#FFFFFF' ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.18)';
  const accentOnWhite = safeAccentOnLight(color);
  const badgeTint = accentTintSurface(accentOnWhite);

  const teamLabel = teamDisplayNames[student.team || ''] || student.team || 'Team';
  const categoryLabel = categoryDisplayNames[student.category || ''] || student.category || 'General';
  const genderLabel = student.gender || 'Boys';
  const classLabel = student.details?.class || student.class || '—';
  const chestLabel = formatChestNumber(student.chestNo);
  const studentInitial = String(student.name || 'S').trim()[0]?.toUpperCase() || 'S';

  const festTitle = String(branding.festName1 || '').trim() || 'Fest Management';
  const festSub =
    branding.festName2 && branding.festName2 !== 'Setup Required' ? String(branding.festName2).trim() : '';
  const festFullTitle = festSub ? `${festTitle} ${festSub}` : festTitle;
  const festInitials =
    festTitle
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'FM';

  const hasLogo = !logoFailed && isValidImageSrc(branding.logoUrl);
  const hasPhoto = !photoFailed && isValidImageSrc(student.photoData);

  const qrTargetUrl = useMemo(() => verificationUrl || buildVerificationUrl(student), [verificationUrl, student]);
  const qr = useMemo(() => buildQrPathData(qrTargetUrl, 2), [qrTargetUrl]);

  return (
    <div>
      <div className="id-card-stage mx-auto">
        <div className={`id-card-inner${flipped ? ' is-flipped' : ''}`}>
          {/* FRONT FACE */}
          <article
            aria-hidden={flipped}
            className="id-card-face id-card-face-front flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div
              className="px-5 pt-3 pb-14"
              style={{
                background: color,
                color: headerFg,
                borderBottom: `1px solid ${headerBorder}`,
              }}
            >
              <div
                className="mx-auto mb-3.5 h-2.5 w-14 rounded-full border border-black/15 bg-[#F8FAFC] shadow-inner"
                aria-hidden="true"
              />
              <div className="flex items-center justify-between gap-3">
                <div
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl font-display text-xs font-bold shadow-sm"
                  style={{ background: headerSurface, border: `1px solid ${headerBorder}` }}
                >
                  <span>{festInitials}</span>
                  {hasLogo && (
                    <img
                      src={branding.logoUrl}
                      alt={festFullTitle}
                      onError={() => setLogoFailed(true)}
                      className="absolute inset-0 h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <span className="font-mono-num text-[11px] font-semibold" style={{ color: headerMuted }}>
                  {festYear}
                </span>
              </div>
            </div>

            <div className="-mt-11 px-5 pb-5 text-center">
              <div
                className="relative mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-slate-100 font-display text-2xl font-bold shadow-sm"
                style={{ color: accentOnWhite }}
              >
                <span>{studentInitial}</span>
                {hasPhoto && (
                  <img
                    src={student.photoData}
                    alt={student.name || 'Student'}
                    onError={() => setPhotoFailed(true)}
                    className="absolute inset-0 h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              <h3 className="mt-3 font-display text-xl font-bold tracking-tight text-slate-900 text-balance">
                {student.name}
              </h3>
              <p className="mt-1 text-xs font-medium text-slate-500">
                <span>{teamLabel}</span>
                <span aria-hidden="true"> · </span>
                <span>{categoryLabel}</span>
              </p>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Chest Number
                </span>
                <span
                  className="mt-0.5 block font-mono-num text-3xl font-extrabold tracking-tight"
                  style={{ color: accentOnWhite }}
                >
                  {chestLabel}
                </span>
              </div>

              <div className="mt-3 flex justify-center">
                <span
                  className="inline-flex w-full items-center justify-center rounded-lg border px-4 py-1.5 font-display text-sm font-extrabold uppercase tracking-[0.22em]"
                  style={{
                    background: badgeTint.bg,
                    borderColor: badgeTint.border,
                    color: accentOnWhite,
                  }}
                >
                  PARTICIPANT
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 border-y border-slate-200 text-left text-xs">
                <div className="border-b border-r border-slate-100 px-3 py-2.5">
                  <span className="block text-[11px] text-slate-400">Team</span>
                  <strong className="mt-0.5 block truncate font-semibold text-slate-900">{teamLabel}</strong>
                </div>
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <span className="block text-[11px] text-slate-400">Category</span>
                  <strong className="mt-0.5 block truncate font-semibold text-slate-900">{categoryLabel}</strong>
                </div>
                <div className="border-r border-slate-100 px-3 py-2.5">
                  <span className="block text-[11px] text-slate-400">Gender</span>
                  <strong className="mt-0.5 block font-semibold text-slate-900">{genderLabel}</strong>
                </div>
                <div className="px-3 py-2.5">
                  <span className="block text-[11px] text-slate-400">Class</span>
                  <strong className="mt-0.5 block font-semibold text-slate-900">{classLabel}</strong>
                </div>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate font-display text-xs font-bold text-slate-900">{festFullTitle}</p>
                <p className="mt-0.5 truncate font-mono-num text-[11px] font-medium text-slate-500">
                  {festYear} · {confirmedEvents.length} Confirmed Event{confirmedEvents.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFlipped(true)}
                aria-pressed={flipped}
                className="no-print inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>Events &amp; QR</span>
              </button>
            </div>
          </article>

          {/* BACK FACE */}
          <article
            aria-hidden={!flipped}
            className="id-card-face id-card-face-back flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div
              className="px-5 pt-3 pb-3.5"
              style={{
                background: color,
                color: headerFg,
                borderBottom: `1px solid ${headerBorder}`,
              }}
            >
              <div
                className="mx-auto mb-3 h-2.5 w-14 rounded-full border border-black/15 bg-[#F8FAFC] shadow-inner"
                aria-hidden="true"
              />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-left">
                  <p className="truncate font-display text-sm font-bold leading-tight">{student.name}</p>
                  <p className="truncate text-[11px] font-medium" style={{ color: headerMuted }}>
                    {teamLabel} · {categoryLabel}
                  </p>
                </div>
                <span className="shrink-0 font-mono-num text-sm font-extrabold">{chestLabel}</span>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-5 pt-3.5 pb-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Confirmed Events</span>
                <span className="font-mono-num text-xs font-bold text-slate-500">{confirmedEvents.length}</span>
              </div>
              <div className="mt-1 max-h-[205px] flex-1 divide-y divide-slate-100 overflow-y-auto pr-1">
                {confirmedEvents.length ? (
                  confirmedEvents.map((ev, idx) => (
                    <div key={ev.id} className="flex items-start gap-2.5 py-2.5 text-left">
                      <span className="pt-0.5 font-mono-num text-[11px] font-bold text-slate-400">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">{ev.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {ev.stage || 'On-Stage'} · {ev.type || 'Single'}
                          {ev.date || ev.time ? ` · ${ev.date || ''} ${ev.time || ''}`.trim() : ''}
                          {ev.venue ? ` · ${ev.venue}` : ''}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No confirmed events yet. Approved competition entries will appear here.
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox={`0 0 ${qr.total} ${qr.total}`}
                    width={88}
                    height={88}
                    role="img"
                    aria-label={`Verification QR code for ${student.name || 'Participant'} Chest ${chestLabel}`}
                    shapeRendering="crispEdges"
                  >
                    <rect width={qr.total} height={qr.total} fill="#FFFFFF" />
                    <path d={qr.path} fill="#0F172A" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Verification Badge</p>
                  <p className="mt-0.5 font-mono-num text-xs font-bold text-slate-900">Chest {chestLabel}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-700">{teamLabel}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Scan QR to verify official badge</p>
                </div>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              <span className="truncate font-display text-[11px] font-semibold text-slate-600">
                {festFullTitle} · <span className="font-mono-num font-normal text-slate-500">{festYear}</span>
              </span>
              <button
                type="button"
                onClick={() => setFlipped(false)}
                aria-pressed={flipped}
                className="no-print inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Front ID</span>
              </button>
            </div>
          </article>
        </div>
      </div>
      {hintText && <p className="no-print mt-3 text-center text-xs text-slate-400">{hintText}</p>}
    </div>
  );
};
