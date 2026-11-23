import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, LogOut, Menu, Moon, Sun, X, type LucideIcon } from 'lucide-react';

export interface WorkspaceNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface WorkspaceShellProps {
  portalTitle: string;
  portalSubtitle: string;
  navItems: WorkspaceNavItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  userLabel: string;
  userSublabel?: string;
  onLogout: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  portalTitle,
  portalSubtitle,
  navItems,
  activeTab,
  onTabChange,
  userLabel,
  userSublabel,
  onLogout,
  theme,
  onToggleTheme,
  headerActions,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentNav = navItems.find((item) => item.id === activeTab);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-slate-900 dark:text-slate-100">{portalTitle}</p>
          <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{portalSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Workspace navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onTabChange(item.id);
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="rounded-md bg-blue-700 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-white dark:bg-blue-600">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="mb-3 min-w-0">
          <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{userLabel}</p>
          {userSublabel && (
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{userSublabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Public Site</span>
          </Link>
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 lg:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-slate-950/60 lg:hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSidebarOpen(false);
          }}
        >
          <aside className="w-64 border-r border-slate-200 dark:border-slate-800">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">{portalTitle}</span>
                <span aria-hidden="true">/</span>
                <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                  {currentNav?.label || 'Overview'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};
