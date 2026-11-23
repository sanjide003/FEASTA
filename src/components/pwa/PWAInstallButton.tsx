import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileArchive,
  Package,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { readCachedBranding } from '../../lib/branding';
import { cachedGetDoc } from '../../lib/dataCache';
import { getFirebaseState } from '../../lib/firebase';
import type { BrandingConfig } from '../../types/festival';
import { Modal } from '../ui/Modal';

interface AppPackageAvailability {
  apkUrl: string;
  aabUrl: string;
  versionName: string;
  packageId: string;
}

function isValidPackageUrl(raw?: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('/downloads/')) return value;
  return '';
}

async function probeStaticBinary(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: 'HEAD', cache: 'no-store' });
    if (!res.ok) return false;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    return !ct.includes('text/html');
  } catch {
    return false;
  }
}

function useAppPackageAvailability(initialBranding?: BrandingConfig): AppPackageAvailability {
  const [pkg, setPkg] = useState<AppPackageAvailability>(() => {
    const source = initialBranding || readCachedBranding();
    return {
      apkUrl: isValidPackageUrl(source.appDownloads?.apkUrl),
      aabUrl: isValidPackageUrl(source.appDownloads?.aabUrl),
      versionName: String(source.appDownloads?.versionName || '1.0.0').trim() || '1.0.0',
      packageId: String(source.appDownloads?.packageId || '').trim(),
    };
  });

  useEffect(() => {
    let active = true;

    const resolveSources = async () => {
      let source = initialBranding;
      if (!source?.appDownloads?.apkUrl && !source?.appDownloads?.aabUrl) {
        const { db, isFirebaseConfigured } = getFirebaseState();
        if (isFirebaseConfigured && db) {
          try {
            const docSnap = await cachedGetDoc<BrandingConfig>(db, 'settings', 'home_config', {
              ttlMs: 300_000,
            });
            if (docSnap) source = docSnap;
          } catch {
            // Fall back to cached or static binaries
          }
        }
      }

      let apkUrl = isValidPackageUrl(source?.appDownloads?.apkUrl);
      let aabUrl = isValidPackageUrl(source?.appDownloads?.aabUrl);

      if (!apkUrl && (await probeStaticBinary('/downloads/feastport.apk'))) {
        apkUrl = '/downloads/feastport.apk';
      }
      if (!aabUrl && (await probeStaticBinary('/downloads/feastport.aab'))) {
        aabUrl = '/downloads/feastport.aab';
      }

      if (!active) return;
      setPkg({
        apkUrl,
        aabUrl,
        versionName: String(source?.appDownloads?.versionName || '1.0.0').trim() || '1.0.0',
        packageId: String(source?.appDownloads?.packageId || '').trim(),
      });
    };

    resolveSources();
    return () => {
      active = false;
    };
  }, [
    initialBranding?.appDownloads?.apkUrl,
    initialBranding?.appDownloads?.aabUrl,
    initialBranding?.appDownloads?.versionName,
    initialBranding?.appDownloads?.packageId,
  ]);

  return pkg;
}

export const AppInstallFormats: React.FC<{
  branding?: BrandingConfig;
  compactLayout?: boolean;
}> = ({ branding, compactLayout = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const pkg = useAppPackageAvailability(branding);
  const [pwaMessage, setPwaMessage] = useState('');

  const handlePwaInstall = async () => {
    setPwaMessage('');
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setPwaMessage('App installed to your device home screen.');
      }
      return;
    }
    if (isIOS) {
      setPwaMessage('In Safari, tap Share and choose "Add to Home Screen".');
      return;
    }
    setPwaMessage('Open your browser menu (⋮) and tap "Install app" or "Add to Home screen".');
  };

  const hasAab = Boolean(pkg.aabUrl);

  return (
    <div
      className={`grid gap-3 ${
        compactLayout
          ? 'grid-cols-1'
          : hasAab
          ? 'grid-cols-1 md:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-2'
      }`}
    >
      {/* Option 1: Instant PWA */}
      <div className="flex flex-col justify-between rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              <Smartphone className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              Instant App (PWA)
            </span>
            <span className="font-mono-num text-[11px] font-semibold text-blue-700 dark:text-blue-400">
              Ready
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Install directly on Android, iOS, or Desktop with offline caching and automatic updates.
          </p>
          <p className="mt-2 font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
            Android · iOS · Desktop · Auto-Updates
          </p>
        </div>

        <div className="mt-4">
          {isInstalled ? (
            <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Installed on Device</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePwaInstall}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isInstallable ? 'Install PWA Now' : isIOS ? 'How to Install on iOS' : 'Install Web App'}</span>
            </button>
          )}
          {pwaMessage && (
            <p className="mt-2 text-[11px] font-medium text-blue-800 dark:text-blue-300">{pwaMessage}</p>
          )}
        </div>
      </div>

      {/* Option 2: Direct Android APK */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              <Package className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              Android APK (.apk)
            </span>
            <span className="font-mono-num text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              v{pkg.versionName}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Standalone signed Android installer (.apk) for direct installation on Android phones and tablets.
          </p>
          <p className="mt-2 font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
            Android 8.0+ · Signed APK{pkg.packageId ? ` · ${pkg.packageId}` : ''}
          </p>
        </div>

        <div className="mt-4">
          {pkg.apkUrl ? (
            <a
              href={pkg.apkUrl}
              download="feastport.apk"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download APK</span>
              {/^https?:\/\//i.test(pkg.apkUrl) && <ExternalLink className="h-3 w-3 opacity-75" />}
            </a>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-center text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
              APK link not configured yet · Paste GitHub Release APK URL in Admin Setup
            </div>
          )}
        </div>
      </div>

      {/* Option 3: Play Store Bundle (.aab) — shown only when explicitly published */}
      {hasAab && (
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                <FileArchive className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                App Bundle (.aab)
              </span>
              <span className="font-mono-num text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                v{pkg.versionName}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Google Play Console bundle only (cannot be installed directly on phones — use APK or PWA).
            </p>
            <p className="mt-2 font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
              Play Console · Signed AAB{pkg.packageId ? ` · ${pkg.packageId}` : ''}
            </p>
          </div>

          <div className="mt-4">
            <a
              href={pkg.aabUrl}
              download="feastport.aab"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download AAB</span>
              {/^https?:\/\//i.test(pkg.aabUrl) && <ExternalLink className="h-3 w-3 opacity-75" />}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
  branding?: BrandingConfig;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  className = '',
  branding,
}) => {
  const { isInstalled } = usePWAInstall();
  const pkg = useAppPackageAvailability(branding);
  const [modalOpen, setModalOpen] = useState(false);

  // If already running inside standalone PWA AND no binary downloads exist, keep bar ultra clean
  if (isInstalled && !pkg.apkUrl && !pkg.aabUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        title="Install App (PWA / Android APK)"
        aria-label="Install App"
        className={
          compact
            ? `inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap ${className}`
            : `inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 ${className}`
        }
      >
        <Download className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
        <span>Install</span>
      </button>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Install & Download App"
        subtitle={
          pkg.aabUrl
            ? 'Choose PWA instant install, Android APK installer, or Google Play AAB bundle'
            : 'Install instantly as a PWA on any device or download the direct Android APK'
        }
        maxWidthClass={pkg.aabUrl ? 'max-w-3xl' : 'max-w-2xl'}
      >
        <AppInstallFormats branding={branding} />
      </Modal>
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-700" />
      <span>Offline Mode — Cached festival data is available.</span>
    </div>
  );
};
