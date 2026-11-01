import type { ReactNode } from 'react';
import { SETTINGS_INPUT } from '@liveworkspace/settings-ui';

// The site's buttons, field, card and error note, as the account's own parts use them: the Settings panel's Profile
// and API Tokens, and the join, decline and workbench pairing pages.

// The site's buttons, by weight.
export const BUTTON = {
  primary:
    'inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors duration-micro hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200',
  secondary:
    'inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-micro hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
  danger:
    'inline-flex cursor-pointer items-center justify-center rounded-full px-3 py-1.5 text-sm font-semibold text-rose-700 transition-colors duration-micro hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-500/10',
  // An icon alone, the secondary button's height, named by its aria-label and a Tooltip.
  icon: 'inline-flex size-[38px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white',
  // The icon button for a destructive step, red on hover.
  iconDanger:
    'inline-flex size-[38px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors duration-micro hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300',
};

// The Settings panel's own field (Settings › Profile's name), so the two read as one.
export const INPUT = SETTINGS_INPUT;

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </section>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
    >
      {children}
    </p>
  );
}
