'use client';

// The small visual vocabulary the Session Studio panes share: the tool
// switcher, the button family, a segmented control, the round transport
// buttons under the timer, and the callout. One file so the three panes read
// as one surface, and so nothing here grows a fourth copy of the chip / button
// class strings the old per-tool sections each carried.

import type { ReactNode } from 'react';
import { PollMenuIcon, TimerMenuIcon, VoteMenuIcon } from '@/components/palette/context-menu-icons';
import type { StudioTool, StudioToolStatus } from './session-studio';

const TOOL_META: Record<StudioTool, { label: string; icon: ReactNode }> = {
  timer: { label: 'Timer', icon: <TimerMenuIcon /> },
  vote: { label: 'Vote', icon: <VoteMenuIcon size={12} /> },
  poll: { label: 'Poll', icon: <PollMenuIcon size={12} /> },
};

// Segmented tabs across the top of the studio. Each carries a status dot, so
// a glance at the switcher says what is running on the tab (green, pulsing)
// or set up and waiting (amber) without opening each tool.
export function StudioSwitcher({
  tools,
  tool,
  status,
  onChange,
}: {
  tools: readonly StudioTool[];
  tool: StudioTool;
  status: (t: StudioTool) => StudioToolStatus;
  onChange: (t: StudioTool) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Session tools"
      className="grid gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
      style={{ gridTemplateColumns: `repeat(${tools.length}, minmax(0, 1fr))` }}
    >
      {tools.map((t) => {
        const on = t === tool;
        const s = status(t);
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t)}
            className={`relative flex items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11px] font-semibold transition ${
              on
                ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-200'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            {TOOL_META[t].icon}
            <span className="truncate">{TOOL_META[t].label}</span>
            {s ? (
              <span
                aria-label={s === 'live' ? 'Running' : 'Waiting'}
                className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
                  s === 'live' ? 'animate-pulse bg-emerald-500' : 'bg-amber-400'
                }`}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const BUTTON_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-white shadow-sm hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-800 dark:disabled:text-slate-500',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60',
  danger:
    'border border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-rose-500/50 dark:hover:bg-rose-500/10 dark:hover:text-rose-300',
};

export function StudioButton({
  variant = 'secondary',
  icon,
  children,
  onClick,
  disabled,
  title,
}: {
  variant?: ButtonVariant;
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed ${BUTTON_CLASS[variant]}`}
    >
      {icon}
      {children}
    </button>
  );
}

// A pill segmented control for a small, exclusive choice (Countdown or
// Stopwatch; a vote's layer). Wraps rather than scrolls, so a long layer list
// stays readable in the narrow panel.
export function StudioSegmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`max-w-full truncate rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              on
                ? 'border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-500/60 dark:bg-brand-500/20 dark:text-brand-100'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Round transport button under the timer face: an icon in a circle with its
// verb underneath, so the controls read like a media player rather than a
// row of identical text buttons.
export function TransportButton({
  label,
  icon,
  onClick,
  primary = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400"
    >
      <span
        className={`flex items-center justify-center rounded-full transition ${
          primary
            ? 'h-12 w-12 bg-brand-500 text-white shadow-md group-hover:bg-brand-600'
            : 'h-9 w-9 border border-slate-200 bg-white text-slate-600 group-hover:border-brand-300 group-hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
        }`}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

export function StudioCallout({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn';
  children: ReactNode;
}) {
  return (
    <p
      className={`rounded-lg px-2.5 py-1.5 text-[11px] leading-snug ${
        tone === 'warn'
          ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
          : 'bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300'
      }`}
    >
      {children}
    </p>
  );
}

export function StudioLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {children}
      </span>
      {aside ? (
        <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">{aside}</span>
      ) : null}
    </div>
  );
}

// --- Glyphs ------------------------------------------------------------------
// Transport icons at the 16px grid the rest of the menu icons use.

export function PlayGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z" />
    </svg>
  );
}

export function PauseGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="4" y="3" width="3" height="10" rx="0.8" />
      <rect x="9" y="3" width="3" height="10" rx="0.8" />
    </svg>
  );
}

export function RestartGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8a5 5 0 1 0 1.5-3.6" />
      <path d="M3 2.5v2.5h2.5" />
    </svg>
  );
}

export function StopGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
    </svg>
  );
}
