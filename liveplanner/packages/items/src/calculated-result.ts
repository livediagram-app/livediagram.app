// How a Calculated field's value reads, sorts, filters and exports (docs/specs/026-plan/item-types.md "Calculated
// fields"): its result kind. A Formula, a Rollup and a Lookup keep theirs as `result` (Number when absent); Child Count
// gives a Number and Children Done a Percent. Every reader of a worked-out value takes its kind from here. Pure.
import type { CustomFieldDef } from './item-types';
import { FORMULA_RESULT_DEFAULT, isFormulaResult, type FormulaResult } from './formula/limits';

type ResultDef = Pick<CustomFieldDef, 'kind' | 'calculation'> &
  Partial<Pick<CustomFieldDef, 'result'>>;

// The calculations that keep a `result`: they read, sort, filter and export as it (docs/specs/026-plan/item-types.md
// "Formula fields", "Rollup and Lookup fields").
const WITH_RESULT = new Set<string>(['formula', 'rollup', 'lookup']);

export const hasResult = (f: Pick<CustomFieldDef, 'kind' | 'calculation'>): boolean =>
  f.kind === 'calculated' && f.calculation !== undefined && WITH_RESULT.has(f.calculation);

export const isRollupField = (f: Pick<CustomFieldDef, 'kind' | 'calculation'>): boolean =>
  f.kind === 'calculated' && f.calculation === 'rollup';

export const isLookupField = (f: Pick<CustomFieldDef, 'kind' | 'calculation'>): boolean =>
  f.kind === 'calculated' && f.calculation === 'lookup';

// A Calculated field's result kind; undefined for a field that is no Calculated field.
export function calculatedResultOf(f: ResultDef): FormulaResult | undefined {
  if (f.kind !== 'calculated') return undefined;
  if (f.calculation === 'childCount') return 'number';
  if (f.calculation === 'childrenDone') return 'percent';
  if (!hasResult(f)) return undefined;
  return isFormulaResult(f.result) ? f.result : FORMULA_RESULT_DEFAULT;
}
