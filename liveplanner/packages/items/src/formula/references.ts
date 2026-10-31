// The fields a formula may read, and its two spellings (docs/specs/026-plan/item-types.md "Formula fields"): as
// people write it, with names, and as stored, each field its id in braces (`{f-budget} - {f-spent}`), so renaming a
// field never breaks a formula. Both ways go through the tokenizer and parser, never a regex over the text.
import type { CustomFieldDef, CustomFieldKind, ItemTypeDef } from '../item-types';
import { FORMULA_MAX } from './limits';
import { functionNamed } from './functions';
import { parseFormula, type FormulaNode } from './parse';
import { column } from './tokens';

// A built-in field a formula reads: its id ('#key' and '#type' are every card's Number and Type), the name the card
// panel gives it, and the other names people type.
interface BuiltInFormulaField {
  id: string;
  name: string;
  aliases?: readonly string[];
  // Every card has it, whatever its type offers.
  always?: true;
}

const BUILT_INS: readonly BuiltInFormulaField[] = [
  { id: 'title', name: 'Title' },
  { id: 'estimate', name: 'Estimate', aliases: ['points'] },
  { id: 'start', name: 'Start Date', aliases: ['start'] },
  { id: 'due', name: 'Due Date', aliases: ['due'] },
  { id: 'priority', name: 'Priority' },
  { id: 'assignee', name: 'Assignee' },
  { id: 'labels', name: 'Labels' },
  { id: 'color', name: 'Colour', aliases: ['color'] },
  { id: 'checklist', name: 'Checklist' },
  { id: '#key', name: 'Number', always: true },
  { id: '#type', name: 'Type', always: true },
];

// The custom kinds a formula can't read: a picture, threads and votes are not values.
const UNREADABLE: Partial<Record<CustomFieldKind, string>> = {
  image: 'An Image',
  comments: 'A Comments field',
  votes: 'A Votes field',
};

export interface FormulaField {
  id: string;
  name: string;
  // A custom field's definition; absent for a built-in.
  custom?: CustomFieldDef;
}

export interface FormulaScope {
  // The readable fields, in the type's order (custom and built-in), Number and Type last.
  fields: readonly FormulaField[];
  byId: ReadonlyMap<string, FormulaField>;
  // Lower-case name (and a built-in's other names) to id; a custom field's name wins.
  byName: ReadonlyMap<string, string>;
  // Fields the type has that a formula can't read, by lower-case name and by id: why not.
  unreadable: ReadonlyMap<string, string>;
}

type ScopeType = Pick<ItemTypeDef, 'fields' | 'custom'>;

const scopes = new WeakMap<ScopeType, FormulaScope>();

// What a formula on a card of `type` may read; made once per type object (a catalogue change makes new ones).
export function formulaScopeOf(type: ScopeType): FormulaScope {
  const hit = scopes.get(type);
  if (hit) return hit;
  const fields: FormulaField[] = [];
  const byName = new Map<string, string>();
  const unreadable = new Map<string, string>();
  const offered = new Set(type.fields);
  for (const id of type.fields) {
    const custom = type.custom?.find((c) => c.id === id);
    if (custom) {
      const why = UNREADABLE[custom.kind];
      if (why) {
        const reason = `${why} can't be used in a formula`;
        unreadable.set(custom.label.toLowerCase(), reason);
        unreadable.set(id, reason);
        continue;
      }
      fields.push({ id, name: custom.label, custom });
      if (!byName.has(custom.label.toLowerCase())) byName.set(custom.label.toLowerCase(), id);
      continue;
    }
    const built = BUILT_INS.find((b) => b.id === id);
    if (built) fields.push({ id, name: built.name });
  }
  for (const b of BUILT_INS) if (b.always) fields.push({ id: b.id, name: b.name });
  for (const b of BUILT_INS) {
    if (!b.always && !offered.has(b.id)) continue;
    for (const n of [b.name, ...(b.aliases ?? [])])
      if (!byName.has(n.toLowerCase())) byName.set(n.toLowerCase(), b.id);
  }
  const scope: FormulaScope = {
    fields,
    byId: new Map(fields.map((f) => [f.id, f])),
    byName,
    unreadable,
  };
  scopes.set(type, scope);
  return scope;
}

