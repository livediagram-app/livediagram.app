// Changing card types by name (docs/specs/026-plan/plan-agents.md "Changing card types"): an agent's add, set,
// delete and restore changes applied in order to a document's catalogue, the way the type editor makes them. The
// whole result is checked by validateItemTypeCatalogue before anything is saved; any refusal saves nothing.
import { PLAN_GLYPH_IDS } from './glyphs';
import {
  CUSTOM_FIELD_KINDS,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemTypeDef,
} from './item-types';
import type { PlanStatusName } from './plan-outline';
import { fieldKeyOf, resolveStatus, resolveType, type NameRefusal } from './plan-names';
import { statusKey } from './status-names';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEM_TYPES_MAX,
  PLAN_TYPE_COLOURS,
  REQUIRED_TYPE_FIELDS,
  defaultNewTitle,
  isBuiltInFieldId,
  newCustomFieldId,
  newItemTypeId,
  requiredFieldsOf,
  typesOf,
  validateItemTypeCatalogue,
  type ItemTypeCatalogue,
} from './type-catalogue';
import { defaultTypesToAdd } from './brought-types';

// A new type's starting look and fields (blueprints/DEFAULTS.md D10): what the type editor's Add Type opens on.
export const NEW_ITEM_TYPE: Omit<ItemTypeDef, 'id' | 'newTitle'> = {
  label: '',
  color: PLAN_TYPE_COLOURS[11],
  glyph: 'star',
  fields: ['title', 'status', 'description', 'assignee'],
};

export interface CustomFieldInput {
  name: string;
  kind: string;
  options?: readonly string[];
  // A Card field's target card type, by id or name.
  linkType?: string;
  onCard?: boolean;
}

export type CardTypeChange =
  | {
      op: 'add';
      name: string;
      color?: string;
      glyph?: string;
      fields?: readonly string[];
      custom?: readonly CustomFieldInput[];
      defaultStatus?: string;
      excludedStatuses?: readonly string[];
    }
  | {
      op: 'set';
      type: string;
      name?: string;
      color?: string;
      glyph?: string;
      addFields?: readonly string[];
      removeFields?: readonly string[];
      addCustom?: readonly CustomFieldInput[];
      removeCustom?: readonly string[];
      // A status, or null to clear the Default State.
      defaultStatus?: string | null;
      excludedStatuses?: readonly string[];
    }
  | { op: 'delete'; type: string }
  // Any of the five default types the document lacks, after its types (docs/specs/026-plan/plan-agents.md); its
  // older name, `restore_built_ins`, does the same.
  | { op: 'add_default_types' }
  | { op: 'restore_built_ins' };

export type TypeChangeRefusal = NameRefusal | { code: 'type_change_invalid'; message: string };

export type TypeChangesResult =
  | {
      ok: true;
      // The catalogue to store: null leaves the document's card types not chosen (the default types).
      catalogue: ItemTypeCatalogue | null;
      // One line per change applied.
      applied: string[];
      // The ids of the types deleted, whose cards go to the Trash.
      deleted: string[];
    }
  | ({ ok: false; applied: string[] } & TypeChangeRefusal);

