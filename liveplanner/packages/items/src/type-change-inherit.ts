// An agent's card type change and inheritance (docs/specs/026-plan/plan-agents.md "Changing card types",
// item-types.md "Inherited types"): `inherits` makes a type inherit from a base type (or, null, detaches it), and on
// an inherited type every change to what it takes from its base is refused, naming the base.
import type { ItemTypeDef } from './item-types';
import { invalid } from './type-change-refused';
import {
  baseOf,
  detachType,
  inheritFrom,
  inheritedFieldIds,
  inheritingTypesOf,
  resolveChild,
} from './type-inheritance';

// "a, b and c".
const andList = (xs: readonly string[]) =>
  xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs.join('');

// `type` given `base` as its base type, or detached for null; a base that inherits, the type itself, or a type others
// inherit from being given a base, refused.
export function withBase(
  type: ItemTypeDef,
  base: ItemTypeDef | null,
  types: readonly ItemTypeDef[],
): ItemTypeDef {
  if (!base) return detachType(type);
  if (base.id === type.id) throw invalid(`${type.label} can't inherit from itself.`);
  const above = baseOf(base, types);
  if (base.inherits)
    throw invalid(
      `${base.label} inherits from ${above?.label ?? base.inherits}, and a type inherits only from one that inherits from none.`,
    );
  const below = inheritingTypesOf(type.id, types);
  if (below.length)
    throw invalid(
      `${andList(below.map((t) => t.label))} ${below.length === 1 ? 'inherits' : 'inherit'} from ${type.label}: a base type inherits from none.`,
    );
  return inheritFrom(type, base);
}

// What an `add` or `set` may change only on a type that inherits from none, as the change names them.
export interface InheritedPartsInput {
  statuses?: unknown;
  defaultStatus?: unknown;
  display?: unknown;
  tabs?: unknown;
  detailsLabel?: unknown;
  assigneeNotifies?: unknown;
}

const PART_NAMES: Readonly<Record<keyof InheritedPartsInput, string>> = {
  statuses: 'statuses',
  defaultStatus: 'Default State',
  display: 'display',
  tabs: 'tabs',
  detailsLabel: 'Details name',
  assigneeNotifies: 'Assignee notifications',
};

// Refuses a change to what an inherited `type` takes from its base: one of its parts, or an inherited field named in
// `fields` (removed or edited). Nothing for a type that inherits from none.
export function refuseInheritedEdits(
  type: ItemTypeDef,
  parts: InheritedPartsInput,
  fields: readonly string[],
  types: readonly ItemTypeDef[],
): void {
  const base = baseOf(type, types);
  if (!base) return;
  const tail = `change ${base.label}, or detach ${type.label} with inherits: null.`;
  for (const key of Object.keys(PART_NAMES) as (keyof InheritedPartsInput)[]) {
    if (parts[key] !== undefined)
      throw invalid(`${type.label} takes its ${PART_NAMES[key]} from ${base.label}: ${tail}`);
  }
  const inherited = inheritedFieldIds(type, types);
  const hit = fields.find((f) => inherited.has(f));
  if (hit) {
    const name = (base.custom ?? []).find((c) => c.id === hit)?.label ?? hit;
    throw invalid(`${type.label} takes "${name}" from ${base.label}: ${tail}`);
  }
}

// An inherited `type` after its own edits: every field its base lacks is its own, resolved against the base. A type
// that inherits from none is answered as it is.
export function withOwnFields(type: ItemTypeDef, types: readonly ItemTypeDef[]): ItemTypeDef {
  const base = baseOf(type, types);
  if (!base) return type;
  const inherited = inheritedFieldIds(type, types);
  return resolveChild({ ...type, ownFields: type.fields.filter((f) => !inherited.has(f)) }, base);
}
