'use client';

// The parts Set Automatically and Extra Columns share (docs/specs/030-forms/forms.md "Filled in automatically"): a
// closed accordion with its count, a row with its remove button, the submitted day's days, and the readers of what
// is typed.
import { useState, type ReactNode } from 'react';
import { FIXED_DAYS_MAX, type SubmittedDay } from '@liveplanner/forms';
import { CloseIcon, Tooltip } from '@liveplanner/ui';
import { AccordionSection } from '@liveworkspace/workbench/components/primitives/AccordionSection';
import { DraftText } from './DraftText';

// The zone "submitted" is read in: this Editor's (forms.md "Filled in automatically").
const browserZone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

export const submittedAfter = (days: number): { submitted: SubmittedDay } => {
  const tz = browserZone();
  return { submitted: tz ? { days, tz } : { days } };
};

// A whole number of days, 0..FIXED_DAYS_MAX, from what was typed; null when it is not one.
export function readDays(text: string): number | null {
  const t = text.trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= FIXED_DAYS_MAX ? n : null;
}

// Labels typed split by commas, each trimmed; empty ones dropped.
export const readLabels = (text: string): string[] =>
  text
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);

// A number typed (finite), or null.
export function readNumber(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const BOX =
  'flex min-w-0 items-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-900 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus-within:ring-brand-500/30';

export const ADD =
  'flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-[13px] font-medium text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 dark:hover:text-brand-200';

export function Shell({
  title,
  count,
  hint,
  startOpen,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  startOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
      <AccordionSection
        title={title}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        trailing={
          count ? (
            <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {count}
            </span>
          ) : null
        }
      >
        <p className="text-[12px] text-slate-500 dark:text-slate-400">{hint}</p>
        {children}
      </AccordionSection>
    </div>
  );
}

// One set field or extra column: its name and a way to stop setting it, then its value.
export function Row({
  name,
  hint,
  onRemove,
  removeLabel,
  disabled,
  children,
}: {
  name: ReactNode;
  hint?: string;
  onRemove: () => void;
  removeLabel: string;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1 text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {name}
        </div>
        {hint ? (
          <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{hint}</span>
        ) : null}
        <Tooltip label={removeLabel}>
          <button
            type="button"
            aria-label={removeLabel}
            disabled={disabled}
            onClick={onRemove}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-default disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <CloseIcon />
          </button>
        </Tooltip>
      </div>
      {children}
    </li>
  );
}

export function SubmittedDays({
  days,
  onDays,
  disabled,
  label,
}: {
  days: number;
  onDays: (days: number) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
      <span className="shrink-0">Submitted Date +</span>
      <div className={`${BOX} w-16`}>
        <DraftText
          label={`${label}: days after submitting`}
          value={String(days)}
          maxLength={3}
          disabled={disabled}
          selectOnFocus
          onSave={(t) => {
            const n = readDays(t);
            if (n !== null && n !== days) onDays(n);
          }}
          className="text-right tabular-nums"
        />
      </div>
      <span className="shrink-0">{days === 1 ? 'day' : 'days'}</span>
    </div>
  );
}
