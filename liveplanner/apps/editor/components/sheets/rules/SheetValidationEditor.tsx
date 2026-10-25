'use client';

// The Data Validation rule editor (docs/specs/029-sheets/data-validation.md "Making and changing rules"): Apply to
// Range, the Criteria (a rule kind and its fields), Advanced (Reject or Warn, Help Text), and Remove Rule, Cancel and
// Done. Done writes the rule over its range (taking the range out of every other rule), one change and one undo step.
import { useState } from 'react';
import { Button, Select, TextInput, DateInput } from '@liveplanner/ui';
import {
  DROPDOWN_OPTIONS_MAX,
  DROPDOWN_OPTION_MAX,
  VALIDATION_HELP_MAX,
  cellKey,
  displayValue,
  formatRange,
  isoFromSerial,
  parseLocaleNumber,
  parseRangeText,
  posRangeOf,
  serialFromIso,
  type GridRange,
  type RuleSettings,
  type ValidationKind,
  type ValidationRule,
} from '@liveplanner/sheets';
import { OptionRows } from '@/components/plan/OptionRows';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { noColour, standardGroup } from '@/components/colour/colour-options';
import { GREY_PEN_COLOUR, INK_PEN_COLOUR, standardColours } from '@liveplanner/project';
import { useSheetController, type SheetController } from '../sheet-controller';
import type { SheetActions } from '../useSheetActions';

const EDITOR_WIDTH_PX = 352;
// Options take the soft Standard Colours in turn, so each reads apart as a chip (data-validation.md).
// Ink and grey aside: a white or grey chip barely reads as one.
const NEUTRALS = new Set<string>([INK_PEN_COLOUR, GREY_PEN_COLOUR]);
const OPTION_COLOURS = standardColours('soft', 'light')
  .filter((c) => !NEUTRALS.has(c.name))
  .map((c) => c.hex.toLowerCase());
const OPTION_GROUPS = [
  standardGroup('soft', 'light', 'hex'),
  standardGroup('strong', 'light', 'hex'),
];

const KINDS: { id: ValidationKind; label: string }[] = [
  { id: 'list', label: 'Dropdown' },
  { id: 'range', label: 'Dropdown (From a Range)' },
  { id: 'check', label: 'Checkbox' },
  { id: 'num', label: 'Number' },
  { id: 'date', label: 'Date' },
  { id: 'text', label: 'Text' },
];
const OPS: Record<'num' | 'date' | 'text', { id: string; label: string; values: 0 | 1 | 2 }[]> = {
  num: [
    { id: 'between', label: 'Is Between', values: 2 },
    { id: 'notBetween', label: 'Is Not Between', values: 2 },
    { id: 'gt', label: 'Greater Than', values: 1 },
    { id: 'gte', label: 'Greater Than or Equal To', values: 1 },
    { id: 'lt', label: 'Less Than', values: 1 },
    { id: 'lte', label: 'Less Than or Equal To', values: 1 },
    { id: 'eq', label: 'Is Equal To', values: 1 },
    { id: 'neq', label: 'Is Not Equal To', values: 1 },
  ],
  date: [
    { id: 'valid', label: 'Is a Valid Date', values: 0 },
    { id: 'before', label: 'Is Before', values: 1 },
    { id: 'onOrBefore', label: 'Is On or Before', values: 1 },
    { id: 'after', label: 'Is After', values: 1 },
    { id: 'onOrAfter', label: 'Is On or After', values: 1 },
    { id: 'on', label: 'Is On', values: 1 },
    { id: 'between', label: 'Is Between', values: 2 },
    { id: 'notBetween', label: 'Is Not Between', values: 2 },
  ],
  text: [
    { id: 'contains', label: 'Contains', values: 1 },
    { id: 'notContains', label: 'Does Not Contain', values: 1 },
    { id: 'exactly', label: 'Is Exactly', values: 1 },
    { id: 'email', label: 'Is a Valid Email', values: 0 },
    { id: 'url', label: 'Is a Valid URL', values: 0 },
  ],
};
const SHOWS = [
  { id: 'chip', label: 'Chip' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'plain', label: 'Plain Text' },
] as const;

type Option = { key: number; v: string; c?: string };
type Draft = {
  range: string;
  is: ValidationKind;
  opts: Option[];
  show: 'chip' | 'arrow' | 'plain';
  src: string;
  op: string;
  a: string;
  b: string;
  warn: boolean;
  help: string;
};

let optionKey = 0;
const nextKey = () => ++optionKey;

