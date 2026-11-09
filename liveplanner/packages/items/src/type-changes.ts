// Changing card types by name (docs/specs/026-plan/plan-agents.md "Changing card types"): an agent's add, set,
// delete and restore changes applied in order to a project's catalogue, the way the type editor makes them. The
// whole result is checked by validateItemTypeCatalogue before anything is saved; any refusal saves nothing.
import { Refused, invalid } from './type-change-refused';
import { resolveRollups, type PendingRollups } from './type-change-rollups';
import type { ItemTypeDef } from './item-types';
import type { PlanStatusName } from './plan-outline';
import { fieldKeyOf, resolveStatus, resolveType } from './plan-names';
import { statusKey } from './status-names';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEM_TYPES_MAX,
  ITEM_TYPE_STATUSES_MAX,
  PLAN_TYPE_COLOURS,
  REQUIRED_TYPE_FIELDS,
  defaultNewTitle,
  isBuiltInFieldId,
  newItemTypeId,
  requiredFieldsOf,
  typesOf,
  validateItemTypeCatalogue,
  type ItemTypeCatalogue,
} from './type-catalogue';
import { defaultTypesToAdd } from './brought-types';
import { refuseInheritedEdits, withBase, withOwnFields } from './type-change-inherit';
import { withInheritance } from './type-inheritance';
import {
  builtInFieldOf,
  colourOf,
  glyphOf,
  must,
  withAssigneeNotifies,
  withFace,
  withOnCardShown,
} from './type-change-parts';
import {
  customOf,
  editedCustom,
  resolveFormulas,
  type PendingFormulas,
} from './type-change-fields';
import type { CardTypeChange, TypeChangesResult } from './type-change-inputs';

// The changes' shapes, the type-level parts and the custom fields live in their own modules; this entry keeps every
// export.
export type { CardTypeChange, CustomFieldEdit, CustomFieldInput } from './type-change-inputs';

// A new type's starting look and fields (blueprints/DEFAULTS.md D10): what the type editor's Add Type opens on.
export const NEW_ITEM_TYPE: Omit<ItemTypeDef, 'id' | 'newTitle'> = {
  label: '',
  color: PLAN_TYPE_COLOURS[11],
  glyph: 'star',
  fields: ['title', 'status', 'description', 'assignee'],
};

// What a change's line adds when its Default State names a column no board has yet (docs/specs/026-plan/plan-agents.md
// "Changing card types"): the type is made or kept without one, since a board's column places its cards anyway.
export const DEFAULT_STATUS_PENDING = (name: string) =>
  `no Default State, no board has a column ${JSON.stringify(name)} yet; set it once one does`;

// A Default State by column name: the status id when a board has that column, else the note saying it was left out.
function defaultStatusOf(
  name: string,
  statuses: readonly PlanStatusName[],
): { status: string } | { pending: string } {
  const named = resolveStatus(name, statuses);
  return named.ok ? { status: named.status } : { pending: DEFAULT_STATUS_PENDING(name) };
}

// A type's ordered status list by column names or statuses, each once (docs/specs/026-plan/item-types.md "The
// statuses a type uses").
function statusesOf(names: readonly string[], statuses: readonly PlanStatusName[]): string[] {
  const list = [...new Set(names.map((n) => must(resolveStatus(n, statuses)).status))];
  if (list.length > ITEM_TYPE_STATUSES_MAX)
    throw invalid(`A card type can use at most ${ITEM_TYPE_STATUSES_MAX} statuses.`);
  return list;
}

// A type with `list` as the statuses it uses, in place of any legacy exclusions.
function withStatusList(type: ItemTypeDef, list: readonly string[]): ItemTypeDef {
  const next = { ...type, statuses: list };
  delete next.excludedStatuses;
  return next;
}

// A catalogue refusal with the type it names: "Bug: types[3].fields", so a base change that takes a type inheriting
// from it past a cap says which.
function namedReason(reason: string, types: readonly ItemTypeDef[]): string {
  const at = /^types\[(\d+)\]/.exec(reason);
  const type = at ? types[Number(at[1])] : undefined;
  return type ? `${type.label}: ${reason}` : reason;
}

