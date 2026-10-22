// An agent's validation and format rules (docs/specs/029-sheets/data-validation.md "Agents",
// conditional-formatting.md "Agents"): rules named in words and A1 ranges, built by the engine's own rule commands
// (setValidationRule, removeValidation, the frule change), and the rules read back in the same words.
import { withArticle } from '@livedesign/items';
import {
  CONDITION_OPS,
  compileFormula,
  formatRange,
  formatRuleLine,
  isColour,
  makeAxisIds,
  parseRangeText,
  posRangeOf,
  removeValidation,
  renderFormula,
  ruleLine,
  serialFromIso,
  setValidationRule,
  idRangeOf,
  type ConditionOp,
  type FormatRule,
  type FormatStyle,
  type GridRange,
  type Rand,
  type RuleSettings,
  type ScalePoint,
  type SheetLayout,
  type SheetWrite,
  type Workbook,
} from '@livedesign/sheets';
import type { SheetRefusal } from './sheet-state';

export type AgentValidation =
  | {
      type: 'dropdown';
      options: string[];
      // A colour per option (#rrggbb), or null for none.
      colors?: (string | null)[];
      display?: 'chip' | 'arrow' | 'plain';
    }
  | { type: 'dropdown_range'; source: string; display?: 'chip' | 'arrow' | 'plain' }
  | { type: 'checkbox' }
  | {
      type: 'number' | 'date' | 'text';
      condition: string;
      // Numbers; dates as YYYY-MM-DD; text as text.
      value?: number | string;
      value2?: number | string;
    };

export interface AgentFormatStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  background?: string;
}

export interface AgentScalePoint {
  color: string;
  type: 'min' | 'max' | 'number' | 'percent' | 'percentile';
  value?: number;
}

export type SheetRuleChange =
  | { op: 'validate'; range: string; rule: AgentValidation; reject?: boolean; help?: string }
  | { op: 'clear_validation'; range: string }
  | {
      op: 'conditional_format';
      range: string;
      when?: {
        condition: string;
        value?: string | number;
        value2?: string | number;
        formula?: string;
      };
      style?: AgentFormatStyle;
      scale?: { min: AgentScalePoint; mid?: AgentScalePoint; max: AgentScalePoint };
      // First in the list rather than last: the first rule met draws a cell.
      first?: boolean;
    }
  | { op: 'clear_conditional_formats'; range?: string };

type Built = { ok: true; writes: SheetWrite[]; line: string } | SheetRefusal;

const refuse = (code: string, message: string): SheetRefusal => ({ ok: false, code, message });
const snake = (s: string) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

// The words agents use for each op, both ways.
const NUM_OPS: Record<string, string> = {
  between: 'between',
  not_between: 'notBetween',
  greater_than: 'gt',
  greater_than_or_equal: 'gte',
  less_than: 'lt',
  less_than_or_equal: 'lte',
  equal: 'eq',
  not_equal: 'neq',
};
const DATE_OPS: Record<string, string> = {
  valid: 'valid',
  before: 'before',
  on_or_before: 'onOrBefore',
  after: 'after',
  on_or_after: 'onOrAfter',
  on: 'on',
  between: 'between',
  not_between: 'notBetween',
};
const TEXT_OPS: Record<string, string> = {
  contains: 'contains',
  not_contains: 'notContains',
  exactly: 'exactly',
  email: 'email',
  url: 'url',
};
// Format rule conditions: the filter's, in snake case (gt as greater_than, eq as equal), and formula.
const CONDITION_WORDS: Record<string, ConditionOp> = Object.fromEntries(
  CONDITION_OPS.map((op) => [
    {
      gt: 'greater_than',
      gte: 'greater_than_or_equal',
      lt: 'less_than',
      lte: 'less_than_or_equal',
      eq: 'equal',
      neq: 'not_equal',
    }[op as string] ?? snake(op),
    op,
  ]),
);
export const AGENT_CONDITIONS = [...Object.keys(CONDITION_WORDS), 'formula'];
const POINT_TYPES: Record<AgentScalePoint['type'], ScalePoint['at']> = {
  min: 'min',
  max: 'max',
  number: 'num',
  percent: 'pct',
  percentile: 'pctile',
};

const badRange = (text: string) =>
  refuse('range_invalid', `"${text}" is not a cell or range in A1 form ("B4", "A1:D20").`);

function rangeOn(layout: SheetLayout, text: string): GridRange | null {
  const g = parseRangeText(text);
  return g && g.r2 < layout.rows.length && g.c2 < layout.cols.length ? g : null;
}

function dateOf(v: number | string | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return serialFromIso(v);
}

