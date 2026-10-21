// Format rules (docs/specs/029-sheets/conditional-formatting.md, blueprint sheet-rules.md "Engine"): which rule draws
// a cell, and with what. The first rule in list order whose range covers the cell and whose condition it meets wins;
// a colour scale meets every number it covers. Worked out per drawn cell, with what is costly (a scale's numbers, a
// custom formula moved to a cell) kept until the workbook's next recalculation.
import { conditionMatcher } from '../filter';
import { posRangeOf } from '../layout';
import { shiftForCopy } from '../formula/stored';
import { isArray, isError, scalarOf, type Value } from '../formula/values';
import type {
  ConditionOp,
  FormatRule,
  FormatStyle,
  ScalePoint,
  SheetLayout,
  StoredFormula,
} from '../sheet';
import type { Workbook } from '../engine/workbook';
import { ruleIndex, rulesAt } from './rule-index';

// The most custom formulas kept moved to their cells per recalculation, so a long scroll cannot grow it unbounded.
const MOVED_KEEP_MAX = 20_000;

type Cache = {
  version: number;
  scales: Map<string, number[]>;
  moved: Map<string, StoredFormula>;
};
const CACHES = new WeakMap<Workbook, Cache>();

function cacheOf(wb: Workbook): Cache {
  let cache = CACHES.get(wb);
  if (!cache || cache.version !== wb.version) {
    cache = { version: wb.version, scales: new Map(), moved: new Map() };
    CACHES.set(wb, cache);
  }
  return cache;
}

const EMPTY: readonly FormatRule[] = [];

// Each rule's condition, read once per locale.
type Matcher = ReturnType<typeof conditionMatcher>;
const MATCHERS = new WeakMap<FormatRule, { locale: string; fn: Matcher }>();

function matcherOf(rule: FormatRule, locale: string): Matcher {
  const known = MATCHERS.get(rule);
  if (known && known.locale === locale) return known.fn;
  const fn = conditionMatcher({ op: rule.op as never, a: rule.a, b: rule.b }, locale);
  MATCHERS.set(rule, { locale, fn });
  return fn;
}

export function formatRulesAt(layout: SheetLayout, r: number, c: number): FormatRule[] {
  const list = layout.formatRules;
  if (!list?.length) return [];
  return rulesAt(ruleIndex(layout, list ?? EMPTY), r, c);
}

// A scale rule's numbers, sorted, worked out once per recalculation.
function scaleNumbers(wb: Workbook, sheetId: string, rule: FormatRule): number[] {
  const cache = cacheOf(wb);
  const key = `${sheetId}|${rule.id}`;
  const known = cache.scales.get(key);
  if (known) return known;
  const sheet = wb.sheet(sheetId);
  const p = sheet ? posRangeOf(sheet.layout, rule) : null;
  const out: number[] = [];
  if (p)
    for (let r = p.r1; r <= p.r2; r++)
      for (let c = p.c1; c <= p.c2; c++) {
        const v = wb.value(sheetId, r, c);
        if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
      }
  out.sort((a, b) => a - b);
  cache.scales.set(key, out);
  return out;
}

// The p-th percentile (0 to 100) of sorted numbers, interpolated as PERCENTILE does.
export function percentileOf(sorted: readonly number[], p: number): number {
  if (!sorted.length) return 0;
  const at = (Math.max(0, Math.min(100, p)) / 100) * (sorted.length - 1);
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}

