'use client';

import { AccordionSection } from '@/components/primitives/AccordionSection';
import { Tooltip } from '@/components/primitives/Tooltip';

// One collapsible row of mutually-exclusive choices, the shape every
// tool-config panel is built from (spec/101, spec/111, spec/112, spec/113):
// an uppercase title, the current value still readable while collapsed, and a
// wrap of radio pills once open.
//
// Avatar, Eraser, Laser and Spotlight each carried their own copy of this,
// under two different names (OptionSection / OptionRow), identical down to the
// four AccordionSection class strings. They had not gone wrong yet, but they
// had started to diverge: three grew per-option Tooltip hints, one grew a
// colour swatch, one grew a "Custom" header label. Each addition landed in one
// copy, so the next one costs four edits or silently makes the panels
// inconsistent. The union of all four lives here, with every extra optional so
// a panel that wants none passes none.
//
// Stays in apps/live: only the editor draws these panels. The packages/ rule is
// for what two APPS share.
export function ToolOptionRow<T extends string>({
  label,
  options,
  value,
  valueLabel,
  open,
  onToggle,
  onPick,
  swatchFor,
}: {
  label: string;
  options: readonly { id: T; label: string; hint?: string }[];
  // Nullable because a row's value can sit off every preset: the Spotlight's
  // Size says "Custom" once a click has nudged the radius between two of them.
  value: T | null;
  // What the collapsed header shows. Defaults to the current option's own
  // label, which is what a row whose value is always a preset wants.
  valueLabel?: string;
  open: boolean;
  onToggle: () => void;
  onPick: (id: T) => void;
  // Colour rows draw a dot instead of relying on the option's name.
  swatchFor?: (id: T) => string;
}) {
  const current = options.find((o) => o.id === value);
  const shown = valueLabel ?? current?.label;
  return (
    <AccordionSection
      title={label}
      open={open}
      onToggle={onToggle}
      headerClassName="flex w-full items-center justify-between gap-2 py-1.5 text-left"
      titleClassName="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
      chevronClassName="text-slate-400 dark:text-slate-500"
      bodyClassName="pb-2"
      // The value stays visible while collapsed, so a panel reads as a summary
      // of the tool rather than four mystery rows.
      trailing={
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          {swatchFor && value !== null ? (
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: swatchFor(value) }}
            />
          ) : null}
          {shown}
        </span>
      }
    >
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const active = option.id === value;
          const button = (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(option.id)}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                active
                  ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500'
              }`}
            >
              {swatchFor ? (
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: swatchFor(option.id) }}
                />
              ) : null}
              {option.label}
            </button>
          );
          return option.hint ? (
            <Tooltip key={option.id} title={option.label} description={option.hint}>
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </div>
    </AccordionSection>
  );
}