function validationSettings(
  layout: SheetLayout,
  rule: AgentValidation,
  extra: Pick<RuleSettings, 'warn' | 'help'>,
): { ok: true; settings: RuleSettings } | SheetRefusal {
  const show = (d?: string): { show?: 'arrow' | 'plain' } =>
    d === 'arrow' || d === 'plain' ? { show: d } : {};
  switch (rule.type) {
    case 'checkbox':
      return { ok: true, settings: { is: 'check', ...extra } };
    case 'dropdown': {
      const opts = rule.options.map((v, i) => {
        const c = rule.colors?.[i]?.toLowerCase();
        return { v: String(v).trim(), ...(c && isColour(c) ? { c } : {}) };
      });
      if (!opts.length || opts.some((o) => !o.v))
        return refuse('rule_invalid', 'A dropdown needs one or more options, none empty.');
      return { ok: true, settings: { is: 'list', opts, ...show(rule.display), ...extra } };
    }
    case 'dropdown_range': {
      const g = rangeOn(layout, rule.source);
      const src = g ? idRangeOf(layout, g.r1, g.c1, g.r2, g.c2) : null;
      if (!src) return badRange(rule.source);
      return { ok: true, settings: { is: 'range', src, ...show(rule.display), ...extra } };
    }
    case 'number':
    case 'date':
    case 'text': {
      const words = rule.type === 'number' ? NUM_OPS : rule.type === 'date' ? DATE_OPS : TEXT_OPS;
      const op = words[rule.condition];
      if (!op)
        return refuse(
          'rule_invalid',
          `"${rule.condition}" is not ${withArticle(rule.type)} condition: ${Object.keys(words).join(', ')}.`,
        );
      const is = rule.type === 'number' ? 'num' : rule.type;
      if (op === 'valid' || op === 'email' || op === 'url')
        return { ok: true, settings: { is, op: op, ...extra } };
      if (is === 'text') {
        const a = String(rule.value ?? '').trim();
        if (!a) return refuse('rule_invalid', 'Give the text as value.');
        return { ok: true, settings: { is, op: op as never, a, ...extra } };
      }
      const read = (v: number | string | undefined) =>
        is === 'date' ? dateOf(v) : typeof v === 'number' && Number.isFinite(v) ? v : null;
      const a = read(rule.value);
      const two = op === 'between' || op === 'notBetween';
      const b = two ? read(rule.value2) : undefined;
      if (a === null || b === null)
        return refuse(
          'rule_invalid',
          is === 'date'
            ? `Give ${two ? 'value and value2' : 'value'} as dates, YYYY-MM-DD.`
            : `Give ${two ? 'value and value2' : 'value'} as numbers.`,
        );
      return { ok: true, settings: { is, op: op as never, a, ...(two ? { b } : {}), ...extra } };
    }
    default:
      return refuse(
        'rule_invalid',
        'A rule type is dropdown, dropdown_range, checkbox, number, date or text.',
      );
  }
}

function styleOf(s: AgentFormatStyle | undefined): FormatStyle | SheetRefusal {
  const out: FormatStyle = {};
  if (s?.bold) out.b = true;
  if (s?.italic) out.i = true;
  if (s?.underline) out.u = true;
  if (s?.strikethrough) out.st = true;
  for (const [k, v] of [
    ['fc', s?.color],
    ['bg', s?.background],
  ] as const) {
    if (v === undefined) continue;
    if (!isColour(v.toLowerCase())) return refuse('format_invalid', 'Colours are #rrggbb.');
    out[k] = v.toLowerCase();
  }
  if (!Object.keys(out).length)
    return refuse(
      'format_invalid',
      'Give a style: bold, italic, underline, strikethrough, color or background.',
    );
  return out;
}

function pointOf(p: AgentScalePoint | undefined, end: string): ScalePoint | string {
  if (!p) return `Give the scale's ${end}.`;
  const at = POINT_TYPES[p.type];
  if (!at) return `A point's type is min, max, number, percent or percentile.`;
  if (!isColour(p.color?.toLowerCase())) return 'Colours are #rrggbb.';
  if (at === 'min' || at === 'max') return { c: p.color.toLowerCase(), at };
  if (typeof p.value !== 'number' || !Number.isFinite(p.value))
    return `Give the ${end}'s value as a number.`;
  return { c: p.color.toLowerCase(), at, v: p.value };
}