// The catalogue after `changes`, in order, each seeing the ones before it.
export function applyCardTypeChanges(
  stored: ItemTypeCatalogue | null | undefined,
  changes: readonly CardTypeChange[],
  statuses: readonly PlanStatusName[],
): TypeChangesResult {
  let types: ItemTypeDef[] = [...typesOf(stored)];
  const applied: string[] = [];
  const deleted: string[] = [];
  const replace = (next: ItemTypeDef) => {
    types = types.map((t) => (t.id === next.id ? next : t));
  };
  // A type renamed earlier in the batch still answers to its former name, so later changes can name it either way.
  const formerNames = new Map<string, string>();
  const typeNamed = (name: string): ItemTypeDef => {
    const id = formerNames.get(statusKey(name));
    const renamed = id ? types.find((t) => t.id === id) : undefined;
    const named = resolveType(name, types);
    return !named.ok && renamed ? renamed : must(named).type;
  };
  try {
    for (const c of changes) {
      if (c.op === 'add') {
        const name = c.name.trim();
        if (types.some((t) => statusKey(t.label) === statusKey(name)))
          throw invalid(`A card type "${name}" already exists.`);
        let type: ItemTypeDef = {
          ...NEW_ITEM_TYPE,
          id: newItemTypeId(name, types),
          label: name,
          newTitle: defaultNewTitle(name),
          ...(c.color ? { color: colourOf(c.color) } : {}),
          ...(c.glyph ? { glyph: glyphOf(c.glyph) } : {}),
        };
        if (c.fields) {
          const extra = c.fields.map((f) => builtInFieldOf(f, type));
          type = { ...type, fields: [...new Set([...REQUIRED_TYPE_FIELDS, ...extra])] };
        }
        const formulas: PendingFormulas = new Map();
        const rollups: PendingRollups = new Map();
        for (const input of c.custom ?? []) {
          const field = customOf(input, type, types, formulas, rollups);
          type = {
            ...type,
            custom: [...(type.custom ?? []), field],
            fields: [...type.fields, field.id],
          };
        }
        type = resolveRollups(resolveFormulas(type, formulas), [...types, type], rollups);
        // A base type takes the place of the parts it gives: naming them too is refused, as on an inherited type.
        const base = c.inherits === undefined ? null : typeNamed(c.inherits);
        if (base) refuseInheritedEdits({ ...type, inherits: base.id }, c, [], [...types, type]);
        // Every status the boards name when none are given, as the type editor's Add Type starts one.
        const every = statuses.map((s) => s.status);
        if (c.statuses) type = withStatusList(type, statusesOf(c.statuses, statuses));
        else if (every.length <= ITEM_TYPE_STATUSES_MAX) type = withStatusList(type, every);
        const start = c.defaultStatus ? defaultStatusOf(c.defaultStatus, statuses) : null;
        if (start && 'status' in start) type = { ...type, defaultStatus: start.status };
        type = withFace(type, c);
        type = withAssigneeNotifies(type, c.assigneeNotifies);
        type = withOnCardShown(
          type,
          (type.custom ?? []).filter((f) => f.onCard).map((f) => f.id),
        );
        if (base) type = withBase(type, base, types);
        types = [...types, type];
        const made = (type.custom ?? []).map((f) => `${f.label} (${f.id})`);
        applied.push(
          `+ ${type.label} (${type.id})${made.length ? `: ${made.join(', ')}` : ''}` +
            (start && 'pending' in start ? `; ${start.pending}` : ''),
        );
      } else if (c.op === 'set') {
        let type = typeNamed(c.type);
        const id = type.id;
        if (c.inherits !== undefined)
          type = withBase(type, c.inherits === null ? null : typeNamed(c.inherits), types);
        // What an inherited type takes from its base can't change here (type-change-inherit.ts).
        refuseInheritedEdits(
          type,
          c,
          // A name not found yet (a field this change adds first) is left to the edit that reads it.
          [
            ...(c.removeFields ?? []),
            ...(c.removeCustom ?? []),
            ...(c.editCustom ?? []).map((e) => e.field),
          ]
            .map((f) => fieldKeyOf(f, type))
            .flatMap((named) => (named.ok ? [named.key] : [])),
          types,
        );
        if (c.name !== undefined) {
          const name = c.name.trim();
          if (types.some((t) => t.id !== id && statusKey(t.label) === statusKey(name)))
            throw invalid(`A card type "${name}" already exists.`);
          formerNames.set(statusKey(type.label), id);
          type = { ...type, label: name, newTitle: defaultNewTitle(name) };
        }
        if (c.color) type = { ...type, color: colourOf(c.color) };
        if (c.glyph) type = { ...type, glyph: glyphOf(c.glyph) };
        for (const f of c.addFields ?? []) {
          const key = builtInFieldOf(f, type);
          if (!type.fields.includes(key)) type = { ...type, fields: [...type.fields, key] };
        }
        for (const f of c.removeFields ?? []) {
          const key = builtInFieldOf(f, type);
          if (requiredFieldsOf(id).includes(key))
            throw invalid(`${type.label} cards always have ${key}: it cannot be removed.`);
          type = { ...type, fields: type.fields.filter((x) => x !== key) };
        }
        // The fields this change ticks Show on Card, by id, so a rename in the same edit still finds them.
        const ticked: string[] = [];
        const formulas: PendingFormulas = new Map();
        const rollups: PendingRollups = new Map();
        for (const input of c.addCustom ?? []) {
          const field = customOf(input, type, types, formulas, rollups);
          if (input.onCard) ticked.push(field.id);
          type = {
            ...type,
            custom: [...(type.custom ?? []), field],
            fields: [...type.fields, field.id],
          };
        }
        for (const edit of c.editCustom ?? []) {
          if (edit.onCard === true) ticked.push(must(fieldKeyOf(edit.field, type)).key);
          type = editedCustom(type, edit, types, formulas, rollups);
        }
        for (const name of c.removeCustom ?? []) {
          const key = must(fieldKeyOf(name, type)).key;
          if (isBuiltInFieldId(key))
            throw invalid(`"${name}" is a built-in field: use removeFields.`);
          type = {
            ...type,
            custom: (type.custom ?? []).filter((f) => f.id !== key),
            fields: type.fields.filter((f) => f !== key),
            ...(type.tabs
              ? {
                  tabs: type.tabs.map((t) => ({ ...t, fields: t.fields.filter((f) => f !== key) })),
                }
              : {}),
          };
        }
        type = resolveRollups(resolveFormulas(type, formulas), types, rollups);
        if (c.statuses) type = withStatusList(type, statusesOf(c.statuses, statuses));
        if (c.defaultStatus === null) {
          const { defaultStatus: _gone, ...rest } = type;
          type = rest;
        }
        const start = c.defaultStatus ? defaultStatusOf(c.defaultStatus, statuses) : null;
        if (start && 'status' in start) type = { ...type, defaultStatus: start.status };
        type = withFace(type, c);
        type = withAssigneeNotifies(type, c.assigneeNotifies);
        // The fields this change ticked Show on Card: placed on a type whose Display is its own (never an inherited
        // type's: its Display is its base's).
        type = type.inherits ? withOwnFields(type, types) : withOnCardShown(type, ticked);
        replace(type);
        applied.push(
          `~ ${type.label} (${type.id})` +
            (start && 'pending' in start ? `; ${start.pending}` : ''),
        );
      } else if (c.op === 'delete') {
        const type = typeNamed(c.type);
        types = types.filter((t) => t.id !== type.id);
        deleted.push(type.id);
        applied.push(`- ${type.label} (${type.id})`);
      } else {
        const missing = defaultTypesToAdd(types);
        types = [...types, ...missing].slice(0, Math.max(types.length, ITEM_TYPES_MAX));
        applied.push(
          missing.length
            ? `+ ${missing.map((t) => `${t.label} (${t.id})`).join(', ')}`
            : '= every default card type is here already',
        );
      }
      // A base changed or deleted reaches the types inheriting from it before the next change reads them.
      types = [...withInheritance(types)];
    }
  } catch (err) {
    if (err instanceof Refused) return { ok: false, applied, ...err.refusal };
    throw err;
  }
  const checked = validateItemTypeCatalogue({ version: ITEM_TYPE_CATALOGUE_VERSION, types });
  if (!checked.ok)
    return {
      ok: false,
      applied,
      code: 'type_change_invalid',
      message: `The card types would break a rule (${namedReason(checked.reason, types)}); nothing was saved.`,
    };
  // A project whose card types are not chosen, left with none: nothing to store.
  const none = stored == null && types.length === 0;
  return { ok: true, catalogue: none ? null : checked.catalogue, applied, deleted };
}
