// Inherited card types (docs/specs/026-plan/item-types.md "Inherited types"): a type naming a base type in `inherits`
// takes the base's fields, custom fields (same ids, every setting), tabs, statuses, Default State and display, keeps
// its own id, name, colour, glyph and new-card title, and adds fields of its own (`ownFields`) after the base's. It is
// stored resolved, so a reader that knows nothing of inheritance still reads a whole type. One level only: a base
// inherits from none. Pure; run where a catalogue is validated, rebased or edited, never where a type is read.
import { CARD_SIZES } from './board';
import {
  defaultCardLayout,
  sameCardLayout,
  type CardDisplay,
  type CardLayout,
} from './card-display';
import type { ItemTypeDef } from './item-types';
import { requiredFieldsOf } from './type-required-fields';

// The parts an inherited type copies whole from its base type; one the base lacks, the inherited type lacks too.
// Display is inherited as the base shows it (inheritedDisplay).
export const INHERITED_PARTS = [
  'tabs',
  'detailsLabel',
  'statuses',
  'excludedStatuses',
  'defaultStatus',
  'assigneeNotifies',
  'colourField',
] as const satisfies readonly (keyof ItemTypeDef)[];

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const NONE: ReadonlySet<string> = new Set();

// A type's base type in `types`, or undefined: it inherits from none, or names one the list lacks (or itself).
export function baseOf(
  type: Pick<ItemTypeDef, 'id' | 'inherits'>,
  types: readonly ItemTypeDef[],
): ItemTypeDef | undefined {
  const id = type.inherits;
  if (!id || id === type.id) return undefined;
  return types.find((t) => t.id === id);
}

// The types that inherit from the type `id`, in catalogue order.
export function inheritingTypesOf(id: string, types: readonly ItemTypeDef[]): ItemTypeDef[] {
  return types.filter((t) => t.inherits === id && t.id !== id);
}

// The types the type `typeId` (undefined for a new one) may inherit from: every type that inherits from none, but
// itself. None while other types inherit from it, as a base never inherits.
export function basesFor(typeId: string | undefined, types: readonly ItemTypeDef[]): ItemTypeDef[] {
  if (typeId && inheritingTypesOf(typeId, types).length > 0) return [];
  return types.filter((t) => t.id !== typeId && !t.inherits);
}

// The field ids a type takes from its base type (its fields and every custom field it defines); none without one.
export function inheritedFieldIds(
  type: Pick<ItemTypeDef, 'id' | 'inherits'>,
  types: readonly ItemTypeDef[],
): ReadonlySet<string> {
  const base = baseOf(type, types);
  if (!base) return NONE;
  return new Set([...base.fields, ...(base.custom ?? []).map((c) => c.id)]);
}

// An inherited type's own fields against `base`: its stored `ownFields` (absent, every field it has that the base
// lacks: a type just given its base, or one written without them), less any
// the base now has (the base's copy wins) or the type no longer offers, plus a field the type's id always keeps
// (a Project's Start and Due) that the base lacks.
function ownOf(child: ItemTypeDef, base: ItemTypeDef): string[] {
  const inherited = new Set([...base.fields, ...(base.custom ?? []).map((c) => c.id)]);
  const offered = new Set(child.fields);
  const listed = child.ownFields ?? child.fields;
  const own: string[] = [];
  for (const f of listed) {
    if (offered.has(f) && !inherited.has(f) && !own.includes(f)) own.push(f);
  }
  for (const f of requiredFieldsOf(child.id)) {
    if (!inherited.has(f) && !own.includes(f)) own.push(f);
  }
  return own;
}

// What the base type's cards show at each size, as an inherited type of id `childId` stores it: a size the base leaves
// to its default (which a ready-made type's id decides) written out, and a size matching the inherited type's own
// default left out, as the catalogue's reader stores it (readCardDisplay).
function inheritedDisplay(base: ItemTypeDef, childId: string): CardDisplay | undefined {
  const out: Partial<Record<(typeof CARD_SIZES)[number], CardLayout>> = {};
  for (const size of CARD_SIZES) {
    const shown = base.display?.[size] ?? defaultCardLayout(base.id, size);
    if (!sameCardLayout(size, shown, defaultCardLayout(childId, size))) out[size] = shown;
  }
  return Object.keys(out).length ? out : undefined;
}

// `child` resolved against `base`: the base's fields then its own, the base's custom fields then its own, and every
// inherited part copied. Keys in the order the catalogue's reader writes them, so a resolved type reads back the same.
export function resolveChild(child: ItemTypeDef, base: ItemTypeDef): ItemTypeDef {
  const own = ownOf(child, base);
  const mine = new Set(own);
  const custom = [...(base.custom ?? []), ...(child.custom ?? []).filter((c) => mine.has(c.id))];
  const next: Mutable<ItemTypeDef> = {
    id: child.id,
    label: child.label,
    newTitle: child.newTitle,
    glyph: child.glyph,
    color: child.color,
    fields: [...base.fields, ...own],
  };
  if (custom.length) next.custom = custom;
  for (const part of INHERITED_PARTS) {
    if (part === 'defaultStatus') {
      const display = inheritedDisplay(base, child.id);
      if (display) next.display = display;
    }
    if (base[part] !== undefined) (next as Record<string, unknown>)[part] = base[part];
  }
  next.inherits = base.id;
  // Always written beside the link, empty too, so a stored type's own fields are exact (absent means "not yet
  // worked out": a type just given its base).
  next.ownFields = own;
  return next;
}

// `type` made to inherit from `base`: its fields the base lacks become its own, and the rest is the base's.
export function inheritFrom(type: ItemTypeDef, base: ItemTypeDef): ItemTypeDef {
  const { ownFields: _own, ...rest } = type;
  return resolveChild({ ...rest, inherits: base.id }, base);
}

// `type` no longer following its base type: every part it holds (the base's settings as they were) is its own.
export function detachType(type: ItemTypeDef): ItemTypeDef {
  const { inherits: _base, ownFields: _own, ...rest } = type;
  return rest;
}

// Why `types` can't be stored as they inherit, or null: a type inheriting from itself, or from a type that itself
// inherits (a chain, which also catches a base given a base).
export function inheritanceProblem(types: readonly ItemTypeDef[]): string | null {
  for (const [i, t] of types.entries()) {
    if (!t.inherits) continue;
    if (t.inherits === t.id || baseOf(t, types)?.inherits) return `types[${i}].inherits`;
  }
  return null;
}

const resolved = new WeakMap<readonly ItemTypeDef[], readonly ItemTypeDef[]>();

// Every inherited type in `types` resolved against its base type, in place; one whose base the list lacks is
// detached, keeping what it holds. A chain is left as it is (inheritanceProblem refuses it). Answers `types` itself
// when nothing changed, and remembers each list it answered, so resolving a resolved list costs a lookup.
export function withInheritance(types: readonly ItemTypeDef[]): readonly ItemTypeDef[] {
  const hit = resolved.get(types);
  if (hit) return hit;
  let changed = false;
  const out = types.map((t) => {
    if (!t.inherits) return t;
    const base = baseOf(t, types);
    if (base?.inherits) return t;
    const next = base ? resolveChild(t, base) : detachType(t);
    if (JSON.stringify(next) === JSON.stringify(t)) return t;
    changed = true;
    return next;
  });
  const answer = changed ? out : types;
  resolved.set(types, answer);
  resolved.set(answer, answer);
  return answer;
}