export function buildRuleChange(
  wb: Workbook,
  sheetId: string,
  change: SheetRuleChange,
  rand: Rand = Math.random,
): Built {
  const sheet = wb.sheet(sheetId)!;
  const layout = sheet.layout;
  switch (change.op) {
    case 'validate': {
      const g = rangeOn(layout, change.range);
      if (!g) return badRange(change.range);
      const made = validationSettings(layout, change.rule, {
        ...(change.reject === false ? { warn: true as const } : {}),
        ...(change.help?.trim() ? { help: change.help.trim().slice(0, 255) } : {}),
      });
      if (!made.ok) return made;
      // The range is on the sheet (rangeOn), so the rule can be made.
      const set = setValidationRule(layout, g, made.settings, rand)!;
      return {
        ok: true,
        writes: [set.write],
        line: `made ${formatRange(g)} ${withArticle(change.rule.type)} rule`,
      };
    }
    case 'clear_validation': {
      const g = rangeOn(layout, change.range);
      if (!g) return badRange(change.range);
      const w = removeValidation(layout, [g], rand);
      return {
        ok: true,
        writes: w ? [w] : [],
        line: `cleared the validation of ${formatRange(g)}`,
      };
    }
    case 'conditional_format': {
      const g = rangeOn(layout, change.range);
      const ids = g ? idRangeOf(layout, g.r1, g.c1, g.r2, g.c2) : null;
      if (!g || !ids) return badRange(change.range);
      const [id] = makeAxisIds(1, rand, new Set((layout.formatRules ?? []).map((x) => x.id)));
      let rule: FormatRule;
      if (change.scale) {
        const min = pointOf(change.scale.min, 'min');
        const mid = change.scale.mid ? pointOf(change.scale.mid, 'mid') : undefined;
        const max = pointOf(change.scale.max, 'max');
        for (const x of [min, mid, max])
          if (typeof x === 'string') return refuse('rule_invalid', x);
        rule = {
          id: id!,
          ...ids,
          is: 'scale',
          min: min as ScalePoint,
          ...(mid ? { mid: mid as ScalePoint } : {}),
          max: max as ScalePoint,
        };
      } else {
        const when = change.when;
        if (!when)
          return refuse('rule_invalid', 'Give when (a condition and its values) or scale.');
        const style = styleOf(change.style);
        if ('ok' in style) return style;
        if (when.condition === 'formula') {
          const text = String(when.formula ?? '').trim();
          const made = compileFormula(text.startsWith('=') ? text : `=${text}`, wb.ctxFor(sheetId));
          if (!text || !made.ok)
            return refuse(
              'formula_invalid',
              `The formula "${text}" cannot be read (write it for ${formatRange({ ...g, r2: g.r1, c2: g.c1 })}).`,
            );
          rule = { id: id!, ...ids, is: 'when', op: 'formula', fx: made.formula, style };
        } else {
          const op = CONDITION_WORDS[when.condition];
          if (!op)
            return refuse(
              'rule_invalid',
              `"${when.condition}" is not a condition: ${AGENT_CONDITIONS.join(', ')}.`,
            );
          rule = {
            id: id!,
            ...ids,
            is: 'when',
            op,
            ...(when.value !== undefined ? { a: String(when.value) } : {}),
            ...(when.value2 !== undefined ? { b: String(when.value2) } : {}),
            style,
          };
        }
      }
      return {
        ok: true,
        writes: [
          {
            kind: 'layout',
            changes: [{ k: 'frule', id: rule.id, rule, ...(change.first ? { at: 0 } : {}) }],
          },
        ],
        line: `added a format rule to ${formatRange(g)}${change.first ? ', first in the list' : ''}`,
      };
    }
    case 'clear_conditional_formats': {
      const g = change.range ? rangeOn(layout, change.range) : null;
      if (change.range && !g) return badRange(change.range);
      const gone = (layout.formatRules ?? []).filter((x) => {
        if (!g) return true;
        const p = posRangeOf(layout, x);
        return p && p.r1 <= g.r2 && g.r1 <= p.r2 && p.c1 <= g.c2 && g.c1 <= p.c2;
      });
      return {
        ok: true,
        writes: gone.length
          ? [
              {
                kind: 'layout',
                changes: gone.map((x) => ({ k: 'frule' as const, id: x.id, rule: null })),
              },
            ]
          : [],
        line: `cleared ${gone.length} format rule${gone.length === 1 ? '' : 's'}`,
      };
    }
  }
}

// A sheet's rules for a reader, in words.
export function rulesRead(wb: Workbook, sheetId: string) {
  const sheet = wb.sheet(sheetId)!;
  const layout = sheet.layout;
  // A stored rule's corners are on the sheet (a deletion that takes them drops the rule).
  const a1 = (r: Parameters<typeof posRangeOf>[1]) => formatRange(posRangeOf(layout, r)!);
  // Every stored op is one of the words' (rule-shape.ts checks it on write).
  const back = (words: Record<string, string>, op: string) =>
    Object.entries(words).find(([, v]) => v === op)![0];
  const validation = (layout.rules ?? []).map((r) => ({
    range: a1(r),
    type: {
      list: 'dropdown',
      range: 'dropdown_range',
      check: 'checkbox',
      num: 'number',
      date: 'date',
      text: 'text',
    }[r.is],
    ...(r.opts ? { options: r.opts.map((o) => o.v) } : {}),
    ...(r.src ? { source: a1(r.src) } : {}),
    ...(r.op
      ? { condition: back(r.is === 'num' ? NUM_OPS : r.is === 'date' ? DATE_OPS : TEXT_OPS, r.op) }
      : {}),
    allows: ruleLine(r, { locale: 'en-GB', layout }),
    reject: !r.warn,
    ...(r.help ? { help: r.help } : {}),
  }));
  const conditionalFormats = (layout.formatRules ?? []).map((r) => ({
    range: a1(r),
    rule: formatRuleLine(r, r.fx ? renderFormula(r.fx, wb.ctxFor(sheetId)) : undefined),
    ...(r.style ? { style: r.style } : {}),
    ...(r.is === 'scale'
      ? { scale: { min: r.min, ...(r.mid ? { mid: r.mid } : {}), max: r.max } }
      : {}),
  }));
  return { validation, conditionalFormats };
}
