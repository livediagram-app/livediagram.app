// Changing card types by name (docs/specs/026-plan/plan-agents.md "Changing card types"): an agent's add, set,
// delete and restore changes applied in order to a project's catalogue, the way the type editor makes them. The
// whole result is checked by validateItemTypeCatalogue before anything is saved; any refusal saves nothing.
import { withArticle } from './indefinite-article';
import { CALCULATION_LABELS } from './calculated-fields';
import { isFormulaField } from './formula-fields';
import { FORMULA_RESULTS, FORMULA_RESULT_DEFAULT } from './formula/limits';
import { formulaScopeOf, storedFormula } from './formula/references';
import { HEX_COLOUR } from './validate';
import { PLAN_GLYPH_IDS, isPlanGlyphId, type PlanGlyphId } from './glyphs';
import {
  COMMON_CURRENCIES,
  CURRENCY_CODE,
  CURRENCY_DEFAULT,
  CALCULATIONS,
  CUSTOM_FIELD_KINDS,
  RATING_FIELD_SCALE_DEFAULT,
  RATING_FIELD_SCALE_MAX,
  RATING_FIELD_SCALE_MIN,
  type CustomFieldDef,
  type ItemTypeDef,
  withLinkTypes,
  type Calculation,
} from './item-types';
import type { PlanStatusName } from './plan-outline';
import { fieldKeyOf, resolveStatus, resolveType, type NameRefusal } from './plan-names';
import { statusKey } from './status-names';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEM_TYPES_MAX,
  ITEM_TYPE_STATUSES_MAX,
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
import { canBeRequired } from './required-fields';
import { holdsSeveralKind } from './several-values';
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
  // A Card field's target card types, by id or name (docs/specs/026-plan/item-types.md "Card fields"); merged after
  // `linkType` when both are given.
  linkTypes?: readonly string[];
  // A Currency field's ISO 4217 code; GBP when absent.
  currency?: string;
  // A Calculated field's calculation, by id (`childCount`) or name ("Child Count").
  calculation?: string;
  // A Formula's expression, written with field names, and its result kind (docs/specs/026-plan/item-types.md
  // "Formula fields").
  formula?: string;
  result?: string;
  onCard?: boolean;
  // Required (docs/specs/026-plan/item-types.md "Required fields"); never a checkbox.
  required?: boolean;
  // A Person field tells its person when a card is theirs (item-types.md "Notifies"); only a Person field.
  notifies?: boolean;
  // A Person or Card field holds several people or cards (item-types.md "Holds Several"); only those kinds.
  multiple?: boolean;
}

// An existing custom field edited in place: renamed, its options replaced (a Choice field), drawn on the card or not.
// Values on cards stay as they are.
export interface CustomFieldEdit {
  field: string;
  name?: string;
  options?: readonly string[];
  // A Card field's card types, replaced whole, by id or name.
  linkTypes?: readonly string[];
  currency?: string;
  // A Calculated field's calculation, by id or name.
  calculation?: string;
  // A Formula's expression (field names) and result kind.
  formula?: string;
  result?: string;
  onCard?: boolean;
  // true makes it required, false optional again.
  required?: boolean;
  // A Person field: true tells its person when a card is theirs, false stops.
  notifies?: boolean;
  // A Person or Card field: true holds several, false holds one (the cards' values are kept as they are).
  multiple?: boolean;
}

// A type's card face and panel (type-change-face.ts), as `add` and `set` take them.
interface FaceInput {
  display?: DisplayInput;
  tabs?: readonly TabInput[];
  detailsLabel?: string;
}

// Whether the Assignee tells its person when a card is theirs (item-types.md "Notifies"), as `add` and `set` take it;
// absent leaves it as it is.
interface NotifyInput {
  assigneeNotifies?: boolean;
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
      // The statuses it uses, in order, by column name or status; absent, every status the boards name.
      statuses?: readonly string[];
    } & FaceInput &
      NotifyInput)
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
      // The whole ordered list of the statuses it uses, by column name or status.
      statuses?: readonly string[];
    } & FaceInput &
      NotifyInput)
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

// Card types named by id or name, as ids, each once: never more than the catalogue holds, so never past
// CARD_LINK_TYPES_MAX.
function cardTypeIds(names: readonly string[], types: readonly ItemTypeDef[]): string[] {
  return [...new Set(names.map((n) => must(resolveType(n, types)).type.id))];
}

