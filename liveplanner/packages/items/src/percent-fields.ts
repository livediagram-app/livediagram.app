// Percent fields (docs/specs/026-plan/item-types.md "Percent"): how far along something is, a whole number from 0 to
// 100, drawn as a bar. A field shows as a Percent when it is one (`kind: 'percent'`) or when a worked-out field that
// gives a share says so (`showAs: 'percent'`, today a Calculated field's Children Done; Formula and Rollup join
// PERCENT_SHOWABLE_KINDS). Every surface (the card face, the panel, exports, agents, CSV) reads through these, so
// they agree on which fields draw a bar and what share it shows. Pure.
import { clampPercent } from '@liveworkspace/model-core/progress-label';
import type { ItemFieldValue } from './item';
import type { CustomFieldDef, CustomFieldKind } from './item-types';

export const PERCENT_MIN = 0;
export const PERCENT_MAX = 100;

// The worked-out kinds whose result may be drawn as a Percent (a share the plan works out, never typed).
export const PERCENT_SHOWABLE_KINDS: readonly CustomFieldKind[] = ['calculated'];

type PercentDef = Pick<CustomFieldDef, 'kind' | 'calculation' | 'showAs'>;

// A number from a value: a finite number, or numeric text with an optional trailing "%" ("40", " 40 % ").
function numberOf(v: ItemFieldValue | undefined): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  // Sliced, not a regex: `/\s*%$/` backtracks over a long run of spaces (polynomial time on hostile text).
  const s = v.trim();
  const t = s.endsWith('%') ? s.slice(0, -1).trimEnd() : s;
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

// The share a reader draws: rounded and held to 0..100 (a stray 140 written straight to the api draws 100), or
// undefined for no value or one that is no number.
export function percentValue(v: ItemFieldValue | undefined): number | undefined {
  const n = numberOf(v);
  return n === undefined ? undefined : clampPercent(n);
}

// The share a writer keeps (agents, the card table, Import CSV): rounded, or undefined when it is no number or lies
// outside 0..100, so the write is refused (or the cell skipped) rather than quietly changed.
export function parsePercent(v: ItemFieldValue | undefined): number | undefined {
  const n = numberOf(v);
  if (n === undefined || n < PERCENT_MIN || n > PERCENT_MAX) return undefined;
  return Math.round(n);
}

// A share as text: "40%".
export const percentText = (n: number): string => `${n}%`;

// Whether a field's result is a share it may draw as a Percent: a showable kind whose calculation gives a share.
export function canShowAsPercent(field: PercentDef): boolean {
  if (!PERCENT_SHOWABLE_KINDS.includes(field.kind)) return false;
  return field.calculation === 'childrenDone';
}

// Whether a field draws as a Percent: a Percent field, or a share whose field says to show it as one.
export function showsAsPercent(field: PercentDef): boolean {
  if (field.kind === 'percent') return true;
  return field.showAs === 'percent' && canShowAsPercent(field);
}

// The share a field shows, from its stored value (a Percent) or its worked-out one (a share shown as a Percent), or
// undefined when the field does not show as a Percent or has no value.
export function percentShown(
  field: PercentDef,
  value: ItemFieldValue | undefined,
): number | undefined {
  return showsAsPercent(field) ? percentValue(value) : undefined;
}
