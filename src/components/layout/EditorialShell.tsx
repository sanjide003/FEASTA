import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import type { BrandingConfig } from '../../types/festival';
import { brandingName, currentYear, isBase64Image } from '../../lib/branding';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface EditorialHeaderProps {
  branding: BrandingConfig;
  publicModules?: Record<string, boolean>;
  rightAction?: React.ReactNode;
}

export const EditorialHeader: React.FC<EditorialHeaderProps> = ({
  branding,
  publicModules = {},
  rightAction,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const name = brandingName(branding);
  const hasLogo = isBase64Image(branding.logoUrl);

  const isHome = location.pathname === '/' || location.pathname === '/index.html';
  const isResults = location.pathname.startsWith('/results');
  const isRegister = location.pathname.startsWith('/register');

  const navLinkClass = (active: boolean) =>
    `py-5 whitespace-nowrap shrink-0 transition-colors ${
      active
        ? 'border-b-2 border-blue-700 font-semibold text-blue-700'
        : 'font-medium text-slate-600 hover:text-slate-900'
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <Link to="/" className="flex min-w-0 items-center gap-2.5 whitespace-nowrap shrink-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {hasLogo ? (
              <img
                src={branding.logoUrl}
                alt={name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="font-display text-xs font-bold text-blue-700">
                {name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join('') || 'FP'}
              </span>
            )}
          </span>
          <span className="truncate max-w-[190px] sm:max-w-[260px] font-display text-base sm:text-lg font-bold tracking-tight text-slate-900">
            {name}
          </span>
        </Link>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm" aria-label="Primary navigation">
          <Link to="/" className={navLinkClass(isHome)}>
            Home
          </Link>
          {publicModules.results !== false && (
            <Link to="/results" className={navLinkClass(isResults)}>
              Results
            </Link>
          )}
          {publicModules.schedule !== false && (
            <Link to="/#schedule" className={navLinkClass(false)}>
              Schedule
            </Link>
          )}
          {publicModules.registration !== false && (
            <Link to="/register" className={navLinkClass(isRegister)}>
              Register
            </Link>
          )}
        </nav>

        {/* Zone 3: Install + Single Primary Action + Mobile Drawer Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton branding={branding} className="hidden sm:inline-flex" />
          {rightAction ? (
            rightAction
          ) : publicModules.registration !== false ? (
            <Link
              to="/register"
              className="hidden md:inline-flex items-center rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              Register
            </Link>
          ) : (
            <Link
              to="/results"
              className="hidden md:inline-flex items-center rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              View Results
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-slate-200 bg-white px-4 py-3 md:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-7xl flex-col space-y-1 text-sm">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className={`rounded-lg px-3 py-2.5 ${isHome ? 'bg-slate-50 font-semibold text-blue-700' : 'font-medium text-slate-700'}`}
            >
              Home
            </Link>
            {publicModules.results !== false && (
              <Link
                to="/results"
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2.5 ${isResults ? 'bg-slate-50 font-semibold text-blue-700' : 'font-medium text-slate-700'}`}
              >
                Results
              </Link>
            )}
            {publicModules.schedule !== false && (
              <Link
                to="/#schedule"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Schedule
              </Link>
            )}
            {publicModules.registration !== false && (
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2.5 ${isRegister ? 'bg-slate-50 font-semibold text-blue-700' : 'font-medium text-slate-700'}`}
              >
                Register
              </Link>
            )}
            <div className="pt-1 sm:hidden">
              <PWAInstallButton className="w-full justify-center" />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
};

export const EditorialFooter: React.FC<{ branding: BrandingConfig }> = ({ branding }) => {
  const name = brandingName(branding);
  const social = branding.social || {};
  const socialItems = [
    ['wa', 'fab fa-whatsapp', 'WhatsApp'],
    ['ig', 'fab fa-instagram', 'Instagram'],
    ['fb', 'fab fa-facebook', 'Facebook'],
    ['yt', 'fab fa-youtube', 'YouTube'],
    ['tg', 'fab fa-telegram', 'Telegram'],
  ].filter(([k]) => Boolean((social as Record<string, string | undefined>)[k]));

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
        <div>
          &copy; {currentYear()} <span className="font-semibold text-slate-700">{name}</span>.
          {branding.footerText ? ` ${branding.footerText} ·` : ''}
          <a
            href="https://www.instagram.com/muhammed_sanjide_p"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-slate-500 hover:text-slate-800 hover:underline"
          >
            Powered by hadi mahiri faizy
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          {socialItems.length > 0 && (
            <div className="flex items-center gap-4 text-base text-slate-500">
              {socialItems.map(([k, cls, label]) => (
                <a
                  key={k}
                  href={(social as Record<string, string>)[k]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="hover:text-slate-900"
                >
                  <i className={cls} />
                </a>
              ))}
            </div>
          )}
          <Link to="/login" className="font-medium text-slate-500 hover:text-slate-900 hover:underline whitespace-nowrap">
            Staff Portal
          </Link>
        </div>
      </div>
    </footer>
  );
};