function editedCustom(
  type: ItemTypeDef,
  edit: CustomFieldEdit,
  types: readonly ItemTypeDef[],
  formulas: PendingFormulas,
): ItemTypeDef {
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
  if (edit.linkTypes) {
    if (field.kind !== 'card')
      throw invalid(
        `"${field.label}" is ${withArticle(field.kind)} field: only a card field links to card types.`,
      );
    if (edit.linkTypes.length === 0)
      throw invalid(`"${field.label}" needs at least one card type to link to.`);
    // Replaced whole: a list of one drops the stored list.
    delete next.linkTypes;
    Object.assign(next, withLinkTypes(next, cardTypeIds(edit.linkTypes, types)));
  }
  if (edit.currency) {
    if (field.kind !== 'currency' && !isFormulaField(field))
      throw invalid(
        `"${field.label}" is ${withArticle(field.kind)} field: only a currency field has a currency.`,
      );
    const code = currencyOf(edit.currency);
    if (code === CURRENCY_DEFAULT) delete next.currency;
    else next.currency = code;
  }
  if (edit.calculation !== undefined) {
    if (field.kind !== 'calculated')
      throw invalid(
        `"${field.label}" is ${withArticle(field.kind)} field: only a calculated field has a calculation.`,
      );
    next.calculation = calculationNamed(field.label, edit.calculation);
  }
  withFormula(next, edit, formulas, field.formula === undefined);
  if (edit.onCard === true) next.onCard = true;
  if (edit.onCard === false) delete next.onCard;
  if (edit.required === true) next.required = requirable(field);
  if (edit.required === false) delete next.required;
  if (edit.notifies === true) next.notifies = notifiable(field);
  if (edit.notifies === false) delete next.notifies;
  if (edit.multiple === true) next.multiple = severalable(field);
  if (edit.multiple === false) delete next.multiple;
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
  formulas: PendingFormulas,
): CustomFieldDef {
  const typed = input.kind
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  // An American agent's "color" is the Colour kind.
  const kind = typed === 'color' ? 'colour' : typed;
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
    const named = [...(input.linkType ? [input.linkType] : []), ...(input.linkTypes ?? [])];
    if (named.length === 0)
      throw invalid(
        `The Card field "${name}" needs linkTypes: the card types it links to (or linkType, one).`,
      );
    Object.assign(field, withLinkTypes(field, cardTypeIds(named, types)));
  }
  if (known === 'calculated') field.calculation = calculationNamed(name, input.calculation);
  else if (input.calculation !== undefined)
    throw invalid(
      `"${name}" is ${withArticle(known)} field: only a calculated field has a calculation.`,
    );
  withFormula(field, input, formulas, true);
  if ((known === 'currency' || field.result === 'currency') && input.currency) {
    const code = currencyOf(input.currency);
    if (code !== CURRENCY_DEFAULT) field.currency = code;
  }
  if (input.onCard) field.onCard = true;
  if (input.required) field.required = requirable(field);
  if (input.notifies) field.notifies = notifiable(field);
  if (input.multiple) field.multiple = severalable(field);
  return field;
}

// Formulas written with names this change still has to store with ids, by field id: resolved once the type holds
// every field the change adds (resolveFormulas), so a formula may name a field added after it.
type PendingFormulas = Map<string, string>;

const resultKey = (s: string) => s.trim().toLowerCase();

// A Formula's settings from a change (docs/specs/026-plan/item-types.md "Formula fields"): its result kind and its
// expression (queued for resolveFormulas); refused on a field that is no Formula, and a new Formula needs one.
function withFormula(
  field: { -readonly [K in keyof CustomFieldDef]: CustomFieldDef[K] },
  input: { formula?: string; result?: string },
  formulas: PendingFormulas,
  needsFormula: boolean,
): void {
  const formula = isFormulaField(field);
  if (!formula) {
    if (input.formula !== undefined || input.result !== undefined)
      throw invalid(
        `"${field.label}" is no formula: only a calculated field whose calculation is formula has one.`,
      );
    delete field.formula;
    delete field.result;
    return;
  }
  if (input.result !== undefined) {
    const result = FORMULA_RESULTS.find((r) => r === resultKey(input.result!));
    if (!result) throw invalid(`A formula's result is one of ${FORMULA_RESULTS.join(', ')}.`);
    if (result === FORMULA_RESULT_DEFAULT) delete field.result;
    else field.result = result;
    if (result !== 'currency') delete field.currency;
  }
  if (input.formula !== undefined) formulas.set(field.id, input.formula);
  else if (needsFormula)
    throw invalid(
      `The formula field "${field.label}" needs a formula, written with field names: "Budget - Spent".`,
    );
}

