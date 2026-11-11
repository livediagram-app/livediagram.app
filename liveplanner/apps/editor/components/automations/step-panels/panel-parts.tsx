'use client';

// The step panels' shared parts (docs/specs/026-plan/automations.md "The rule builder": the step panel): a labelled
// field, a set of toggle chips for picking several of the plan's columns, types, fields or people, the is / is not
// choice, and the select every single pick uses. Real labels and buttons throughout, so each is keyboard reachable.

import { useId, type ReactNode } from 'react';
import { CheckIcon, Select, TextInput, type SelectProps } from '@liveplanner/ui';

export const PANEL_SELECT = 'h-9 rounded-lg pl-2.5 pr-7 text-[13px]';

export function PanelField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  // Handed the id its control should carry, so the label names it.
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-[12px] text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function PanelSelect(props: SelectProps) {
  return <Select {...props} className="w-full" selectClassName={PANEL_SELECT} />;
}

/** A group of toggle chips: several of the plan's names picked at once. */
export function ChipToggles({
  label,
  options,
  value,
  onChange,
  hint,
  empty = 'Nothing to pick in this plan yet.',
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  hint?: ReactNode;
  empty?: string;
}) {
  const id = useId();
  const picked = new Set(value);
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </span>
      {options.length === 0 ? (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">{empty}</p>
      ) : (
        <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const on = picked.has(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])
                }
                className={`touch-target-y relative inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium transition motion-reduce:transition-none ${
                  on
                    ? 'bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-300 hover:bg-brand-200 dark:bg-brand-500/25 dark:text-brand-100 dark:ring-brand-500/50 dark:hover:bg-brand-500/35'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {on ? <CheckIcon size={10} /> : null}
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      {/* The hint says what an empty pick means, so it shows only while nothing is picked. */}
      {hint && value.length === 0 ? (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

/** Is or Is Not, for a condition that names some of the plan's things. */
export function IsNotPicker({ not, onChange }: { not: boolean; onChange: (not: boolean) => void }) {
  return (
    <PanelField label="Match">
      {(id) => (
        <PanelSelect
          id={id}
          value={not ? 'not' : 'is'}
          onChange={(e) => onChange(e.target.value === 'not')}
        >
          <option value="is">Is one of</option>
          <option value="not">Is not one of</option>
        </PanelSelect>
      )}
    </PanelField>
  );
}

/** A day a date names: Today, shifted by whole days. */
export function TodayShift({
  label,
  days,
  onChange,
}: {
  label: string;
  days: number;
  onChange: (days: number) => void;
}) {
  return (
    <PanelField
      label={label}
      hint="Days from the day the rule runs: 0 is today, -1 yesterday, 7 a week on."
    >
      {(id) => (
        <TextInput
          compact
          id={id}
          type="number"
          step={1}
          min={-365}
          max={365}
          value={days}
          onChange={(e) => onChange(Math.trunc(Number(e.target.value) || 0))}
          className="w-28"
        />
      )}
    </PanelField>
  );
}

/** A quiet sentence for a step with nothing to set. */
export function PanelNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
      {children}
    </p>
  );
}
