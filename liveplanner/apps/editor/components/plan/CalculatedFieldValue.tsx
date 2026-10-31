'use client';

// A Calculated field in the card panel (docs/specs/026-plan/item-types.md "Calculated fields"): its worked-out value,
// read-only, never an input. Children Done adds a thin bar of the share done; a card without children reads "No
// linked cards".
import {
  calculatedText,
  calculationOf,
  percentShown,
  type CustomFieldDef,
} from '@liveplanner/items';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideCalculator } from '@liveworkspace/icons/lucide';
import { PercentReading } from './PercentBar';

const CalculatorIcon = lucideGlyph(lucideCalculator, 13);

export function CalculatedFieldValue({
  id,
  field,
  value,
}: {
  id: string;
  field: Pick<CustomFieldDef, 'kind' | 'calculation' | 'label' | 'showAs'>;
  value: number | null;
}) {
  const text = calculatedText(field, value);
  // A share shown as a Percent draws the Percent field's bar (docs/specs/026-plan/item-types.md "Percent").
  const asPercent = percentShown(field, value);
  if (asPercent !== undefined)
    return (
      <div id={id} className="flex min-h-7 items-center gap-2">
        <span className="flex shrink-0 text-slate-400 dark:text-slate-400" aria-hidden>
          <CalculatorIcon />
        </span>
        <PercentReading value={asPercent} />
      </div>
    );
  const share = calculationOf(field) === 'childrenDone' && value !== null ? value : null;
  return (
    <output
      id={id}
      className="flex min-h-7 items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200"
    >
      <span className="flex shrink-0 text-slate-400 dark:text-slate-400" aria-hidden>
        <CalculatorIcon />
      </span>
      {text ? (
        <span className="tabular-nums">{text}</span>
      ) : (
        <span className="text-slate-500 dark:text-slate-400">No linked cards</span>
      )}
      {share !== null ? (
        <span
          aria-hidden
          className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        >
          <span className="block h-full rounded-full bg-brand-500" style={{ width: `${share}%` }} />
        </span>
      ) : null}
    </output>
  );
}