function rangeText(
  c: SheetController,
  r: { r1: string; c1: string; r2: string; c2: string } | undefined,
) {
  const p = r ? posRangeOf(c.sheet.layout, r) : null;
  return p ? formatRange(p) : '';
}

// The distinct values already in the selection (up to the options' limit), each a Theme Palette colour in turn.
function optionsFromCells(c: SheetController, g: GridRange, palette: readonly string[]): Option[] {
  const out: Option[] = [];
  const seen = new Set<string>();
  for (let r = g.r1; r <= g.r2 && out.length < DROPDOWN_OPTIONS_MAX; r++)
    for (let col = g.c1; col <= g.c2 && out.length < DROPDOWN_OPTIONS_MAX; col++) {
      const rowId = c.sheet.layout.rows[r];
      const colId = c.sheet.layout.cols[col];
      if (!rowId || !colId) continue;
      const shown = displayValue(
        c.workbook.value(c.sheet.id, r, col),
        c.sheet.cells.get(cellKey(rowId, colId))?.format,
        c.locale,
      ).text.trim();
      if (!shown || shown.length > DROPDOWN_OPTION_MAX || seen.has(shown.toLowerCase())) continue;
      seen.add(shown.toLowerCase());
      out.push({ key: nextKey(), v: shown, c: palette[out.length % palette.length] });
    }
  return out;
}

function draftOf(
  c: SheetController,
  rule: ValidationRule | undefined,
  palette: readonly string[],
): Draft {
  const sel = c.selection.ranges[c.selection.ranges.length - 1]!;
  if (!rule) {
    const opts = optionsFromCells(c, sel, palette);
    return {
      range: formatRange(sel),
      is: 'list',
      opts: opts.length
        ? opts
        : [
            { key: nextKey(), v: '' },
            { key: nextKey(), v: '' },
          ],
      show: 'chip',
      src: '',
      op: '',
      a: '',
      b: '',
      warn: false,
      help: '',
    };
  }
  const asText = (v: number | string | undefined) =>
    v === undefined
      ? ''
      : rule.is === 'date' && typeof v === 'number'
        ? isoFromSerial(v)
        : String(v);
  return {
    range: rangeText(c, rule),
    is: rule.is,
    opts: (rule.opts ?? []).map((o) => ({ key: nextKey(), v: o.v, c: o.c })),
    show: rule.show ?? 'chip',
    src: rangeText(c, rule.src),
    op: rule.op ?? '',
    a: asText(rule.a),
    b: asText(rule.b),
    warn: !!rule.warn,
    help: rule.help ?? '',
  };
}

// The draft as a rule's settings, or why it cannot be one.
export function settingsOf(
  d: Draft,
  locale: string,
  rangeIds: (g: GridRange) => ValidationRule['src'] | null,
): { ok: true; settings: RuleSettings } | { ok: false; why: string } {
  const extra = {
    ...(d.warn ? { warn: true as const } : {}),
    ...(d.help.trim() ? { help: d.help.trim().slice(0, VALIDATION_HELP_MAX) } : {}),
  };
  switch (d.is) {
    case 'check':
      return { ok: true, settings: { is: 'check', ...extra } };
    case 'list': {
      const opts = d.opts.map((o) => ({ v: o.v.trim(), c: o.c })).filter((o) => o.v);
      if (!opts.length) return { ok: false, why: 'Add at least one option' };
      if (new Set(opts.map((o) => o.v.toLowerCase())).size !== opts.length)
        return { ok: false, why: 'Each option must be different' };
      return {
        ok: true,
        settings: {
          is: 'list',
          opts: opts.map((o) => (o.c ? { v: o.v, c: o.c } : { v: o.v })),
          ...(d.show === 'chip' ? {} : { show: d.show }),
          ...extra,
        },
      };
    }
    case 'range': {
      const g = parseRangeText(d.src);
      const src = g ? rangeIds(g) : null;
      if (!src) return { ok: false, why: 'Type the range to take options from, like A2:A20' };
      return {
        ok: true,
        settings: { is: 'range', src, ...(d.show === 'chip' ? {} : { show: d.show }), ...extra },
      };
    }
    case 'num':
    case 'date':
    case 'text': {
      const op = OPS[d.is].find((o) => o.id === d.op) ?? OPS[d.is][0]!;
      const read = (t: string) =>
        d.is === 'date' ? (t ? serialFromIso(t) : null) : parseLocaleNumber(t.trim(), locale);
      if (d.is === 'text') {
        if (op.values === 0)
          return { ok: true, settings: { is: 'text', op: op.id as never, ...extra } };
        if (!d.a.trim()) return { ok: false, why: 'Enter a value' };
        return { ok: true, settings: { is: 'text', op: op.id as never, a: d.a.trim(), ...extra } };
      }
      if (op.values === 0)
        return { ok: true, settings: { is: d.is, op: op.id as never, ...extra } };
      const a = read(d.a);
      const b = op.values === 2 ? read(d.b) : undefined;
      if (a === null || b === null)
        return { ok: false, why: d.is === 'date' ? 'Enter a date' : 'Enter a number' };
      return {
        ok: true,
        settings: { is: d.is, op: op.id as never, a, ...(b === undefined ? {} : { b }), ...extra },
      };
    }
  }
}

