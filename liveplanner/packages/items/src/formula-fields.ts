// Formula fields (docs/specs/026-plan/item-types.md "Formula fields"): a Calculated field whose calculation is
// `formula` works its value out from the card's own fields. This is the one reading every surface shares (the card
// face, the panel, sort, CSV, sheets, the SVG export, the api and the agents): the card's fields as formula values
// (the value source the evaluator reads through), the result kind's reading, and the problems a field can have. It
// never throws: a problem is an outcome. Pure.
import { currencyText, dayLabel } from './card-text';
import { PRIORITY_LABELS, isPriority } from './fields';
import { itemAssignee, itemLabels, itemTitle, type Item, type ItemFieldValue } from './item';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import { calculatedResultOf } from './calculated-result';
import { fieldCardIds, fieldPeople, holdsSeveral } from './several-values';
import { compileFormula } from './formula/compile';
import { evaluateTree } from './formula/evaluate';
import {
  FORMULA_RESULT_DEFAULT,
  FORMULA_STEPS_MAX,
  isFormulaResult,
  type FormulaResult,
} from './formula/limits';
import { formulaScopeOf, missingFieldProblem, type FormulaScope } from './formula/references';
import {
  FormulaFail,
  dateOf,
  dayText,
  fail,
  isDate,
  isList,
  kindName,
  single,
  toText,
  truthy,
  type FormulaDate,
  type FormulaValue,
} from './formula/values';

// A Formula's value as every reader takes it: a number, text, true or false, a day ("2026-10-31"), or none.
export type FormulaScalar = number | string | boolean | null;
export type FormulaOutcome = { ok: true; value: FormulaScalar } | { ok: false; error: string };

type FormulaDef = Pick<CustomFieldDef, 'kind' | 'calculation' | 'formula' | 'result' | 'currency'> &
  Partial<Pick<CustomFieldDef, 'id'>>;

export const isFormulaField = (f: Pick<CustomFieldDef, 'kind' | 'calculation'>): boolean =>
  f.kind === 'calculated' && f.calculation === 'formula';

// A Formula's result kind: Number when absent (or unknown).
export const formulaResultOf = (f: Pick<CustomFieldDef, 'result'>): FormulaResult =>
  isFormulaResult(f.result) ? f.result : FORMULA_RESULT_DEFAULT;

// What a formula reads beyond the card: other cards for a Card field's "#12 Title", the values other Calculated
// fields give (worked out by calculated-fields.ts, which passes `calculated`), and today.
export interface FormulaContext {
  items?: ReadonlyMap<string, Item>;
  // Another Calculated field's value (Child Count, Children Done, a Rollup's or Lookup's) on this card; none without
  // it. A Date result is a stored day ("2026-10-31").
  calculated?: (field: CustomFieldDef) => FormulaScalar;
  // Today as a stored day; the runtime's own local day when absent.
  today?: string;
  // The steps left for the whole value being worked out (calculated-fields.ts, a Rollup reading formulas on many
  // cards): a formula takes at most FORMULA_STEPS_MAX of them, and what it takes is counted off.
  steps?: { left: number };
}

const DAY_MS = 86_400_000;

function localToday(): FormulaDate {
  const now = new Date();
  return { day: Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS) };
}

// A stored list's entries as text: a value as written, a row (`{ text }`) by its text.
function entryText(x: unknown): string {
  if (typeof x === 'string') return x;
  if (typeof x === 'number' || typeof x === 'boolean') return String(x);
  const text = x && typeof x === 'object' ? (x as { text?: unknown }).text : undefined;
  return typeof text === 'string' ? text : '';
}

const textValue = (v: ItemFieldValue | undefined): FormulaValue =>
  typeof v === 'string' && v !== '' ? v : null;
const numberValue = (v: ItemFieldValue | undefined): FormulaValue =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const dateValue = (v: ItemFieldValue | undefined): FormulaValue =>
  typeof v === 'string' ? dateOf(v) : null;
const listValue = (v: ItemFieldValue | undefined, field: string): FormulaValue => ({
  list: (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]).map(
    entryText,
  ),
  field,
});

// One evaluation's shared state: the step budget, the formulas being worked out (a cycle check) and those done.
interface Run {
  item: Item;
  type: ItemTypeDef;
  scope: FormulaScope;
  ctx: FormulaContext;
  budget: { left: number };
  visiting: Set<string>;
  done: Map<string, FormulaValue>;
  today: () => FormulaDate;
}

function cardLabel(run: Run, id: string): string {
  const card = run.ctx.items?.get(id);
  return card ? `#${card.key} ${itemTitle(card)}` : 'Missing card';
}

