import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type ActionTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

interface ActionIconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  icon: LucideIcon;
  label: string;
  tone?: ActionTone;
  size?: 'sm' | 'md';
}

const TONE_CLASSES: Record<ActionTone, string> = {
  default:
    'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white',
  primary:
    'border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-950/80',
  success:
    'border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/80',
  warning:
    'border-amber-200 bg-amber-50/70 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/80',
  danger:
    'border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/80',
};

export const ActionIconButton: React.FC<ActionIconButtonProps> = ({
  icon: Icon,
  label,
  tone = 'default',
  size = 'sm',
  className = '',
  type = 'button',
  ...rest
}) => {
  const dim = size === 'md' ? 'h-10 w-10 sm:h-9 sm:w-9' : 'h-10 w-10 sm:h-8 sm:w-8';
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:pointer-events-none disabled:opacity-40 ${dim} ${TONE_CLASSES[tone]} ${className}`}
      {...rest}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
};