const label =
  'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function SheetValidationEditor({
  actions,
  anchor,
  ruleId,
  fresh = false,
  onClose,
}: {
  actions: SheetActions;
  anchor: HTMLElement;
  ruleId?: string;
  // A new rule over the selection (Dropdown), never the active cell's.
  fresh?: boolean;
  onClose: () => void;
}) {
  const c = useSheetController();
  const palette = OPTION_COLOURS;
  const existing = fresh
    ? undefined
    : ((ruleId ? c.sheet.layout.rules?.find((x) => x.id === ruleId) : undefined) ??
      (() => {
        const { active } = c.selection;
        const at = c.sheet.layout.rules?.find((x) => {
          const p = posRangeOf(c.sheet.layout, x);
          return p && active.r >= p.r1 && active.r <= p.r2 && active.c >= p.c1 && active.c <= p.c2;
        });
        return at;
      })());
  const [d, setD] = useState<Draft>(() => draftOf(c, existing, palette));
  const [why, setWhy] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(!!(existing?.warn || existing?.help));
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const set = (patch: Partial<Draft>) => {
    setWhy(null);
    setD((x) => ({ ...x, ...patch }));
  };
  const setOpt = (key: number, patch: Partial<Option>) =>
    set({ opts: d.opts.map((o) => (o.key === key ? { ...o, ...patch } : o)) });
  const addOptAfter = (key?: number) => {
    if (d.opts.length >= DROPDOWN_OPTIONS_MAX) return;
    const at = key === undefined ? d.opts.length : d.opts.findIndex((o) => o.key === key) + 1;
    const next = [...d.opts];
    next.splice(at, 0, { key: nextKey(), v: '', c: palette[d.opts.length % palette.length] });
    set({ opts: next });
  };
  const done = () => {
    const g = parseRangeText(d.range);
    if (!g || g.r2 >= c.sheet.layout.rows.length || g.c2 >= c.sheet.layout.cols.length)
      return setWhy('Type a range like B2:B20');
    const made = settingsOf(d, c.locale, (x) => actions.rangeIds(x));
    if (!made.ok) return setWhy(made.why);
    if (actions.setValidation(g, made.settings, existing?.id)) onClose();
  };
  const ops = d.is === 'num' || d.is === 'date' || d.is === 'text' ? OPS[d.is] : null;
  const op = ops ? (ops.find((o) => o.id === d.op) ?? ops[0]!) : null;
  const valueField = (key: 'a' | 'b', name: string) =>
    d.is === 'date' ? (
      <DateInput
        aria-label={name}
        value={d[key] || undefined}
        onCommit={(day) => set({ [key]: day ?? '' })}
      />
    ) : (
      <TextInput
        aria-label={name}
        placeholder={d.is === 'num' ? 'A number' : 'Text'}
        value={d[key]}
        onChange={(e) => set({ [key]: e.target.value })}
      />
    );
  return (
    <AnchoredPopover
      anchor={anchor}
      name="Data Validation"
      width={EDITOR_WIDTH_PX}
      onClose={onClose}
    >
      <div
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 text-[13px] text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">Data Validation</h2>
        <label className="flex flex-col gap-1">
          <span className={label}>Apply to Range</span>
          <TextInput value={d.range} onChange={(e) => set({ range: e.target.value })} />
        </label>
        <div className="flex flex-col gap-1">
          <span className={label}>Criteria</span>
          <Select
            aria-label="Criteria"
            value={d.is}
            onChange={(e) => set({ is: e.target.value as ValidationKind, op: '', a: '', b: '' })}
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
        {d.is === 'list' ? (
          <div className="flex flex-col gap-1.5" role="list" aria-label="Options">
            {d.opts.map((o, i) => (
              <div
                key={o.key}
                role="listitem"
                className="flex items-center gap-1.5"
                draggable={false}
                onDragOver={(e) => dragFrom !== null && e.preventDefault()}
                onDrop={() => {
                  if (dragFrom === null || dragFrom === i) return;
                  const next = [...d.opts];
                  const [moved] = next.splice(dragFrom, 1);
                  next.splice(i, 0, moved!);
                  setDragFrom(null);
                  set({ opts: next });
                }}
              >
                <span
                  aria-hidden
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragEnd={() => setDragFrom(null)}
                  className="cursor-grab select-none px-0.5 text-slate-400"
                >
                  ⋮⋮
                </span>
                <ColourSwatchButton
                  label={`Colour for ${o.v || `Option ${i + 1}`}`}
                  swatch={o.c ?? 'transparent'}
                  none={!o.c}
                  value={o.c ?? 'none'}
                  leading={[noColour('none', 'No Colour')]}
                  standard={OPTION_GROUPS}
                  onPick={(id) =>
                    setOpt(o.key, { c: id === 'none' ? undefined : id.toLowerCase() })
                  }
                />
                <TextInput
                  aria-label={`Option ${i + 1}`}
                  className="min-w-0 flex-1"
                  maxLength={DROPDOWN_OPTION_MAX}
                  value={o.v}
                  placeholder={`Option ${i + 1}`}
                  onChange={(e) => setOpt(o.key, { v: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addOptAfter(o.key);
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={`Remove ${o.v || `Option ${i + 1}`}`}
                  onClick={() => set({ opts: d.opts.filter((x) => x.key !== o.key) })}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="xs" onClick={() => addOptAfter()}>
              Add Another Option
            </Button>
          </div>
        ) : null}
        {d.is === 'range' ? (
          <label className="flex flex-col gap-1">
            <span className={label}>Options From</span>
            <TextInput
              placeholder="A2:A20"
              value={d.src}
              onChange={(e) => set({ src: e.target.value })}
            />
          </label>
        ) : null}
        {d.is === 'list' || d.is === 'range' ? (
          <div className="flex flex-col gap-1">
            <span className={label}>Display</span>
            <OptionRows
              kind="single"
              label="Display"
              selected={d.show}
              rows={SHOWS.map((s) => ({ id: s.id, label: s.label }))}
              onPick={(id) => set({ show: id as Draft['show'] })}
            />
          </div>
        ) : null}
        {ops && op ? (
          <div className="flex flex-col gap-1.5">
            <Select
              aria-label="Condition"
              value={op.id}
              onChange={(e) => set({ op: e.target.value })}
            >
              {ops.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            {op.values >= 1 ? valueField('a', op.values === 2 ? 'From' : 'Value') : null}
            {op.values === 2 ? valueField('b', 'To') : null}
          </div>
        ) : null}
        <button
          type="button"
          aria-expanded={advanced}
          className="flex cursor-pointer items-center gap-1 text-left text-[12px] font-semibold text-slate-600 dark:text-slate-300"
          onClick={() => setAdvanced(!advanced)}
        >
          <span aria-hidden>{advanced ? '▾' : '▸'}</span> Advanced
        </button>
        {advanced ? (
          <div className="flex flex-col gap-2">
            <OptionRows
              kind="single"
              label="If the Value Isn't Allowed"
              selected={d.warn ? 'warn' : 'reject'}
              rows={[
                { id: 'reject', label: 'Reject the Value' },
                { id: 'warn', label: 'Show a Warning' },
              ]}
              onPick={(id) => set({ warn: id === 'warn' })}
            />
            <label className="flex flex-col gap-1">
              <span className={label}>Help Text</span>
              <TextInput
                maxLength={VALIDATION_HELP_MAX}
                value={d.help}
                placeholder="Shown when a value isn't allowed"
                onChange={(e) => set({ help: e.target.value })}
              />
            </label>
          </div>
        ) : null}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
          {existing ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                actions.removeValidationRule(existing.id);
                onClose();
              }}
            >
              Remove Rule
            </Button>
          ) : null}
          <span className="flex-1 text-[12px] text-red-600 dark:text-red-400" role="alert">
            {why}
          </span>
          <Button variant="secondary" size="xs" onClick={onClose}>
            Cancel
          </Button>
          <Button size="xs" onClick={done}>
            Done
          </Button>
        </div>
      </div>
    </AnchoredPopover>
  );
}