// Each queued formula stored with ids against the type as the change leaves it; a field the change removed is
// skipped, and a formula that can't be read is refused with its problem.
function resolveFormulas(type: ItemTypeDef, formulas: PendingFormulas): ItemTypeDef {
  if (formulas.size === 0) return type;
  const scope = formulaScopeOf(type);
  const custom = (type.custom ?? []).map((f) => {
    const text = formulas.get(f.id);
    if (text === undefined) return f;
    const stored = storedFormula(text, scope, f.id);
    if (!stored.ok) throw invalid(`The formula for "${f.label}" doesn't work: ${stored.error}.`);
    return { ...f, formula: stored.formula };
  });
  formulas.clear();
  return { ...type, custom };
}

// "a, b or c".
const orList = (xs: readonly string[]) =>
  xs.length > 1 ? `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}` : xs.join('');

// A calculation as an agent names it: its id (`childCount`) or its name ("Child Count"), any case or spacing.
const calcKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
function calculationNamed(field: string, named: string | undefined): Calculation {
  const key = calcKey(named ?? '');
  const found = CALCULATIONS.find(
    (c) => calcKey(c) === key || calcKey(CALCULATION_LABELS[c]) === key,
  );
  if (!found)
    throw invalid(
      `The calculated field "${field}" needs a calculation: ${orList(CALCULATIONS.map((c) => `${c} (${CALCULATION_LABELS[c]})`))}.`,
    );
  return found;
}

// `true`, for a field that can be required; a checkbox (unticked reads as empty) and a calculated field (the plan
// works it out) are refused.
function requirable(field: Pick<CustomFieldDef, 'kind' | 'label'>): true {
  if (!canBeRequired(field.kind))
    throw invalid(
      field.kind === 'checkbox'
        ? `"${field.label}" is a checkbox: a checkbox can't be required.`
        : `"${field.label}" is calculated: the plan works it out, so it can't be required.`,
    );
  return true;
}

// `true`, for a Person field: no other kind names someone to tell.
function notifiable(field: Pick<CustomFieldDef, 'kind' | 'label'>): true {
  if (field.kind !== 'person')
    throw invalid(
      `"${field.label}" is ${withArticle(field.kind)} field: only a person field notifies.`,
    );
  return true;
}

// `true`, for a Person or Card field: no other kind holds several people or cards.
function severalable(field: Pick<CustomFieldDef, 'kind' | 'label'>): true {
  if (!holdsSeveralKind(field.kind))
    throw invalid(
      `"${field.label}" is ${withArticle(field.kind)} field: only a person or card field holds several.`,
    );
  return true;
}

// The Assignee's Notifies switch: kept only as false, so a type that tells its assignee is stored as before.
function withAssigneeNotifies(type: ItemTypeDef, on: boolean | undefined): ItemTypeDef {
  if (on === undefined) return type;
  const { assigneeNotifies: _was, ...rest } = type;
  return on ? rest : { ...rest, assigneeNotifies: false };
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
        for (const input of c.custom ?? []) {
          const field = customOf(input, type, types, formulas);
          type = {
            ...type,
            custom: [...(type.custom ?? []), field],
            fields: [...type.fields, field.id],
          };
        }
        type = resolveFormulas(type, formulas);
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
        const formulas: PendingFormulas = new Map();
        for (const input of c.addCustom ?? []) {
          const field = customOf(input, type, types, formulas);
          if (input.onCard) ticked.push(field.id);
          type = {
            ...type,
            custom: [...(type.custom ?? []), field],
            fields: [...type.fields, field.id],
          };
        }
        for (const edit of c.editCustom ?? []) {
          if (edit.onCard === true) ticked.push(must(fieldKeyOf(edit.field, type)).key);
          type = editedCustom(type, edit, types, formulas);
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
        type = resolveFormulas(type, formulas);
        if (c.statuses) type = withStatusList(type, statusesOf(c.statuses, statuses));
        if (c.defaultStatus === null) {
          const { defaultStatus: _gone, ...rest } = type;
          type = rest;
        }
        const start = c.defaultStatus ? defaultStatusOf(c.defaultStatus, statuses) : null;
        if (start && 'status' in start) type = { ...type, defaultStatus: start.status };
        type = withFace(type, c);
        type = withAssigneeNotifies(type, c.assigneeNotifies);
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
