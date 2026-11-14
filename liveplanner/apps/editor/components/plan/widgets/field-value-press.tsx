'use client';

// Pressing a Breakdown's or Donut's value (docs/specs/026-plan/board-widgets.md "Pressing a value" and "Every value"):
// a named value in the pill is a ValueButton, and "+n" is MoreValues, a popover legend of every value the widget reads,
// each row pressing the same field chip. Both work the press out with valuePress, so a value reads pressed, toggles
// and stops at the chip cap the same way wherever it is drawn.
import { useState } from 'react';
import {
  fieldValueFilter,
  toggleFieldFilter,
  type BoardField,
  type QuickFilter,
} from '@liveplanner/items';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import type { PlanPalette } from '../plan-palette';
import { PRESSABLE } from './board-widget-parts';

export type FilterPress = { quick: QuickFilter; onQuick: (q: QuickFilter) => void };
type Value = { key: string; label: string };
/** A value as the "+n" legend lists it: its colour, its count and, on a Donut, its share (0 to 100). */
export type LegendValue = Value & { count: number; color: string; share?: number };

// The kinds whose cards hold several values: pressing a second value keeps the first.
const STACKING = new Set(['labels', 'multichoice']);
// The "+n" popover's width.
export const MORE_VALUES_PX = 240;

// Whether a value's chip is on, whether it can still be pressed (the chip cap), and the press itself.
function valuePress(field: BoardField, value: Value, filter: FilterPress) {
  const chip = fieldValueFilter({ id: field.def.id, kind: field.def.kind }, value.key);
  const filters = filter.quick.filters ?? [];
  const on = filters.some((f) => f.field === chip.field && f.key === chip.key);
  const next = toggleFieldFilter(filters, chip, STACKING.has(field.def.kind));
  // At the chip cap with nothing of this field to replace: nothing more fits.
  const full = !on && !next.some((f) => f.field === chip.field && f.key === chip.key);
  const press = () => {
    const q: QuickFilter = { ...filter.quick };
    if (next.length) q.filters = next;
    else delete q.filters;
    filter.onQuick(q);
  };
  return { on, full, press, name: `Only ${field.def.label}: ${value.label}` };
}

// A value of a category field that narrows the board when pressed: a field chip of the Filter widget, pressed while
// the quick filter holds it, taken off by pressing it again.
export function ValueButton({
  field,
  value,
  filter,
  palette,
  children,
}: {
  field: BoardField;
  value: Value;
  filter: FilterPress;
  palette: PlanPalette;
  children: React.ReactNode;
}) {
  const v = valuePress(field, value, filter);
  return (
    <button
      type="button"
      aria-pressed={v.on}
      aria-label={v.name}
      disabled={v.full}
      className={`${PRESSABLE} -mx-1 ${v.on ? 'font-semibold' : ''}`}
      style={{
        color: palette.muted,
        backgroundColor: v.on ? `${palette.focus}1f` : undefined,
        boxShadow: v.on ? `inset 0 0 0 1px ${palette.focus}` : undefined,
      }}
      onClick={v.press}
    >
      {children}
    </button>
  );
}

// "+n": the values the pill leaves out, opening a legend of every value, each pressable. It stays open as values are
// pressed (Labels stack), and closes on Escape or a press outside.
export function MoreValues({
  field,
  values,
  rest,
  filter,
  palette,
}: {
  field: BoardField;
  values: readonly LegendValue[];
  rest: number;
  filter: FilterPress;
  palette: PlanPalette;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const name = `${field.def.label} values`;
  // How many of the values the pill leaves out are pressed: "+n" then wears the pressed outline, so a filter set
  // from the popover never hides behind it.
  const hiddenOn = values
    .slice(values.length - rest)
    .filter((v) => valuePress(field, v, filter).on).length;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        aria-label={hiddenOn ? `More ${name}, ${hiddenOn} pressed` : `More ${name}`}
        className={`${PRESSABLE} -mx-1 tabular-nums ${hiddenOn ? 'font-semibold' : ''}`}
        style={{
          color: palette.muted,
          backgroundColor: hiddenOn ? `${palette.focus}1f` : undefined,
          boxShadow: hiddenOn ? `inset 0 0 0 1px ${palette.focus}` : undefined,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        +{rest}
      </button>
      {anchor ? (
        <AnchoredPopover
          anchor={anchor}
          name={name}
          width={MORE_VALUES_PX}
          pointer
          onClose={() => setAnchor(null)}
        >
          <div className="flex flex-col p-1.5" onPointerDown={(e) => e.stopPropagation()}>
            <span className="px-1.5 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {field.def.label}
            </span>
            <ul className="flex flex-col">
              {values.map((v) => (
                <li key={v.key}>
                  <ValueRow field={field} value={v} filter={filter} />
                </li>
              ))}
            </ul>
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}

// One row of the legend: the value's dot, name, count (and share), pressed while its chip is on.
function ValueRow({
  field,
  value,
  filter,
}: {
  field: BoardField;
  value: LegendValue;
  filter: FilterPress;
}) {
  const v = valuePress(field, value, filter);
  return (
    <button
      type="button"
      aria-pressed={v.on}
      aria-label={v.name}
      disabled={v.full}
      className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[13px] text-slate-700 transition enabled:cursor-pointer enabled:hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 motion-reduce:transition-none pointer-coarse:min-h-11 dark:text-slate-200 dark:enabled:hover:bg-slate-800 ${
        v.on
          ? 'bg-brand-50 font-semibold text-brand-800 ring-1 ring-inset ring-brand-300 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-400/50'
          : ''
      }`}
      onClick={v.press}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: value.color }}
      />
      <span className="min-w-0 flex-1 truncate">{value.label}</span>
      {value.share === undefined ? null : (
        <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
          {value.share}%
        </span>
      )}
      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {value.count}
      </span>
    </button>
  );
}