function pointValue(point: ScalePoint, sorted: readonly number[]): number {
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  switch (point.at) {
    case 'min':
      return min;
    case 'max':
      return max;
    case 'num':
      return point.v ?? 0;
    case 'pct':
      return min + ((max - min) * (point.v ?? 0)) / 100;
    case 'pctile':
      return percentileOf(sorted, point.v ?? 0);
  }
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// `a` blended toward `b` by `t` (0 to 1), in sRGB.
export function mixColour(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const x = channels(a);
  const y = channels(b);
  const out = x.map((v, i) => Math.round(v + (y[i]! - v) * k));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// A number's colour on a scale.
export function scaleColour(rule: FormatRule, n: number, sorted: readonly number[]): string | null {
  if (!rule.min || !rule.max) return null;
  const lo = pointValue(rule.min, sorted);
  const hi = pointValue(rule.max, sorted);
  const blend = (from: ScalePoint, to: ScalePoint, a: number, b: number) =>
    b === a ? (n <= a ? from.c : to.c) : mixColour(from.c, to.c, (n - a) / (b - a));
  if (n <= lo) return rule.min.c;
  if (n >= hi) return rule.max.c;
  if (!rule.mid) return blend(rule.min, rule.max, lo, hi);
  const mid = pointValue(rule.mid, sorted);
  return n <= mid ? blend(rule.min, rule.mid, lo, mid) : blend(rule.mid, rule.max, mid, hi);
}

function formulaMet(
  wb: Workbook,
  sheetId: string,
  rule: FormatRule,
  r: number,
  c: number,
): boolean {
  const sheet = wb.sheet(sheetId);
  const p = sheet && rule.fx ? posRangeOf(sheet.layout, rule) : null;
  if (!sheet || !p || !rule.fx) return false;
  const cache = cacheOf(wb);
  const dr = r - p.r1;
  const dc = c - p.c1;
  const key = `${sheetId}|${rule.id}|${dr}|${dc}`;
  let moved = cache.moved.get(key);
  if (!moved) {
    moved = dr === 0 && dc === 0 ? rule.fx : shiftForCopy(rule.fx, dr, dc, wb.ctxFor(sheetId));
    if (cache.moved.size >= MOVED_KEEP_MAX) cache.moved.clear();
    cache.moved.set(key, moved);
  }
  const v = wb.evaluateAt(sheetId, r, c, moved);
  return v === true || (typeof v === 'number' && v !== 0);
}

// The style the cell's first met rule draws it with, or null. `shown` is the value as its cell shows it.
export function formatRuleStyle(
  wb: Workbook,
  sheetId: string,
  r: number,
  c: number,
  value: Value,
  shown: string,
  rules?: readonly FormatRule[],
): FormatStyle | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const list = rules ?? formatRulesAt(sheet.layout, r, c);
  if (!list.length) return null;
  const v = isArray(value) ? scalarOf(value) : value;
  for (const rule of list) {
    if (rule.is === 'scale') {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const fill = scaleColour(rule, v, scaleNumbers(wb, sheetId, rule));
      if (fill) return { bg: fill };
      continue;
    }
    if (!rule.style) continue;
    if (rule.op === 'formula') {
      if (formulaMet(wb, sheetId, rule, r, c)) return rule.style;
      continue;
    }
    if (isError(v) || !rule.op) continue;
    if (matcherOf(rule, wb.locale)(v, shown)) return rule.style;
  }
  return null;
}

// The words for each condition, as the rule form and the list name them (conditional-formatting.md "Rules").
export const FORMAT_CONDITION_LABELS: Record<ConditionOp | 'formula', string> = {
  empty: 'Is Empty',
  notEmpty: 'Is Not Empty',
  contains: 'Text Contains',
  notContains: 'Text Does Not Contain',
  startsWith: 'Text Starts With',
  endsWith: 'Text Ends With',
  exactly: 'Text Is Exactly',
  dateBefore: 'Date Is Before',
  dateAfter: 'Date Is After',
  dateOn: 'Date Is',
  gt: 'Greater Than',
  gte: 'Greater Than or Equal To',
  lt: 'Less Than',
  lte: 'Less Than or Equal To',
  between: 'Is Between',
  eq: 'Is Equal To',
  neq: 'Is Not Equal To',
  formula: 'Custom Formula Is',
};

// How many values each condition takes.
export function conditionValues(op: ConditionOp | 'formula'): 0 | 1 | 2 {
  if (op === 'empty' || op === 'notEmpty') return 0;
  return op === 'between' ? 2 : 1;
}

// The rule's line in the list: "Greater Than 100", "Is Between 1 and 5", "Custom Formula Is =$C2>100",
// "Colour Scale". `formulaText` is the custom formula as the person reads it.
export function formatRuleLine(rule: FormatRule, formulaText?: string): string {
  if (rule.is === 'scale') return 'Colour Scale';
  const op = rule.op ?? 'notEmpty';
  const label = FORMAT_CONDITION_LABELS[op];
  if (op === 'formula') return `${label} ${formulaText ?? ''}`.trim();
  const n = conditionValues(op);
  if (n === 0) return label;
  if (n === 2) return `${label} ${rule.a ?? ''} and ${rule.b ?? ''}`;
  return `${label} ${rule.a ?? ''}`.trim();
}
