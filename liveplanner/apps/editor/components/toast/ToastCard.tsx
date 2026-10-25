'use client';

// One toast (docs/specs/004-interface-design/toasts.md "One line by default" and "Look"): icon, message,
// actions, close, on one row. The message's flex basis is its own width, so a short one shares the row
// with its buttons; one too long for the row takes it whole, and the buttons drop to a row of their own at
// its end. The close stays in the top row's corner. Presentational: the stack owns timing and leaving.
import type { HTMLAttributes, ReactNode } from 'react';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideInfo,
  lucideTriangleAlert,
} from '@liveworkspace/icons/lucide';
import { CloseIcon, lucideGlyph } from '@liveplanner/ui';
import type { ToastTone } from './toast-queue';

/** The toast's card look, shared with the notices that are not in the stack (the new-version prompt). */
export const TOAST_SURFACE =
  'rounded-xl border bg-white text-slate-800 shadow-lg shadow-slate-900/10 dark:bg-slate-900 dark:text-slate-100 dark:shadow-black/40';

const BORDER: Record<ToastTone, string> = {
  info: 'border-slate-200 dark:border-slate-700',
  success: 'border-slate-200 dark:border-slate-700',
  warning: 'border-amber-200 dark:border-amber-500/40',
  error: 'border-rose-200 dark:border-rose-500/40',
};

const ICON_TINT: Record<ToastTone, string> = {
  info: 'text-brand-700 dark:text-brand-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-rose-600 dark:text-rose-400',
};

const ICONS: Record<ToastTone, ReturnType<typeof lucideGlyph>> = {
  info: lucideGlyph(lucideInfo, 16),
  success: lucideGlyph(lucideCircleCheck, 16),
  warning: lucideGlyph(lucideTriangleAlert, 16),
  error: lucideGlyph(lucideCircleAlert, 16),
};

const ACTION_BASE =
  'touch-target relative inline-flex h-8 shrink-0 items-center rounded-lg px-2.5 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50';
const ACTION_PRIMARY =
  'text-brand-700 enabled:hover:bg-brand-50 dark:text-brand-300 dark:enabled:hover:bg-brand-500/15';
const ACTION_SECONDARY =
  'text-slate-600 enabled:hover:bg-slate-100 enabled:hover:text-slate-900 dark:text-slate-300 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-white';

export type ToastCardAction = {
  label: string;
  ariaLabel?: string;
  onSelect: () => void;
  disabled?: boolean;
  primary?: boolean;
};

export function ToastCard({
  tone,
  message,
  actions = [],
  onClose,
  leaving = false,
  full = false,
  className = '',
  ...rest
}: {
  tone: ToastTone;
  message: ReactNode;
  actions?: readonly ToastCardAction[];
  onClose: () => void;
  leaving?: boolean;
  // Arrived on a full stack: the bolder entrance (toast-in-full), so a new toast on a busy stack is seen.
  full?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'children'>) {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      data-toast-tone={tone}
      className={`flex w-full items-start gap-3 py-1.5 pl-3 pr-1.5 sm:w-auto sm:max-w-[36rem] ${TOAST_SURFACE} ${BORDER[tone]} ${leaving ? 'pointer-events-none animate-toast-out' : full ? 'pointer-events-auto animate-toast-in-full' : 'pointer-events-auto animate-toast-in'} ${className}`}
      {...rest}
    >
      <span className={`flex h-8 shrink-0 items-center ${ICON_TINT[tone]}`} aria-hidden>
        <Icon />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
        <p className="min-w-0 flex-[1_1_auto] py-1.5 text-sm leading-5">{message}</p>
        {actions.length > 0 ? (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onSelect}
                disabled={action.disabled}
                aria-label={action.ariaLabel}
                className={`${ACTION_BASE} ${action.primary ? ACTION_PRIMARY : ACTION_SECONDARY}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="touch-target relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}
