'use client';

// The Conditional Formatting popover (docs/specs/029-sheets/conditional-formatting.md "Making and changing rules"):
// the rule list (the rules touching the selection, or every rule), each with its swatch, line and range, Move Up,
// Move Down and Delete Rule; Add Another Rule; and the rule form, whose rule draws on the grid for this person while
// it is open (a preview, never sent).
import { useEffect, useMemo, useState } from 'react';
import { Button, Select, TextInput, Tooltip } from '@livediagram/ui';
import {
  CONDITION_OPS,
  FORMAT_CONDITION_LABELS,
  compileFormula,
  conditionValues,
  formatRange,
  formatRuleLine,
  parseRangeText,
  posRangeOf,
  renderFormula,
  type ConditionOp,
  type FormatRule,
  type FormatStyle,
  type GridRange,
  type ScalePoint,
} from '@livediagram/sheets';
import { OptionRows } from '@/components/plan/OptionRows';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { noColour } from '@/components/colour/colour-options';
import { useSheetController, type SheetController } from '../sheet-controller';
import type { SheetActions } from '../useSheetActions';

const WIDTH_PX = 384;
const NO_RULES: readonly FormatRule[] = [];

// conditional-formatting.md "Rules": a new rule's style, the preset styles and the preset scales.
const NEW_RULE_STYLE: FormatStyle = { bg: '#b7e1cd', fc: '#137333' };
const PRESET_STYLES: { label: string; style: FormatStyle }[] = [
  { label: 'Green Fill', style: { bg: '#b7e1cd', fc: '#137333' } },
  { label: 'Red Fill', style: { bg: '#f4c7c3', fc: '#a50e0e' } },
  { label: 'Yellow Fill', style: { bg: '#fce8b2', fc: '#7a5c00' } },
  { label: 'Blue Fill', style: { bg: '#c6dafc', fc: '#174ea6' } },
  { label: 'Bold Text', style: { b: true } },
  { label: 'Struck Through Text', style: { st: true, fc: '#80868b' } },
];
const SCALE_ENDS = {
  white: '#ffffff',
  green: '#57bb8a',
  red: '#e67c73',
  yellow: '#ffd666',
  blue: '#4285f4',
};
const PRESET_SCALES: { label: string; min: string; mid?: string; max: string }[] = [
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
const POINT_KINDS: { id: ScalePoint['at']; label: string }[] = [
  { id: 'min', label: 'Min Value' },
  { id: 'max', label: 'Max Value' },
  { id: 'num', label: 'Number' },
  { id: 'pct', label: 'Percent' },
  { id: 'pctile', label: 'Percentile' },
];
const CONDITIONS = [...CONDITION_OPS, 'formula' as const];

type Point = { c: string; at: ScalePoint['at']; v: string };
type Draft = {
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

const label =
  'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

function pointDraft(p: ScalePoint | undefined, fallback: Point): Point {
  return p ? { c: p.c, at: p.at, v: p.v === undefined ? '' : String(p.v) } : fallback;
}

function draftOf(c: SheetController, rule: FormatRule | null, id: string): Draft {
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
function ruleOf(
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

// A small "123" drawn in a rule's style, or its scale's gradient.
function Swatch({ rule }: { rule: Pick<FormatRule, 'is' | 'style' | 'min' | 'mid' | 'max'> }) {
  if (rule.is === 'scale')
    return (
      <span
        aria-hidden
        className="inline-block h-5 w-9 shrink-0 rounded border border-black/10"
        style={{
          background: `linear-gradient(90deg, ${[rule.min?.c, rule.mid?.c, rule.max?.c].filter(Boolean).join(', ')})`,
        }}
      />
    );
  const s = rule.style ?? {};
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-9 shrink-0 items-center justify-center rounded border border-black/10 text-[11px]"
      style={{
        backgroundColor: s.bg ?? '#ffffff',
        color: s.fc ?? '#1f2937',
        fontWeight: s.b ? 700 : 400,
        fontStyle: s.i ? 'italic' : undefined,
        textDecoration:
          [s.u ? 'underline' : '', s.st ? 'line-through' : ''].filter(Boolean).join(' ') ||
          undefined,
      }}
    >
      123
    </span>
  );
}

function touches(a: GridRange, b: GridRange): boolean {
  return a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;
}

export function SheetFormatRules({
  actions,
  anchor,
  ruleId,
  all: allAtFirst = false,
  onClose,
}: {
  actions: SheetActions;
  anchor: HTMLElement;
  ruleId?: string;
  all?: boolean;
  onClose: () => void;
}) {
  const c = useSheetController();
  const rules = c.sheet.layout.formatRules ?? NO_RULES;
  const [all, setAll] = useState(allAtFirst);
  const opening = ruleId ? (rules.find((x) => x.id === ruleId) ?? null) : null;
  const [d, setD] = useState<Draft | null>(() =>
    opening ? draftOf(c, opening, opening.id) : null,
  );
  const [why, setWhy] = useState<string | null>(null);
  const sel = c.selection.ranges[c.selection.ranges.length - 1]!;
  const shown = useMemo(
    () =>
      all
        ? rules
        : rules.filter((x) => {
            const p = posRangeOf(c.sheet.layout, x);
            return p && touches(p, sel);
          }),
    [all, rules, c.sheet.layout, sel],
  );
  const { setFormatPreview } = c.rules;
  // The rule as it stands draws on the grid for this person alone while the form is open.
  useEffect(() => {
    if (!d) return setFormatPreview(null);
    const made = ruleOf(c, d, actions);
    setFormatPreview(made.ok ? made.rule : null);
  }, [d]); // oxlint-disable-line react/exhaustive-deps
  useEffect(() => () => setFormatPreview(null), [setFormatPreview]);
  const set = (patch: Partial<Draft>) => {
    setWhy(null);
    setD((x) => (x ? { ...x, ...patch } : x));
  };
  const toggle = (k: 'b' | 'i' | 'u' | 'st') =>
    d && set({ style: { ...d.style, [k]: d.style[k] ? undefined : true } });
  const colour = (k: 'fc' | 'bg', id: string) =>
    d && set({ style: { ...d.style, [k]: id === 'none' ? undefined : id.toLowerCase() } });
  const clean = (s: FormatStyle): FormatStyle =>
    Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined));
  const done = () => {
    if (!d) return;
    const made = ruleOf(c, { ...d, style: clean(d.style) }, actions);
    if (!made.ok) return setWhy(made.why);
    if (actions.setFormatRule(made.rule)) {
      setD(null);
      if (ruleId) onClose();
    }
  };
  const pointRow = (name: string, key: 'min' | 'mid' | 'max') => {
    if (!d) return null;
    const p = d[key];
    if (!p) return null;
    const kinds = POINT_KINDS.filter((k) =>
      key === 'min'
        ? k.id !== 'max'
        : key === 'max'
          ? k.id !== 'min'
          : k.id !== 'min' && k.id !== 'max',
    );
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-16 shrink-0 text-[12px]">{name}</span>
        <Select
          aria-label={`${name} Type`}
          value={p.at}
          onChange={(e) => set({ [key]: { ...p, at: e.target.value as ScalePoint['at'] } })}
        >
          {kinds.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </Select>
        {p.at === 'min' || p.at === 'max' ? null : (
          <TextInput
            aria-label={`${name} Value`}
            className="w-16"
            value={p.v}
            onChange={(e) => set({ [key]: { ...p, v: e.target.value } })}
          />
        )}
        <ColourSwatchButton
          label={`${name} Colour`}
          swatch={p.c}
          value={p.c}
          onPick={(id) => set({ [key]: { ...p, c: id.toLowerCase() } })}
        />
      </div>
    );
  };
  return (
    <AnchoredPopover
      anchor={anchor}
      name="Conditional Formatting"
      width={WIDTH_PX}
      onClose={onClose}
    >
      <div
        className="flex max-h-[34rem] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-[13px] text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">Conditional Formatting</h2>
        {!d ? (
          <>
            <label className="flex cursor-pointer items-center gap-2 text-[12px]">
              <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
              Show All Rules
            </label>
            {shown.length ? (
              <ul className="flex flex-col gap-1" aria-label="Format rules">
                {shown.map((rule) => {
                  const at = rules.indexOf(rule);
                  const p = posRangeOf(c.sheet.layout, rule);
                  const line = formatRuleLine(
                    rule,
                    rule.fx ? renderFormula(rule.fx, c.workbook.ctxFor(c.sheet.id)) : undefined,
                  );
                  return (
                    <li
                      key={rule.id}
                      className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                        onClick={() => setD(draftOf(c, rule, rule.id))}
                      >
                        <Swatch rule={rule} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{line}</span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                            {p ? formatRange(p) : ''}
                          </span>
                        </span>
                      </button>
                      <Tooltip label="Move Up">
                        <button
                          type="button"
                          aria-label="Move Up"
                          disabled={at <= 0}
                          className="cursor-pointer rounded px-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 disabled:cursor-default disabled:opacity-30 dark:hover:bg-slate-800"
                          onClick={() => actions.moveFormatRule(rule.id, -1)}
                        >
                          ↑
                        </button>
                      </Tooltip>
                      <Tooltip label="Move Down">
                        <button
                          type="button"
                          aria-label="Move Down"
                          disabled={at >= rules.length - 1}
                          className="cursor-pointer rounded px-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 disabled:cursor-default disabled:opacity-30 dark:hover:bg-slate-800"
                          onClick={() => actions.moveFormatRule(rule.id, 1)}
                        >
                          ↓
                        </button>
                      </Tooltip>
                      <Tooltip label="Delete Rule">
                        <button
                          type="button"
                          aria-label="Delete Rule"
                          className="cursor-pointer rounded px-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                          onClick={() => actions.removeFormatRule(rule.id)}
                        >
                          ✕
                        </button>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                {all ? 'No format rules yet.' : 'No format rules on these cells yet.'}
              </p>
            )}
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setD(draftOf(c, null, actions.newFormatRuleId()))}
              >
                Add Another Rule
              </Button>
              <Button size="xs" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className={label}>Apply to Range</span>
              <TextInput value={d.range} onChange={(e) => set({ range: e.target.value })} />
            </label>
            <OptionRows
              kind="single"
              label="Rule Kind"
              selected={d.is}
              rows={[
                { id: 'when', label: 'Single Colour' },
                { id: 'scale', label: 'Colour Scale' },
              ]}
              onPick={(id) => set({ is: id as Draft['is'] })}
            />
            {d.is === 'when' ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className={label}>Format Cells If…</span>
                  <Select
                    aria-label="Condition"
                    value={d.op}
                    onChange={(e) => set({ op: e.target.value as Draft['op'] })}
                  >
                    {CONDITIONS.map((op) => (
                      <option key={op} value={op}>
                        {FORMAT_CONDITION_LABELS[op]}
                      </option>
                    ))}
                  </Select>
                  {d.op === 'formula' ? (
                    <TextInput
                      aria-label="Custom Formula"
                      spellCheck={false}
                      placeholder="=$C2>100"
                      value={d.fx}
                      onChange={(e) => set({ fx: e.target.value })}
                    />
                  ) : null}
                  {d.op !== 'formula' && conditionValues(d.op) >= 1 ? (
                    <TextInput
                      aria-label="Value"
                      value={d.a}
                      onChange={(e) => set({ a: e.target.value })}
                    />
                  ) : null}
                  {d.op !== 'formula' && conditionValues(d.op) === 2 ? (
                    <TextInput
                      aria-label="And"
                      value={d.b}
                      onChange={(e) => set({ b: e.target.value })}
                    />
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={label}>Formatting Style</span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preset Styles">
                    {PRESET_STYLES.map((p) => (
                      <Tooltip key={p.label} label={p.label}>
                        <button
                          type="button"
                          aria-label={p.label}
                          className="cursor-pointer rounded"
                          onClick={() => set({ style: p.style })}
                        >
                          <Swatch rule={{ is: 'when', style: p.style }} />
                        </button>
                      </Tooltip>
                    ))}
                  </div>
                  <div className="flex items-center gap-1" role="group" aria-label="Style">
                    {(
                      [
                        ['b', 'Bold', 'B', 'font-bold'],
                        ['i', 'Italic', 'I', 'italic'],
                        ['u', 'Underline', 'U', 'underline'],
                        ['st', 'Strikethrough', 'S', 'line-through'],
                      ] as const
                    ).map(([k, name, glyph, cls]) => (
                      <Tooltip key={k} label={name}>
                        <button
                          type="button"
                          aria-label={name}
                          aria-pressed={!!d.style[k]}
                          className={`h-6 w-6 cursor-pointer rounded text-[12px] ${cls} ${d.style[k] ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                          onClick={() => toggle(k)}
                        >
                          {glyph}
                        </button>
                      </Tooltip>
                    ))}
                    <ColourSwatchButton
                      label="Text Colour"
                      swatch={d.style.fc ?? 'transparent'}
                      none={!d.style.fc}
                      value={d.style.fc ?? 'none'}
                      leading={[noColour('none', 'Automatic')]}
                      onPick={(id) => colour('fc', id)}
                    />
                    <ColourSwatchButton
                      label="Fill Colour"
                      swatch={d.style.bg ?? 'transparent'}
                      none={!d.style.bg}
                      value={d.style.bg ?? 'none'}
                      leading={[noColour('none', 'No Fill')]}
                      onPick={(id) => colour('bg', id)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preset Scales">
                  {PRESET_SCALES.map((p) => (
                    <Tooltip key={p.label} label={p.label}>
                      <button
                        type="button"
                        aria-label={p.label}
                        className="cursor-pointer rounded"
                        onClick={() =>
                          set({
                            min: { ...d.min, c: p.min },
                            max: { ...d.max, c: p.max },
                            mid: p.mid
                              ? { c: p.mid, at: d.mid?.at ?? 'pctile', v: d.mid?.v ?? '50' }
                              : null,
                          })
                        }
                      >
                        <Swatch
                          rule={{
                            is: 'scale',
                            min: { c: p.min, at: 'min' },
                            mid: p.mid ? { c: p.mid, at: 'pctile', v: 50 } : undefined,
                            max: { c: p.max, at: 'max' },
                          }}
                        />
                      </button>
                    </Tooltip>
                  ))}
                </div>
                {pointRow('Minpoint', 'min')}
                {d.mid ? pointRow('Midpoint', 'mid') : null}
                {pointRow('Maxpoint', 'max')}
                <label className="flex cursor-pointer items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={!!d.mid}
                    onChange={(e) =>
                      set({
                        mid: e.target.checked
                          ? { c: SCALE_ENDS.yellow, at: 'pctile', v: '50' }
                          : null,
                      })
                    }
                  />
                  Midpoint
                </label>
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <span className="flex-1 text-[12px] text-red-600 dark:text-red-400" role="alert">
                {why}
              </span>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  setD(null);
                  if (ruleId) onClose();
                }}
              >
                Cancel
              </Button>
              <Button size="xs" onClick={done}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </AnchoredPopover>
  );
}
