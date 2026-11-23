import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Modal } from '../ui/Modal';

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState<'ios' | 'android' | null>(null);

  if (isInstalled) return null;

  if (!isInstallable && !isIOS && !isAndroid) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) return;
    }
    if (isIOS) {
      setGuideOpen('ios');
    } else if (isAndroid) {
      setGuideOpen('android');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Install Android / Mobile App"
        aria-label="Install App"
        className={
          compact
            ? `inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap ${className}`
            : `inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 ${className}`
        }
      >
        <Download className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
        <span>Install App</span>
      </button>

      <Modal
        open={guideOpen !== null}
        onClose={() => setGuideOpen(null)}
        title={guideOpen === 'ios' ? 'Install on iPhone / iPad' : 'Install Android App'}
        maxWidthClass="max-w-sm"
      >
        {guideOpen === 'ios' ? (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed">
                <li>
                  Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
                </li>
                <li>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong>Add</strong> to launch Feastport as a full-screen mobile app.
                </li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed">
                <li>
                  Open the Chrome menu (<strong>⋮</strong>) at the top-right corner of your browser.
                </li>
                <li>
                  Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </li>
                <li>
                  Confirm <strong>Install</strong> to add Feastport directly to your Android app drawer.
                </li>
              </ol>
            </div>
          </div>
        )}
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
