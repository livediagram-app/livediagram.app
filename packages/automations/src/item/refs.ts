// What a rule's parts name of the item (blueprint item-engine.md "References"): a tab, a snapshot, a connection, a
// template, a person, read by field name in the shared kinds and an app's alike. One walk lists them (needs, kept
// snapshots) and rewrites them (a copy's tabs, a file's cleared picks). Pure.

import { isObj, type Obj } from '../validate-read';
import type { ItemRefKind } from './names';

export type ItemRef = { kind: ItemRefKind; id: string };

// A step's `tab` that means the run's own tab: no id.
export const RUN_TAB = 'run';

const FIELDS: ReadonlyMap<string, ItemRefKind> = new Map([
  ['tab', 'tab'],
  ['snapshot', 'snapshot'],
  ['webhook', 'connection'],
  ['template', 'template'],
  ['person', 'person'],
]);

function walk(value: unknown, visit: (ref: ItemRef) => string): unknown {
  if (Array.isArray(value)) return value.map((x) => walk(x, visit));
  if (!isObj(value)) return value;
  const out: Obj = {};
  for (const [key, x] of Object.entries(value)) {
    const kind = FIELDS.get(key);
    if (kind && typeof x === 'string')
      out[key] = kind === 'tab' && x === RUN_TAB ? x : visit({ kind, id: x });
    else if (key === 'tabs' && Array.isArray(x))
      out[key] = x.map((id: unknown) => (typeof id === 'string' ? visit({ kind: 'tab', id }) : id));
    else out[key] = walk(x, visit);
  }
  return out;
}

/** `value` (a rule, a part, a list of them) with every reference it holds replaced by what `visit` answers. */
export const mapRefs = <T>(value: T, visit: (ref: ItemRef) => string): T => walk(value, visit) as T;

// A reference of an app's own (blueprint item-engine.md "References"): a field of its own kinds that names, by id,
// something only that app's items have (a tab's named version). The app declares it on its registry
// (`defineItemKinds({ ownRefs })`); the engine then treats the field as it treats a snapshot's: empty is still to
// pick, a copy or a draft leaves it to pick, and the Rules list says when what it names is gone (the kit's `owns`).
export interface ItemOwnRef {
  // The field's name, in any part of a rule.
  field: string;
  // What it names, with its article: "Pick a version".
  noun: string;
  // The same as a line starts with it: "Version v1 is gone".
  title: string;
}

export type ItemOwnRefAt = { field: string; id: string };

function walkOwn(
  value: unknown,
  fields: ReadonlySet<string>,
  visit: (ref: ItemOwnRefAt) => string,
): unknown {
  if (Array.isArray(value)) return value.map((x) => walkOwn(x, fields, visit));
  if (!isObj(value)) return value;
  const out: Obj = {};
  for (const [key, x] of Object.entries(value))
    out[key] =
      fields.has(key) && typeof x === 'string'
        ? visit({ field: key, id: x })
        : walkOwn(x, fields, visit);
  return out;
}

/** `value` with every reference of the app's own replaced by what `visit` answers; `value` itself when the app
 *  declares none. */
export const mapOwnRefs = <T>(
  value: T,
  own: readonly ItemOwnRef[] | undefined,
  visit: (ref: ItemOwnRefAt) => string,
): T =>
  !own || own.length === 0 ? value : (walkOwn(value, new Set(own.map((o) => o.field)), visit) as T);

/** Every reference of the app's own `value` holds, in order, each once. */
export function ownRefsOf(value: unknown, own: readonly ItemOwnRef[] | undefined): ItemOwnRefAt[] {
  const seen = new Set<string>();
  const out: ItemOwnRefAt[] = [];
  mapOwnRefs(value, own, (ref) => {
    const key = `${ref.field}\u0000${ref.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(ref);
    }
    return ref.id;
  });
  return out;
}

/** Every reference `value` holds, in the order it names them, each once. */
export function refsOf(value: unknown): ItemRef[] {
  const seen = new Set<string>();
  const out: ItemRef[] = [];
  walk(value, (ref) => {
    const key = `${ref.kind}\u0000${ref.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(ref);
    }
    return ref.id;
  });
  return out;
}
