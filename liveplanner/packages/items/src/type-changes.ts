// Changing card types by name (docs/specs/026-plan/plan-agents.md "Changing card types"): an agent's add, set,
// delete and restore changes applied in order to a project's catalogue, the way the type editor makes them. The
// whole result is checked by validateItemTypeCatalogue before anything is saved; any refusal saves nothing.
import { withArticle } from './indefinite-article';
import { HEX_COLOUR } from './validate';
import { PLAN_GLYPH_IDS, isPlanGlyphId, type PlanGlyphId } from './glyphs';
import {
  COMMON_CURRENCIES,
  CURRENCY_CODE,
  CURRENCY_DEFAULT,
  CUSTOM_FIELD_KINDS,
  RATING_FIELD_SCALE_DEFAULT,
  RATING_FIELD_SCALE_MAX,
  RATING_FIELD_SCALE_MIN,
  type CustomFieldDef,
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
import type { CardField } from './board';
import type { CardLayout } from './card-display';
import {
  detailsLabelFrom,
  displayFrom,
  tabsFrom,
  type DisplayInput,
  type FaceRead,
  type TabInput,
} from './type-change-face';

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
  // A Rating field's top score, 3 to 10; 5 when absent.
  scale?: number;
  // A Card field's target card type, by id or name.
  linkType?: string;
  // A Currency field's ISO 4217 code; GBP when absent.
  currency?: string;
  onCard?: boolean;
}

// An existing custom field edited in place: renamed, its options replaced (a Choice field), drawn on the card or not.
// Values on cards stay as they are.
export interface CustomFieldEdit {
  field: string;
  name?: string;
  options?: readonly string[];
  currency?: string;
  onCard?: boolean;
}

// A type's card face and panel (type-change-face.ts), as `add` and `set` take them.
interface FaceInput {
  display?: DisplayInput;
  tabs?: readonly TabInput[];
  detailsLabel?: string;
}

export type CardTypeChange =
  | ({
      op: 'add';
      name: string;
      color?: string;
      glyph?: string;
      fields?: readonly string[];
      custom?: readonly CustomFieldInput[];
      defaultStatus?: string;
      excludedStatuses?: readonly string[];
    } & FaceInput)
  | ({
      op: 'set';
      type: string;
      name?: string;
      color?: string;
      glyph?: string;
      addFields?: readonly string[];
      removeFields?: readonly string[];
      addCustom?: readonly CustomFieldInput[];
      editCustom?: readonly CustomFieldEdit[];
      removeCustom?: readonly string[];
      // A status, or null to clear the Default State.
      defaultStatus?: string | null;
      excludedStatuses?: readonly string[];
    } & FaceInput)
  | { op: 'delete'; type: string }
  // Any of the five default types the project lacks, after its types (docs/specs/026-plan/plan-agents.md); its
  // older name, `restore_built_ins`, does the same.
  | { op: 'add_default_types' }
  | { op: 'restore_built_ins' };

type TypeChangeRefusal =
  NameRefusal | { code: 'type_change_invalid' | 'display_invalid'; message: string };

