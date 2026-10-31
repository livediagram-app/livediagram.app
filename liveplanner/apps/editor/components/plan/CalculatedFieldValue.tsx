'use client';

// A Calculated field in the card panel (docs/specs/026-plan/item-types.md "Calculated fields"): its worked-out value,
// read-only, never an input. Children Done (and a Formula whose result is a Percent) adds a thin bar of the share; a
// card without children reads "No linked cards", a Formula with nothing to work out "No value", and a Formula that
// can't be worked out says why in place of the value ("Formula fields").
import {
  calculatedText,
  calculationOf,
  formulaResultOf,
  isFormulaField,
  type CustomFieldDef,
  type FormulaOutcome,
} from '@liveplanner/items';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideCalculator, lucideTriangleAlert } from '@liveworkspace/icons/lucide';

const CalculatorIcon = lucideGlyph(lucideCalculator, 13);
const AlertIcon = lucideGlyph(lucideTriangleAlert, 13);

type ValueField = Pick<CustomFieldDef, 'kind' | 'calculation' | 'label' | 'result' | 'currency'>;

// The share a value draws as a bar, held to 0..100; null when the field shows no share.
function shareOf(field: ValueField, value: unknown): number | null {
  if (typeof value !== 'number') return null;
  const share =
    calculationOf(field) === 'childrenDone' ||
    (isFormulaField(field) && formulaResultOf(field) === 'percent');
  return share ? Math.max(0, Math.min(100, value)) : null;
}

export function CalculatedFieldValue({
  id,
  field,
  outcome,
}: {
  id: string;
  field: ValueField;
  outcome: FormulaOutcome;
}) {
  if (!outcome.ok)
    return (
      <output
        id={id}
        className="flex min-h-7 items-start gap-2 py-1 text-[13px] leading-snug text-red-700 dark:text-red-300"
      >
        <span className="mt-0.5 flex shrink-0" aria-hidden>
          <AlertIcon />
        </span>
        <span className="min-w-0 break-words">{outcome.error}</span>
      </output>
    );
  const text = calculatedText(field, outcome.value);
  const share = shareOf(field, outcome.value);
  return (
    <output
      id={id}
      className="flex min-h-7 items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200"
    >
      <span className="flex shrink-0 text-slate-400 dark:text-slate-400" aria-hidden>
        <CalculatorIcon />
      </span>
      {text ? (
        <span className="min-w-0 break-words tabular-nums">{text}</span>
      ) : (
        <span className="text-slate-500 dark:text-slate-400">
          {isFormulaField(field) ? 'No value' : 'No linked cards'}
        </span>
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