class Refused extends Error {
  readonly refusal: TypeChangeRefusal;
  constructor(refusal: TypeChangeRefusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}

const invalid = (message: string) => new Refused({ code: 'type_change_invalid', message });

function must<T extends object>(named: ({ ok: true } & T) | ({ ok: false } & NameRefusal)): T {
  if (!named.ok) throw new Refused({ code: named.code, message: named.message });
  return named;
}

function colourOf(input: string): string {
  const hex = input.trim().toLowerCase();
  if ((PLAN_TYPE_COLOURS as readonly string[]).includes(hex)) return hex;
  throw invalid(`"${input}" is not a Plan colour. Colours: ${PLAN_TYPE_COLOURS.join(', ')}.`);
}

function glyphOf(input: string): string {
  const id = input.trim().toLowerCase();
  if ((PLAN_GLYPH_IDS as readonly string[]).includes(id)) return id;
  throw invalid(`"${input}" is not a Plan glyph. Glyphs: ${PLAN_GLYPH_IDS.join(', ')}.`);
}

// A built-in field by id or interface name: with the custom fields set aside, fieldKeyOf can answer nothing else.
function builtInFieldOf(name: string, type: ItemTypeDef): string {
  return must(fieldKeyOf(name, { ...type, custom: [] })).key;
}

function customOf(
  input: CustomFieldInput,
  type: ItemTypeDef,
  types: readonly ItemTypeDef[],
): CustomFieldDef {
  const kind = input.kind
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  const known = CUSTOM_FIELD_KINDS.find((k) => k === kind);
  if (!known)
    throw invalid(
      `"${input.kind}" is not a custom field kind. Kinds: ${CUSTOM_FIELD_KINDS.join(', ')}.`,
    );
  const name = input.name.trim();
  if ((type.custom ?? []).some((f) => statusKey(f.label) === statusKey(name)))
    throw invalid(`${type.label} already has a field "${name}".`);
  const field: { -readonly [K in keyof CustomFieldDef]: CustomFieldDef[K] } = {
    id: newCustomFieldId(name, [...type.fields, ...(type.custom ?? []).map((f) => f.id)]),
    label: name,
    kind: known as CustomFieldKind,
  };
  if (known === 'choice') field.options = (input.options ?? []).map((o) => o.trim());
  if (known === 'card') {
    if (!input.linkType)
      throw invalid(`The Card field "${name}" needs linkType: the card type it links to.`);
    field.linkType = must(resolveType(input.linkType, types)).type.id;
  }
  if (input.onCard) field.onCard = true;
  return field;
}

function statusesOf(names: readonly string[], statuses: readonly PlanStatusName[]): string[] {
  return names.map((n) => must(resolveStatus(n, statuses)).status);
}

// The catalogue after `changes`, in order, each seeing the ones before it.
export function applyCardTypeChanges(
  stored: ItemTypeCatalogue | null | undefined,
  changes: readonly CardTypeChange[],
  statuses: readonly PlanStatusName[],
): TypeChangesResult {
  let types: ItemTypeDef[] = [...typesOf(stored)];
  // Only defaults added to a document whose card types are not chosen: nothing to store.
  let unchosen = stored == null;
  const applied: string[] = [];
  const deleted: string[] = [];
  const replace = (next: ItemTypeDef) => {
    types = types.map((t) => (t.id === next.id ? next : t));
  };
  try {
    for (const c of changes) {
      const addsDefaults = c.op === 'add_default_types' || c.op === 'restore_built_ins';
      if (!addsDefaults) unchosen = false;
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
        for (const input of c.custom ?? []) {
          const field = customOf(input, type, types);
          type = {
            ...type,
            custom: [...(type.custom ?? []), field],
            fields: [...type.fields, field.id],
          };
        }
        if (c.excludedStatuses)
          type = { ...type, excludedStatuses: statusesOf(c.excludedStatuses, statuses) };
        if (c.defaultStatus)
          type = { ...type, defaultStatus: must(resolveStatus(c.defaultStatus, statuses)).status };
        types = [...types, type];
        const made = (type.custom ?? []).map((f) => `${f.label} (${f.id})`);
        applied.push(`+ ${type.label} (${type.id})${made.length ? `: ${made.join(', ')}` : ''}`);
      } else if (c.op === 'set') {
        let type = must(resolveType(c.type, types)).type;
        const id = type.id;
        if (c.name !== undefined) {
          const name = c.name.trim();
          if (types.some((t) => t.id !== id && statusKey(t.label) === statusKey(name)))
            throw invalid(`A card type "${name}" already exists.`);
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
        for (const input of c.addCustom ?? []) {
          const field = customOf(input, type, types);
          type = {
            ...type,
            custom: [...(type.custom ?? []), field],
            fields: [...type.fields, field.id],
          };
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
        if (c.excludedStatuses)
          type = { ...type, excludedStatuses: statusesOf(c.excludedStatuses, statuses) };
        if (c.defaultStatus === null) {
          const { defaultStatus: _gone, ...rest } = type;
          type = rest;
        } else if (c.defaultStatus) {
          type = { ...type, defaultStatus: must(resolveStatus(c.defaultStatus, statuses)).status };
        }
        replace(type);
        applied.push(`~ ${type.label} (${type.id})`);
      } else if (c.op === 'delete') {
        const type = must(resolveType(c.type, types)).type;
        if (types.length === 1) throw invalid('The last card type cannot be deleted.');
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
      message: `The card types would break a rule (${checked.reason}); nothing was saved.`,
    };
  return { ok: true, catalogue: unchosen ? null : checked.catalogue, applied, deleted };
}