type TypeChangesResult =
  | {
      ok: true;
      // The catalogue to store: null leaves the project's card types not chosen (none).
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

function face<T>(read: FaceRead<T>, code: 'type_change_invalid' | 'display_invalid'): T {
  if (!read.ok) throw new Refused({ code, message: read.message });
  return read.value;
}

// The face and panel `c` gives, on `type` as it stands after the change's fields.
function withFace(type: ItemTypeDef, c: FaceInput): ItemTypeDef {
  let next = type;
  if (c.display) {
    const display = face(displayFrom(c.display, next), 'display_invalid');
    const { display: _old, ...rest } = next;
    next = display ? { ...rest, display } : rest;
  }
  if (c.tabs) next = { ...next, tabs: face(tabsFrom(c.tabs, next), 'type_change_invalid') };
  if (c.detailsLabel !== undefined) {
    const label = face(detailsLabelFrom(c.detailsLabel), 'type_change_invalid');
    const { detailsLabel: _old, ...rest } = next;
    next = label ? { ...rest, detailsLabel: label } : rest;
  }
  return next;
}

function editedCustom(type: ItemTypeDef, edit: CustomFieldEdit): ItemTypeDef {
  const key = must(fieldKeyOf(edit.field, type)).key;
  const field = (type.custom ?? []).find((f) => f.id === key);
  if (!field)
    throw invalid(`"${edit.field}" is a built-in field: only custom fields are edited here.`);
  const next: { -readonly [K in keyof CustomFieldDef]: CustomFieldDef[K] } = { ...field };
  if (edit.name !== undefined) {
    const name = edit.name.trim();
    if ((type.custom ?? []).some((f) => f.id !== key && statusKey(f.label) === statusKey(name)))
      throw invalid(`${type.label} already has a field "${name}".`);
    next.label = name;
  }
  if (edit.options) {
    if (field.kind !== 'choice' && field.kind !== 'multichoice')
      throw invalid(
        `"${field.label}" is ${withArticle(field.kind)} field: only a choice or multichoice field has options.`,
      );
    next.options = edit.options.map((o) => o.trim());
  }
  if (edit.currency) {
    if (field.kind !== 'currency')
      throw invalid(
        `"${field.label}" is ${withArticle(field.kind)} field: only a currency field has a currency.`,
      );
    const code = currencyOf(edit.currency);
    if (code === CURRENCY_DEFAULT) delete next.currency;
    else next.currency = code;
  }
  if (edit.onCard === true) next.onCard = true;
  if (edit.onCard === false) delete next.onCard;
  const edited = { ...type, custom: (type.custom ?? []).map((f) => (f.id === key ? next : f)) };
  // Unticked, it leaves a Detailed Display of the type's own too.
  return edit.onCard === false ? withoutOnDetailed(edited, key) : edited;
}

// A custom field ticked Show on Card shows on a Detailed card. Without a Display of its own the type's default layout
// already puts it Under the Title (typeCardLayout); with one, the tick must place it there too, at the end of the body,
// or it would not show at all.
function withOnCardShown(type: ItemTypeDef, ids: readonly string[]): ItemTypeDef {
  const own = type.display?.detailed;
  if (!own || ids.length === 0) return type;
  const placed = new Set(Object.values(own).flat());
  // Still the type's (one removed later in the same change is not placed) and not placed already.
  const added = ids.filter(
    (id) => (type.custom ?? []).some((f) => f.id === id) && !placed.has(id as CardField),
  ) as CardField[];
  if (added.length === 0) return type;
  return {
    ...type,
    display: { ...type.display, detailed: { ...own, body: [...(own.body ?? []), ...added] } },
  };
}

function withoutOnDetailed(type: ItemTypeDef, id: string): ItemTypeDef {
  const own = type.display?.detailed;
  if (!own) return type;
  const detailed = Object.fromEntries(
    Object.entries(own).map(([slot, fields]) => [slot, fields.filter((f) => f !== id)]),
  ) as CardLayout;
  return { ...type, display: { ...type.display, detailed } };
}

function must<T extends object>(named: ({ ok: true } & T) | ({ ok: false } & NameRefusal)): T {
  if (!named.ok) throw new Refused({ code: named.code, message: named.message });
  return named;
}

function colourOf(input: string): string {
  const hex = input.trim().toLowerCase();
  if (HEX_COLOUR.test(hex)) return hex;
  throw invalid(
    `"${input}" is not a colour. Give a #rrggbb colour, for example ${PLAN_TYPE_COLOURS.join(', ')}.`,
  );
}

function currencyOf(input: string): string {
  const code = input.trim().toUpperCase();
  if (CURRENCY_CODE.test(code)) return code;
  throw invalid(
    `"${input}" is not a currency code. Give an ISO 4217 code, for example ${COMMON_CURRENCIES.join(', ')}.`,
  );
}

function glyphOf(input: string): PlanGlyphId {
  const id = input.trim().toLowerCase();
  if (isPlanGlyphId(id)) return id;
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
    kind: known,
  };
  if (known === 'choice' || known === 'multichoice')
    field.options = (input.options ?? []).map((o) => o.trim());
  if (known === 'rating' && input.scale !== undefined) {
    if (
      !Number.isInteger(input.scale) ||
      input.scale < RATING_FIELD_SCALE_MIN ||
      input.scale > RATING_FIELD_SCALE_MAX
    )
      throw invalid(
        `A rating's scale is a whole number from ${RATING_FIELD_SCALE_MIN} to ${RATING_FIELD_SCALE_MAX}.`,
      );
    if (input.scale !== RATING_FIELD_SCALE_DEFAULT) field.scale = input.scale;
  }
  if (known === 'card') {
    if (!input.linkType)
      throw invalid(`The Card field "${name}" needs linkType: the card type it links to.`);
    field.linkType = must(resolveType(input.linkType, types)).type.id;
  }
  if (known === 'currency' && input.currency) {
    const code = currencyOf(input.currency);
    if (code !== CURRENCY_DEFAULT) field.currency = code;
  }
  if (input.onCard) field.onCard = true;
  return field;
}

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
        const start = c.defaultStatus ? defaultStatusOf(c.defaultStatus, statuses) : null;
        if (start && 'status' in start) type = { ...type, defaultStatus: start.status };
        type = withFace(type, c);
        type = withOnCardShown(
          type,
          (type.custom ?? []).filter((f) => f.onCard).map((f) => f.id),
        );
        types = [...types, type];
        const made = (type.custom ?? []).map((f) => `${f.label} (${f.id})`);
        applied.push(
          `+ ${type.label} (${type.id})${made.length ? `: ${made.join(', ')}` : ''}` +
            (start && 'pending' in start ? `; ${start.pending}` : ''),
        );
      } else if (c.op === 'set') {
        let type = typeNamed(c.type);
        const id = type.id;
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
        for (const input of c.addCustom ?? []) {
          const field = customOf(input, type, types);
          if (input.onCard) ticked.push(field.id);
          type = {
            ...type,
            custom: [...(type.custom ?? []), field],
            fields: [...type.fields, field.id],
          };
        }
        for (const edit of c.editCustom ?? []) {
          if (edit.onCard === true) ticked.push(must(fieldKeyOf(edit.field, type)).key);
          type = editedCustom(type, edit);
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
        }
        const start = c.defaultStatus ? defaultStatusOf(c.defaultStatus, statuses) : null;
        if (start && 'status' in start) type = { ...type, defaultStatus: start.status };
        type = withFace(type, c);
        // The fields this change ticked Show on Card: placed on a type whose Display is its own.
        type = withOnCardShown(type, ticked);
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
  // A project whose card types are not chosen, left with none: nothing to store.
  const none = stored == null && types.length === 0;
  return { ok: true, catalogue: none ? null : checked.catalogue, applied, deleted };
}
