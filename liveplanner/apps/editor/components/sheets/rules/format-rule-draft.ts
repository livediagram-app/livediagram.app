// A Conditional Formatting rule as its form holds it (docs/specs/029-sheets/conditional-formatting.md "Rules"): the
// draft, the presets the form offers, and the draft made into a rule, or why it cannot be one. Pure; the popover is
// SheetFormatRules.tsx.
import {
  compileFormula,
  conditionValues,
  formatRange,
  parseRangeText,
  posRangeOf,
  renderFormula,
  type ConditionOp,
  type FormatRule,
  type FormatStyle,
  type GridRange,
  type ScalePoint,
} from '@liveplanner/sheets';
import type { SheetController } from '../sheet-controller';
import type { SheetActions } from '../useSheetActions';

// conditional-formatting.md "Rules": a new rule's style, the preset styles and the preset scales.
export const NEW_RULE_STYLE: FormatStyle = { bg: '#b7e1cd', fc: '#137333' };
export const PRESET_STYLES: { label: string; style: FormatStyle }[] = [
  { label: 'Green Fill', style: { bg: '#b7e1cd', fc: '#137333' } },
  { label: 'Red Fill', style: { bg: '#f4c7c3', fc: '#a50e0e' } },
  { label: 'Yellow Fill', style: { bg: '#fce8b2', fc: '#7a5c00' } },
  { label: 'Blue Fill', style: { bg: '#c6dafc', fc: '#174ea6' } },
  { label: 'Bold Text', style: { b: true } },
  { label: 'Struck Through Text', style: { st: true, fc: '#80868b' } },
];
export const SCALE_ENDS = {
  white: '#ffffff',
  green: '#57bb8a',
  red: '#e67c73',
  yellow: '#ffd666',
  blue: '#4285f4',
};
export const PRESET_SCALES: { label: string; min: string; mid?: string; max: string }[] = [
  { label: 'White to Green', min: SCALE_ENDS.white, max: SCALE_ENDS.green },
  { label: 'Green to White', min: SCALE_ENDS.green, max: SCALE_ENDS.white },
  { label: 'White to Red', min: SCALE_ENDS.white, max: SCALE_ENDS.red },
  { label: 'Red to White', min: SCALE_ENDS.red, max: SCALE_ENDS.white },
  {
    label: 'Green, Yellow, Red',
    min: SCALE_ENDS.green,
    mid: SCALE_ENDS.yellow,
    max: SCALE_ENDS.red,
  },
  {
    label: 'Red, Yellow, Green',
    min: SCALE_ENDS.red,
    mid: SCALE_ENDS.yellow,
    max: SCALE_ENDS.green,
  },
  { label: 'White to Blue', min: SCALE_ENDS.white, max: SCALE_ENDS.blue },
];
export const POINT_KINDS: { id: ScalePoint['at']; label: string }[] = [
  { id: 'min', label: 'Min Value' },
  { id: 'max', label: 'Max Value' },
  { id: 'num', label: 'Number' },
  { id: 'pct', label: 'Percent' },
  { id: 'pctile', label: 'Percentile' },
];

export type Point = { c: string; at: ScalePoint['at']; v: string };
export type Draft = {
  id: string;
  range: string;
  is: 'when' | 'scale';
  op: ConditionOp | 'formula';
  a: string;
  b: string;
  fx: string;
  style: FormatStyle;
  min: Point;
  mid: Point | null;
  max: Point;
};

function pointDraft(p: ScalePoint | undefined, fallback: Point): Point {
  return p ? { c: p.c, at: p.at, v: p.v === undefined ? '' : String(p.v) } : fallback;
}

export function draftOf(c: SheetController, rule: FormatRule | null, id: string): Draft {
  const sel = c.selection.ranges[c.selection.ranges.length - 1]!;
  const p = rule ? posRangeOf(c.sheet.layout, rule) : null;
  return {
    id,
    range: formatRange(p ?? sel),
    is: rule?.is ?? 'when',
    op: rule?.op ?? 'notEmpty',
    a: rule?.a ?? '',
    b: rule?.b ?? '',
    fx: rule?.fx ? renderFormula(rule.fx, c.workbook.ctxFor(c.sheet.id)) : '=',
    style: rule?.style ?? NEW_RULE_STYLE,
    min: pointDraft(rule?.min, { c: SCALE_ENDS.white, at: 'min', v: '' }),
    mid: rule?.mid ? pointDraft(rule.mid, { c: '#ffd666', at: 'pctile', v: '50' }) : null,
    max: pointDraft(rule?.max, { c: SCALE_ENDS.green, at: 'max', v: '' }),
  };
}

// The draft as a rule, or why it cannot be one.
export function ruleOf(
  c: SheetController,
  d: Draft,
  actions: SheetActions,
): { ok: true; rule: FormatRule } | { ok: false; why: string } {
  const g = parseRangeText(d.range);
  const ids = g ? actions.rangeIds(g) : null;
  if (!g || !ids || g.r2 >= c.sheet.layout.rows.length || g.c2 >= c.sheet.layout.cols.length)
    return { ok: false, why: 'Type a range like B2:B20' };
  if (d.is === 'scale') {
    const point = (p: Point, name: string): ScalePoint | string => {
      if (p.at === 'min' || p.at === 'max') return { c: p.c, at: p.at };
      const v = Number(p.v);
      if (p.v.trim() === '' || !Number.isFinite(v)) return `Enter the ${name}'s value`;
      if ((p.at === 'pct' || p.at === 'pctile') && (v < 0 || v > 100))
        return `The ${name}'s percent is 0 to 100`;
      return { c: p.c, at: p.at, v };
    };
    const min = point(d.min, 'Minpoint');
    const mid = d.mid ? point(d.mid, 'Midpoint') : undefined;
    const max = point(d.max, 'Maxpoint');
    for (const x of [min, mid, max]) if (typeof x === 'string') return { ok: false, why: x };
    return {
      ok: true,
      rule: {
        id: d.id,
        ...ids,
        is: 'scale',
        min: min as ScalePoint,
        ...(mid ? { mid: mid as ScalePoint } : {}),
        max: max as ScalePoint,
      },
    };
  }
  if (!Object.keys(d.style).length) return { ok: false, why: 'Choose a style' };
  if (d.op === 'formula') {
    // Written for the range's top-left cell, as the person reads it there.
    const made = compileFormula(
      d.fx.startsWith('=') ? d.fx : `=${d.fx}`,
      c.workbook.ctxFor(c.sheet.id),
    );
    if (!made.ok || d.fx.trim() === '=' || !d.fx.trim())
      return { ok: false, why: "That formula can't be read" };
    return {
      ok: true,
      rule: { id: d.id, ...ids, is: 'when', op: 'formula', fx: made.formula, style: d.style },
    };
  }
  const n = conditionValues(d.op);
  if (n >= 1 && !d.a.trim()) return { ok: false, why: 'Enter a value' };
  if (n === 2 && !d.b.trim()) return { ok: false, why: 'Enter both values' };
  return {
    ok: true,
    rule: {
      id: d.id,
      ...ids,
      is: 'when',
      op: d.op,
      ...(n >= 1 ? { a: d.a.trim() } : {}),
      ...(n === 2 ? { b: d.b.trim() } : {}),
      style: d.style,
    },
  };
}

export function touches(a: GridRange, b: GridRange): boolean {
  return a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;
}