// A custom field's value on the card as a formula reads it (item-types.md "Formula fields", Values).
function customValue(run: Run, def: CustomFieldDef): FormulaValue {
  const raw = run.item.fields[def.id];
  switch (def.kind) {
    case 'number':
    case 'currency':
    case 'rating':
      return numberValue(raw);
    case 'date':
      return dateValue(raw);
    case 'checkbox':
      return raw === true;
    case 'multichoice':
    case 'labels':
    case 'checklist':
      return listValue(raw, def.label);
    case 'person': {
      const names = fieldPeople(def, raw).map((p) => p.name);
      return holdsSeveral(def) ? { list: names, field: def.label } : (names[0] ?? null);
    }
    case 'card': {
      const cards = fieldCardIds(def, raw).map((id) => cardLabel(run, id));
      return holdsSeveral(def) ? { list: cards, field: def.label } : (cards[0] ?? null);
    }
    case 'calculated':
      return isFormulaField(def) ? nestedFormula(run, def) : calculatedRead(run, def);
    default:
      // Text, Long Text, Email, Link, Choice, Colour, and any kind a later reader adds: as text, or as it is stored.
      if (Array.isArray(raw)) return listValue(raw, def.label);
      return typeof raw === 'number' ? numberValue(raw) : textValue(raw);
  }
}

// Another Calculated field's value (Child Count, a Rollup, a Lookup) as a formula reads it: a Date result as a date.
function calculatedRead(run: Run, def: CustomFieldDef): FormulaValue {
  const v = run.ctx.calculated?.(def) ?? null;
  return typeof v === 'string' && calculatedResultOf(def) === 'date' ? dateOf(v) : v;
}

// A built-in field's value on the card.
function builtInValue(run: Run, id: string): FormulaValue {
  const { item } = run;
  const raw = item.fields[id];
  switch (id) {
    case 'title':
      return textValue(itemTitle(item));
    case 'estimate':
      return numberValue(raw);
    case 'start':
    case 'due':
      return dateValue(raw);
    case 'priority':
      return isPriority(raw) ? PRIORITY_LABELS[raw] : null;
    case 'assignee':
      return itemAssignee(item)?.name ?? null;
    case 'labels':
      return { list: itemLabels(item), field: 'Labels' };
    case 'checklist':
      return listValue(raw, 'Checklist');
    case '#key':
      return item.key;
    case '#type':
      return run.type.label;
    default:
      // Colour.
      return textValue(raw);
  }
}

function readField(run: Run, id: string): FormulaValue {
  // A field missing from the scope was refused before evaluating (missingFieldProblem).
  const f = run.scope.byId.get(id)!;
  return f.custom ? customValue(run, f.custom) : builtInValue(run, id);
}

// Whether a read value counts as one: blank and an empty list don't.
const hasValue = (v: FormulaValue) => v !== null && !(isList(v) && v.list.length === 0);

// A formula's raw value on the run's card; throws FormulaFail for a problem.
function evaluateField(run: Run, def: FormulaDef): FormulaValue {
  const compiled = compileFormula(def.formula ?? '');
  if (!compiled.ok) return fail(`The formula can't be read: ${compiled.error}`);
  const missing = missingFieldProblem(compiled.ids, run.scope, def.id);
  if (missing) return fail(missing);
  let saw = false;
  const value = evaluateTree(compiled.tree, {
    read: (id) => {
      const v = readField(run, id);
      if (hasValue(v)) saw = true;
      return v;
    },
    today: run.today,
    budget: run.budget,
  });
  // Every field it reads empty: no value, so a new card reads blank rather than 0.
  return compiled.ids.length > 0 && !saw ? null : value;
}

// Another Formula this one reads: its result, worked out once per run; reading itself through others is a problem.
function nestedFormula(run: Run, def: CustomFieldDef): FormulaValue {
  const hit = run.done.get(def.id);
  if (hit !== undefined) return hit;
  if (run.visiting.has(def.id)) return fail(`Circular: ${def.label} reads itself`);
  run.visiting.add(def.id);
  const scalar = resultOf(def, evaluateField(run, def));
  run.visiting.delete(def.id);
  const value: FormulaValue =
    typeof scalar === 'string' && formulaResultOf(def) === 'date' ? dateOf(scalar) : scalar;
  run.done.set(def.id, value);
  return value;
}

const RESULT_FOR: Readonly<Record<string, string>> = {
  text: 'Text',
  'a date': 'Date',
  'true or false': 'Checkbox',
};

function needs(v: FormulaValue, want: string): never {
  const kind = kindName(v);
  const hint = RESULT_FOR[kind];
  return fail(`Gives ${kind}, not ${want}${hint ? `: make the result ${hint}` : ''}`);
}

// A raw value read as a result kind, or none when it is no value of that kind (a Rollup's or Lookup's reading).
export function scalarAs(result: FormulaResult, raw: FormulaValue): FormulaScalar {
  try {
    return resultOf({ result }, raw);
  } catch {
    return null;
  }
}

