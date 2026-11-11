'use client';

// One step of the rule in the builder (docs/specs/026-plan/automations.md "The rule builder"): its icon on a tinted
// tile, its kind ("When", "If all of these", "Then"), what it does, and its ⋯ menu. Selecting it opens its panel. A
// selected step wears the brand ring; the step a refusal names wears the problem ring and says why. StepJoin draws
// the line between two steps.

import type { ReactNode } from 'react';
import type { AutomationStep } from '@liveplanner/items';
import { STEP_KIND_TEXT, StepTile, type StepTone } from './automation-glyphs';

export function StepJoin() {
  return <span aria-hidden className="ml-[31px] block h-5 w-0.5 bg-slate-300 dark:bg-slate-600" />;
}

export function StepCard({
  tone,
  kind,
  label,
  selected,
  fault,
  onSelect,
  menu,
  children,
}: {
  tone: StepTone;
  kind?: AutomationStep['kind'] | undefined;
  // The kind line: When, If all of these, Then.
  label: string;
  selected: boolean;
  // The refusal's message when this step is the one at fault.
  fault?: string | null | undefined;
  onSelect: () => void;
  menu?: ReactNode;
  // What the step does: chips, a sub-line.
  children: ReactNode;
}) {
  const ring = fault
    ? 'border-red-400 ring-2 ring-red-100 dark:border-red-500/70 dark:ring-red-500/20'
    : selected
      ? 'border-brand-400 ring-2 ring-brand-100 dark:border-brand-500/70 dark:ring-brand-500/20'
      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600';
  return (
    <div
      data-step-card=""
      data-selected={selected || undefined}
      data-fault={fault ? '' : undefined}
      className={`relative flex w-full items-start gap-3 rounded-xl border bg-white px-4 py-3.5 transition motion-reduce:transition-none dark:bg-slate-900 ${ring}`}
    >
      <StepTile tone={tone} kind={kind} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* The whole card selects through this button, its after: area spread over the card; the menu sits above. */}
        <button
          type="button"
          aria-pressed={selected}
          onClick={onSelect}
          className={`text-left text-[11px] font-semibold uppercase leading-none tracking-wider after:absolute after:inset-0 after:rounded-xl ${STEP_KIND_TEXT[tone]}`}
        >
          {label}
        </button>
        <div className="flex min-w-0 flex-col gap-1 text-[13px] text-slate-800 dark:text-slate-100">
          {children}
        </div>
        {fault ? (
          <p
            role="alert"
            className="relative text-[12px] font-medium text-red-700 dark:text-red-300"
          >
            {fault}
          </p>
        ) : null}
      </div>
      {menu ? <span className="relative z-[1] -mr-1.5 -mt-1">{menu}</span> : null}
    </div>
  );
}