type Ref = Extract<FormulaNode, { k: 'ref' }>;

// Every field a tree names, each time it is named, in the order written.
function allRefs(tree: FormulaNode, out: Ref[] = []): Ref[] {
  if (tree.k === 'ref') out.push(tree);
  else if (tree.k === 'neg') allRefs(tree.x, out);
  else if (tree.k === 'bin') {
    allRefs(tree.a, out);
    allRefs(tree.b, out);
  } else if (tree.k === 'call') for (const a of tree.args) allRefs(a, out);
  return out;
}

// Each named field's span replaced, last first so earlier spans keep their places.
function replaceRefs(src: string, refs: readonly Ref[], to: (r: Ref) => string): string {
  let out = src;
  for (const r of [...refs].sort((a, b) => b.at - a.at))
    out = out.slice(0, r.at) + to(r) + out.slice(r.end);
  return out;
}

export type StoredFormula =
  { ok: true; formula: string } | { ok: false; error: string; at: number };

const tooLong = (): StoredFormula => ({
  ok: false,
  error: `A formula holds up to ${FORMULA_MAX.toLocaleString('en-GB')} characters`,
  at: FORMULA_MAX,
});

// A formula as written (with names) to its stored form (with ids), or the first problem: bad syntax, a field the type
// doesn't have or a formula can't read, the field reading itself, or too long either way.
export function storedFormula(text: string, scope: FormulaScope, selfId?: string): StoredFormula {
  if (text.length > FORMULA_MAX) return tooLong();
  const tree = parseFormula(text);
  if ('error' in tree) return { ok: false, error: tree.error, at: tree.at };
  const refs = allRefs(tree);
  const ids = new Map<Ref, string>();
  for (const r of refs) {
    const key = r.name.toLowerCase();
    const id = scope.byName.get(key);
    if (!id) {
      const why = scope.unreadable.get(key);
      return { ok: false, error: why ?? `Unknown field "${r.name}" at ${column(r.at)}`, at: r.at };
    }
    if (id === selfId) return { ok: false, error: "A formula can't read its own field", at: r.at };
    ids.set(r, id);
  }
  const formula = replaceRefs(text, refs, (r) => `{${ids.get(r)}}`);
  return formula.length > FORMULA_MAX ? tooLong() : { ok: true, formula };
}

// A plain name is written as it is; any other (two spaces, a sign, true, a function's name) in braces.
export function nameAsWritten(name: string): string {
  const tree = parseFormula(name);
  const plain = !('error' in tree) && tree.k === 'ref' && tree.name === name;
  return plain && !functionNamed(name) ? name : `{${name}}`;
}

// What a stored formula shows: each id as its field's name; a field gone from the type as `{deleted field}`, so
// saving it again names the problem. Text that doesn't parse (never stored by these writers) shows as it is.
export function shownFormula(stored: string, scope: FormulaScope): string {
  const tree = parseFormula(stored);
  if ('error' in tree) return stored;
  return replaceRefs(stored, allRefs(tree), (r) => {
    const f = scope.byId.get(r.name);
    return f ? nameAsWritten(f.name) : '{deleted field}';
  });
}

// The ids a stored formula reads that the type no longer offers a formula, with why: deleted, taken off the type, or
// a kind a formula can't read. Null when every one is readable.
export function missingFieldProblem(
  ids: readonly string[],
  scope: FormulaScope,
  selfId?: string,
): string | null {
  for (const id of ids) {
    if (id === selfId) return "A formula can't read its own field";
    if (scope.byId.has(id)) continue;
    return scope.unreadable.get(id) ?? 'Uses a field that was deleted or taken off the type';
  }
  return null;
}
