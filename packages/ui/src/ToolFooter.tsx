'use client';

// A tool's main actions, pinned at the foot of its view (liveworkspace/docs/specs/004-index/footer-tools-menu.md "The
// main button stays at the foot"): a white strip with a hairline above it, sticky to the bottom of whichever box
// scrolls, holding full-width buttons in Walkthroughs' look (owner, 2026-11-17: one look across every tool). Record
// Walkthrough, Add Webhook, and Slide Deck's New Slide and Present all wear it.

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './Spinner';

export function ToolFooter({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-tool-footer=""
      className={`sticky bottom-0 z-[1] mt-auto flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}

const BASE =
  'flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-default disabled:opacity-40';
const LOOK = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:hover:bg-brand-700',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:hover:border-slate-200 disabled:hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
} as const;

/** One of a ToolFooter's full-width buttons: the main action (primary) or the one beside it (secondary). */
export const ToolFooterButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: keyof typeof LOOK;
    // Working: a spinner before the words, and no second press. It keeps the keyboard (aria-disabled, not disabled).
    busy?: boolean;
  }
>(function ToolFooterButton(
  {
    variant = 'primary',
    className = '',
    type = 'button',
    busy = false,
    children,
    onClick,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={busy ? undefined : onClick}
      className={`${BASE} ${LOOK[variant]} ${busy ? 'cursor-progress' : ''} ${className}`}
      {...rest}
    >
      {busy ? <Spinner size={13} /> : null}
      {children}
    </button>
  );
});
