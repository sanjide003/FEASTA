import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, ShieldAlert, ShieldCheck } from 'lucide-react';
import { EditorialFooter, EditorialHeader } from '../../components/layout/EditorialShell';
import { ParticipantIdCard, type ConfirmedEventItem } from '../../components/ParticipantIdCard';
import { brandingName, cacheBranding, clearBrandingCache, normalizeBranding, readCachedBranding } from '../../lib/branding';
import { cachedGetDoc, cachedGetDocs } from '../../lib/dataCache';
import { normalizeFestSetup } from '../../lib/festConfig';
import { getFirebaseState } from '../../lib/firebase';
import { buildVerificationUrl, computeVerificationToken } from '../../lib/idCard';
import { normalizeResultData, resolveDisplayName } from '../../lib/resultUtils';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import type { BrandingConfig, FestEvent, FestSetup, GeneralConfig, ResultDoc, Student } from '../../types/festival';

export const VerifyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [branding, setBranding] = useState<BrandingConfig>(() => readCachedBranding());
  const [general, setGeneral] = useState<GeneralConfig>({});
  const [festSetup, setFestSetup] = useState<FestSetup>(() => normalizeFestSetup());
  const [loading, setLoading] = useState(true);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorBody, setErrorBody] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [confirmedEvents, setConfirmedEvents] = useState<ConfirmedEventItem[]>([]);
  const [awards, setAwards] = useState<Array<{ eventName: string; category: string; items: string[] }>>([]);

  useEffect(() => {
    let active = true;
    async function verify() {
      const { db, isFirebaseConfigured } = getFirebaseState();
      const chestParam = (searchParams.get('c') || '').trim();
      const refParam = (searchParams.get('ref') || '').trim();
      const tokenParam = (searchParams.get('k') || '').trim().toUpperCase();

      if (!isFirebaseConfigured || !db) {
        if (active) {
          setErrorTitle('Verification Unavailable');
          setErrorBody('Firebase configuration is required to verify participant credentials.');
          setLoading(false);
        }
        return;
      }

      try {
        const [homeDoc, genDoc] = await Promise.all([
          cachedGetDoc<BrandingConfig>(db, 'settings', 'home_config', { ttlMs: 300_000 }),
          cachedGetDoc<GeneralConfig>(db, 'settings', 'general', { ttlMs: 300_000 }),
        ]);
        if (!active) return;
        if (homeDoc) setBranding(cacheBranding(homeDoc));
        else {
          clearBrandingCache();
          setBranding(normalizeBranding());
        }
        const gen: GeneralConfig = genDoc || {};
        setGeneral(gen);
        setFestSetup(normalizeFestSetup(gen.festSetup || {}));

        if (!tokenParam || (!chestParam && !refParam)) {
          setErrorTitle('QR Signature Required');
          setErrorBody(
            'This page only validates official participant badges when opened via a valid QR code scan.'
          );
          setLoading(false);
          return;
        }

        let matched: Student | null = null;
        if (chestParam) {
          const variants = [...new Set([chestParam, chestParam.toUpperCase(), `#${chestParam}`])];
          for (const candidate of variants) {
            const snap = await getDocs(query(collection(db, 'students'), where('chestNo', '==', candidate)));
            if (!snap.empty) {
              matched = { id: snap.docs[0].id, ...(snap.docs[0].data() as any) };
              break;
            }
          }
        } else if (refParam) {
          const snap = await getDoc(doc(db, 'students', refParam));
          if (snap.exists()) matched = { id: snap.id, ...(snap.data() as any) };
        }

        if (!active) return;
        if (!matched) {
          setErrorTitle('Participant Not Found');
          setErrorBody('No matching participant record was found for this QR badge.');
          setLoading(false);
          return;
        }

        const expectedToken = computeVerificationToken(matched);
        if (tokenParam !== expectedToken) {
          setErrorTitle('QR Signature Mismatch');
          setErrorBody(
            'The security token on this QR code does not match official records. Please scan the latest printed or digital ID card.'
          );
          setLoading(false);
          return;
        }

        const [evRows, regSnap, resRows] = await Promise.all([
          cachedGetDocs<FestEvent>('col:events', collection(db, 'events'), { ttlMs: 120_000 }),
          getDocs(query(collection(db, 'registrations'), where('studentIds', 'array-contains', matched.id))),
          cachedGetDocs<ResultDoc>(
            'col:results:published',
            query(collection(db, 'results'), where('status', '==', 'published')),
            { ttlMs: 60_000 }
          ),
        ]);

        if (!active) return;

        const eventMap = new Map(evRows.map((e) => [e.id, e]));
        const confirmed: ConfirmedEventItem[] = regSnap.docs
          .map((d) => {
            const reg = d.data() as any;
            const ev = eventMap.get(reg.eventId);
            return {
              id: reg.eventId || d.id,
              name: ev?.name || reg.eventName || 'Event',
              stage: ev?.stage || 'On-Stage',
              type: ev?.type || 'Single',
              date: ev?.scheduleDate || '',
              time: ev?.time || '',
              venue: ev?.scheduleStage || '',
            };
          })
          .sort((a, b) => `${a.date} ${a.time} ${a.name}`.localeCompare(`${b.date} ${b.time} ${b.name}`));

        const earned: Array<{ eventName: string; category: string; items: string[] }> = [];
        const matchedRegIds = new Set(regSnap.docs.map((d) => d.id));
        resRows.forEach((raw) => {
          const norm = normalizeResultData(raw, { events: evRows });
          const items: string[] = [];
          (norm.places || []).forEach((p) => {
            const hit = (p.winners || []).some((w: any) => w.id === matched!.id || matchedRegIds.has(w.id));
            if (hit) items.push(p.label);
          });
          (norm.gradeAwards || []).forEach((g) => {
            const hit = (g.winners || []).some((w: any) => w.id === matched!.id || matchedRegIds.has(w.id));
            if (hit) items.push(g.label);
          });
          if (items.length) {
            earned.push({
              eventName: norm.eventName || 'Event',
              category: resolveDisplayName(gen.categoryDisplayNames, norm.category, 'General'),
              items,
            });
          }
        });

        setStudent(matched);
        setConfirmedEvents(confirmed);
        setAwards(earned);
        setLoading(false);
      } catch (err: any) {
        if (active) {
          setErrorTitle('Verification Failed');
          setErrorBody(err?.message || 'Unable to verify participant record right now.');
          setLoading(false);
        }
      }
    }
    verify();
    return () => {
      active = false;
    };
  }, [searchParams]);

  useEffect(() => {
    document.title = `Verify Badge — ${brandingName(branding)}`;
  }, [branding]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      <EditorialHeader branding={branding} publicModules={festSetup.publicModules} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Verifying official QR signature…
          </div>
        ) : errorTitle ? (
          <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="mt-4 font-display text-xl font-bold text-slate-900">{errorTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{errorBody}</p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Return Home
            </Link>
          </div>
        ) : student ? (
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <ParticipantIdCard
                student={student}
                confirmedEvents={confirmedEvents}
                branding={branding}
                teamColors={general.teamColors}
                teamDisplayNames={general.teamDisplayNames}
                categoryDisplayNames={general.categoryDisplayNames}
                verificationUrl={buildVerificationUrl(student)}
              />
            </div>

            <div className="space-y-6 lg:col-span-7">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-900">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div>
                  <h1 className="font-display text-base font-bold">Verified Festival Participant</h1>
                  <p className="mt-0.5 text-xs text-emerald-800">
                    Cryptographic badge signature confirmed for {student.name}.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Confirmed Events ({confirmedEvents.length})
                </h2>
                <div className="mt-3 divide-y divide-slate-100">
                  {confirmedEvents.length ? (
                    confirmedEvents.map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-900">{ev.name}</p>
                          <p className="mt-0.5 text-slate-500">
                            {ev.stage} · {ev.type}
                          </p>
                        </div>
                        <div className="text-right font-mono-num text-slate-600">
                          <p>{ev.date || 'TBD'} {ev.time || ''}</p>
                          {ev.venue && <p className="text-[11px] text-slate-400">{ev.venue}</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-6 text-center text-xs text-slate-400">
                      No confirmed events assigned yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900">
                  <Award className="h-4 w-4 text-blue-700" />
                  <span>Published Awards ({awards.length})</span>
                </h2>
                <div className="mt-3 divide-y divide-slate-100">
                  {awards.length ? (
                    awards.map((a, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 py-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-900">{a.eventName}</p>
                          <p className="text-slate-500">{a.category}</p>
                        </div>
                        <span className="font-semibold text-blue-700">{a.items.join(' · ')}</span>
                      </div>
                    ))
                  ) : (
                    <p className="py-6 text-center text-xs text-slate-400">
                      No published awards recorded yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <EditorialFooter branding={branding} />
    </div>
  );
};
