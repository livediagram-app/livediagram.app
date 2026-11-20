'use client';

// One toast (liveworkspace/docs/specs/016-notifications/toasts.md "One line by default" and "Look"): icon, message,
// actions, close, on one row. The message keeps its buttons beside it, wrapping onto a second line itself, while it
// has 10rem to wrap in; only then do the buttons drop to a row of their own at its end (a phone's sign-in toast had
// Sign In stranded under a one-line message, the owner, 2026-11-20). The close stays in the top row's corner. Presentational: the stack owns timing and leaving.
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideInfo,
  lucideSparkles,
  lucideTriangleAlert,
} from '@liveworkspace/icons/lucide';
import { CloseIcon } from '../icons/actions';
import { lucideGlyph } from '../icons/lucide-glyph';
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

/** Each tone's icon colour and glyph, shared with the notification list's rows. */
export const TOAST_ICON_TINT: Readonly<Record<ToastTone, string>> = {
  info: 'text-brand-700 dark:text-brand-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-rose-600 dark:text-rose-400',
};

export const TOAST_ICONS: Readonly<Record<ToastTone, ReturnType<typeof lucideGlyph>>> = {
  info: lucideGlyph(lucideInfo, 16),
  success: lucideGlyph(lucideCircleCheck, 16),
  warning: lucideGlyph(lucideTriangleAlert, 16),
  error: lucideGlyph(lucideCircleAlert, 16),
};

// The highlight look (toasts.md "Highlight"): a solid emerald card for the one toast that asks to be noticed (the
// guest sign-in toast), with a sparkle for its icon. White on emerald-700 reads at 5.5:1 and on emerald-800 at 7.7:1;
// the white Sign In button's emerald-800 label at 7.7:1. In forced colours the fill drops and the border stays.
const HIGHLIGHT_SURFACE =
  'rounded-xl border border-emerald-800/30 bg-emerald-700 text-white shadow-lg shadow-emerald-900/25 dark:border-emerald-400/30 dark:bg-emerald-800 dark:shadow-black/40';
const HIGHLIGHT_ICON = lucideGlyph(lucideSparkles, 16);

const ACTION_BASE =
  'touch-target relative inline-flex h-8 shrink-0 items-center rounded-lg px-2.5 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50';
const ACTION_PRIMARY =
  'text-brand-700 enabled:hover:bg-brand-50 dark:text-brand-300 dark:enabled:hover:bg-brand-500/15';
// A destructive answer (toasts.md "A destructive answer"): rose-700 reads at over 6:1 on white, rose-300 at over 9:1 on
// slate-900.
const ACTION_DESTRUCTIVE =
  'text-rose-700 enabled:hover:bg-rose-50 focus-visible:outline-rose-700 dark:text-rose-300 dark:enabled:hover:bg-rose-500/15 dark:focus-visible:outline-rose-300';
const ACTION_HIGHLIGHT_PRIMARY =
  'bg-white px-3 text-emerald-800 shadow-sm enabled:hover:bg-emerald-50 focus-visible:outline-white';
const ACTION_HIGHLIGHT_SECONDARY =
  'text-white/90 enabled:hover:bg-white/15 enabled:hover:text-white';
const ACTION_SECONDARY =
  'text-slate-600 enabled:hover:bg-slate-100 enabled:hover:text-slate-900 dark:text-slate-300 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-white';

export type ToastCardAction = {
  label: string;
  ariaLabel?: string;
  onSelect: () => void;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
};

function actionLook(action: ToastCardAction, highlight: boolean): string {
  if (highlight) return action.primary ? ACTION_HIGHLIGHT_PRIMARY : ACTION_HIGHLIGHT_SECONDARY;
  if (action.destructive) return ACTION_DESTRUCTIVE;
  return action.primary ? ACTION_PRIMARY : ACTION_SECONDARY;
}

export function ToastCard({
  tone,
  message,
  actions = [],
  onClose,
  leaving = false,
  full = false,
  highlight = false,
  className = '',
  ref,
  ...rest
}: {
  ref?: Ref<HTMLDivElement>;
  tone: ToastTone;
  message: ReactNode;
  actions?: readonly ToastCardAction[];
  onClose: () => void;
  leaving?: boolean;
  // Arrived on a full stack: the bolder entrance (toast-in-full), so a new toast on a busy stack is seen.
  full?: boolean;
  // The highlight look: solid emerald, a sparkle icon, a white primary button.
  highlight?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'children'>) {
  const Icon = highlight ? HIGHLIGHT_ICON : TOAST_ICONS[tone];
  return (
    <div
      ref={ref}
      role={tone === 'error' ? 'alert' : 'status'}
      data-toast-tone={tone}
      data-toast-highlight={highlight ? '' : undefined}
      className={`flex w-full items-start gap-3 py-1.5 pl-3 pr-1.5 sm:w-auto sm:max-w-[36rem] ${highlight ? HIGHLIGHT_SURFACE : `${TOAST_SURFACE} ${BORDER[tone]}`} ${leaving ? 'pointer-events-none animate-toast-out' : full ? 'pointer-events-auto animate-toast-in-full' : 'pointer-events-auto animate-toast-in'} ${className}`}
      {...rest}
    >
      <span
        className={`flex h-8 shrink-0 items-center ${highlight ? 'text-white' : TOAST_ICON_TINT[tone]}`}
        aria-hidden
      >
        <Icon />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
        <p className="min-w-0 flex-[1_1_10rem] py-1.5 text-sm leading-5">{message}</p>
        {actions.length > 0 ? (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onSelect}
                disabled={action.disabled}
                aria-label={action.ariaLabel}
                data-toast-destructive={action.destructive ? '' : undefined}
                className={`${ACTION_BASE} ${actionLook(action, highlight)}`}
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
        className={`touch-target relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 ${highlight ? 'text-white/80 hover:bg-white/15 hover:text-white focus-visible:outline-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-brand-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}