// A field's value on a card as a formula reads it (`id` a built-in or custom field the type offers a formula), or
// none when the type offers no such field: what a Rollup and a Lookup read on another card. A Calculated field is
// read through `ctx.calculated` (a Formula too: calculated-fields.ts works every one out).
export function fieldValueOn(
  item: Item,
  type: ItemTypeDef,
  id: string,
  ctx: FormulaContext = {},
): FormulaValue {
  const scope = formulaScopeOf(type);
  const f = scope.byId.get(id);
  if (!f) return null;
  if (f.custom?.kind === 'calculated') return null;
  const run: Run = {
    item,
    type,
    scope,
    ctx,
    budget: { left: FORMULA_STEPS_MAX },
    visiting: new Set(),
    done: new Map(),
    today: localToday,
  };
  return readField(run, id);
}

// A raw value read as the field's result kind (item-types.md "Formula fields", The result).
function resultOf(def: Pick<CustomFieldDef, 'result'>, raw: FormulaValue): FormulaScalar {
  const result = formulaResultOf(def);
  if (raw === null) return null;
  if (result === 'text') {
    const t = toText(raw);
    return t === '' ? null : t;
  }
  if (result === 'checkbox') return truthy(raw);
  const v = single(raw);
  if (result === 'date') return isDate(v) ? dayText(v) : needs(v, 'a date');
  if (typeof v !== 'number') return needs(v, 'a number');
  if (result === 'currency') return Math.round(v * 100) / 100;
  if (result === 'percent') return Math.round(v);
  return Math.round(v * 1e10) / 1e10;
}

// What is wrong with a Formula field on a type whatever the card: a formula that can't be read, or one reading a
// field the type no longer offers a formula. Null when it works.
export function formulaProblem(
  field: Pick<CustomFieldDef, 'formula'> & Partial<Pick<CustomFieldDef, 'id'>>,
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
): string | null {
  const compiled = compileFormula(field.formula ?? '');
  if (!compiled.ok) return `The formula can't be read: ${compiled.error}`;
  return missingFieldProblem(compiled.ids, formulaScopeOf(type), field.id);
}

// A Formula field's value on a card, or the problem working it out. Never throws.
export function formulaOutcome(
  field: FormulaDef,
  item: Item,
  type: ItemTypeDef,
  ctx: FormulaContext = {},
): FormulaOutcome {
  // A problem whatever the card (a formula that can't be read, a field gone) answers before any work, never thrown.
  const problem = formulaProblem(field, type);
  if (problem) return { ok: false, error: problem };
  let today: FormulaDate | null = null;
  const start = Math.min(FORMULA_STEPS_MAX, ctx.steps?.left ?? FORMULA_STEPS_MAX);
  const run: Run = {
    item,
    type,
    scope: formulaScopeOf(type),
    ctx,
    budget: { left: start },
    visiting: new Set(field.id ? [field.id] : []),
    done: new Map(),
    today: () => (today ??= (ctx.today ? dateOf(ctx.today) : null) ?? localToday()),
  };
  try {
    return { ok: true, value: resultOf(field, evaluateField(run, field)) };
  } catch (e) {
    if (e instanceof FormulaFail) return { ok: false, error: e.error };
    // Anything else (a value source that threw) is still an outcome, never a throw on a board.
    return { ok: false, error: "This value can't be worked out" };
  } finally {
    if (ctx.steps) ctx.steps.left -= start - Math.max(0, run.budget.left);
  }
}

// The value alone: none when it can't be worked out (the api, the agents, exports and sheets).
export function formulaValue(
  field: FormulaDef,
  item: Item,
  type: ItemTypeDef,
  ctx?: FormulaContext,
): FormulaScalar {
  const out = formulaOutcome(field, item, type, ctx);
  return out.ok ? out.value : null;
}

// A value as the card face and the panel write it, by the result kind: "2,500", "£2,500", "40%", "Strong",
// "30 Oct 2026", "Yes"; null for none.
export function formulaText(
  field: Pick<CustomFieldDef, 'result' | 'currency'>,
  value: FormulaScalar | undefined,
): string | null {
  if (value === null || value === undefined || value === '') return null;
  switch (formulaResultOf(field)) {
    case 'number':
      return typeof value === 'number'
        ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : null;
    case 'currency':
      return typeof value === 'number' ? currencyText(value, field.currency) : null;
    case 'percent':
      return typeof value === 'number' ? `${value}%` : null;
    case 'date':
      return typeof value === 'string' ? dayLabel(value, 'medium') : null;
    case 'checkbox':
      return value === true ? 'Yes' : value === false ? 'No' : null;
    case 'text':
      return String(value);
  }
}

// What the card face writes for a Formula that can't be worked out on a card.
export const FORMULA_ERROR_TEXT = 'Error';
