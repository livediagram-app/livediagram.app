// A project's type catalogue (docs/specs/026-plan/item-types.md): its item types, in order. Absent
// (null) means the built-in catalogue, read from code; once changed, the whole catalogue is stored
// with the project. Validation here is the api's and the editor's both, so a catalogue the editor
// saves is one the api keeps.
import { readCardDisplay } from './card-display';
import { isPlanGlyphId } from './glyphs';
import { isCalculation } from './calculated-fields';
import {
  CARD_LINK_TYPES_MAX,
  CURRENCY_CODE,
  RATING_FIELD_SCALE_DEFAULT,
  RATING_FIELD_SCALE_MAX,
  RATING_FIELD_SCALE_MIN,
  CURRENCY_DEFAULT,
  CUSTOM_FIELD_KINDS,
  FALLBACK_ITEM_TYPE,
  ITEM_TYPES,
  PARENT_FIELD,
  PARENT_FIELD_ID,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemFieldId,
  type ItemTypeDef,
  type ItemTypeTab,
  linkTypesOf,
  withLinkTypes,
} from './item-types';
import { ITEM_STATUS_MAX, ITEM_TYPE_PATTERN } from './limits';
import { canBeRequired } from './required-fields';
import { holdsSeveralKind } from './several-values';
import { cutSlug, slugText, uniqueSlug } from './slug';
import { statusNamed } from './status-names';
import { HEX_COLOUR, isObj } from './validate';

export const ITEM_TYPES_MAX = 32;
export const ITEM_TYPE_FIELDS_MAX = 24;
export const ITEM_TYPE_CUSTOM_MAX = 12;

// How many custom fields count against ITEM_TYPE_CUSTOM_MAX: Parent never does, as it was a built-in field, so a
// stored type already at the cap still reads (and saves) once it gains the Parent Card field.
export function customFieldCount(custom: readonly unknown[]): number {
  return custom.filter((c) => !isObj(c) || c['id'] !== PARENT_FIELD_ID).length;
}
export const ITEM_TYPE_LABEL_MAX = 32;
export const CUSTOM_FIELD_LABEL_MAX = 32;
export const CUSTOM_CHOICE_OPTIONS_MAX = 20;
export const CUSTOM_CHOICE_OPTION_MAX = 100;
// The stored catalogue's JSON, at most (blueprint DEFAULTS: room for 32 full types).
const ITEM_TYPES_BYTES = 32_768;
export const ITEM_TYPE_CATALOGUE_VERSION = 1;
export const ITEM_TYPE_TABS_MAX = 6;
export const ITEM_TYPE_TAB_LABEL_MAX = 24;
const ITEM_TYPE_TAB_ID_PATTERN = /^t-[a-z0-9-]{1,30}$/;
// The most statuses a type stored before its ordered list could leave out (docs/specs/026-plan/item-types.md "The
// statuses a type uses": a legacy type). Read only: nothing writes an exclusion list any more.
export const ITEM_TYPE_EXCLUDED_STATUSES_MAX = 64;
// The most statuses a type uses (its ordered list): ten boards of twelve columns, and the catalogue stays small.
export const ITEM_TYPE_STATUSES_MAX = 128;
// The one tab a type without its own shows.
export const OVERVIEW_TAB_ID = 't-overview';

// The colours a type is given from: the default types' five (Project, Task, Note, Idea, Action), then
// seven more.
export const PLAN_TYPE_COLOURS = [
  '#18181b',
  '#71717a',
  '#2563eb',
  '#eab308',
  '#dc2626',
  '#16a34a',
  '#7c3aed',
  '#d97706',
  '#0d9488',
  '#db2777',
  '#ea580c',
  '#0891b2',
] as const;

// The built-in fields a type may offer, in the order the type editor offers them.
export const BUILT_IN_FIELD_IDS: readonly ItemFieldId[] = [
  'title',
  'description',
  'status',
  'assignee',
  'priority',
  'color',
  'labels',
  'estimate',
  'start',
  'due',
  'checklist',
  'attachments',
  'comments',
  'votes',
];

// Every type offers these, first, and they cannot be removed.
export const REQUIRED_TYPE_FIELDS: readonly ItemFieldId[] = ['title', 'status'];

// What a particular type always offers besides (docs/specs/026-plan/item-types.md "An item type"): a Project
// is drawn on the Gantt chart from its Start and Due, so it always has both. They can move, never come off.
const TYPE_REQUIRED_FIELDS: Readonly<Record<string, readonly ItemFieldId[]>> = {
  project: ['start', 'due'],
};

// Every field a type can never lose: Title and Status, then the type's own.
export function requiredFieldsOf(typeId: string | undefined): readonly string[] {
  const own = typeId ? TYPE_REQUIRED_FIELDS[typeId] : undefined;
  return own ? [...REQUIRED_TYPE_FIELDS, ...own] : REQUIRED_TYPE_FIELDS;
}

// A custom field's id: `f-` and a slug, or the reserved `parent` (PARENT_FIELD, a Card field).
export const CUSTOM_FIELD_ID_PATTERN = /^(?:f-[a-z0-9-]{1,30}|parent)$/;

// What is stored: the catalogue whole, with a version for later shapes.
export interface ItemTypeCatalogue {
  version: number;
  types: readonly ItemTypeDef[];
}

const BUILT_IN_FIELDS = new Set<string>(BUILT_IN_FIELD_IDS);

const NO_TYPES: readonly ItemTypeDef[] = [];

// The types a project's stored catalogue holds; none while its card types are not chosen (docs/specs/026-plan/
// item-types.md "The type catalogue": the default types arrive only through Add Default Types).
export function typesOf(stored: ItemTypeCatalogue | null | undefined): readonly ItemTypeDef[] {
  return stored?.types ?? NO_TYPES;
}

// A type by id within a catalogue; an unknown id (deleted, or an agent's) draws as "Item".
export function typeIn(types: readonly ItemTypeDef[], id: string): ItemTypeDef {
  return types.find((t) => t.id === id) ?? FALLBACK_ITEM_TYPE;
}

export function customFieldOf(type: ItemTypeDef, fieldId: string): CustomFieldDef | undefined {
  return type.custom?.find((f) => f.id === fieldId);
}

export function isBuiltInFieldId(id: string): id is ItemFieldId {
  return BUILT_IN_FIELDS.has(id);
}

// A lowercase slug of a name: letters and digits joined by single hyphens.
export function slugOf(label: string, max = 32): string {
  return cutSlug(slugText(label), max);
}

// A new type's id, made from its name and never changed (items store it).
export function newItemTypeId(label: string, types: readonly ItemTypeDef[]): string {
  let base = slugOf(label, 32);
  if (!/^[a-z]/.test(base)) base = `type-${base}`.replace(/-+$/, '').slice(0, 32);
  const taken = new Set<string>([...types.map((t) => t.id), FALLBACK_ITEM_TYPE.id]);
  return uniqueSlug(base || 'type', taken, 32);
}

// A new custom field's id: `f-` and a slug of its name, unique among the type's fields.
export function newCustomFieldId(label: string, taken: Iterable<string>): string {
  const base = `f-${slugOf(label, 30) || 'field'}`;
  return uniqueSlug(base, new Set(taken), 32);
}

// The fields a panel never files under a tab: the title heads it, and votes live on the card.
const NEVER_IN_A_TAB = new Set(['title', 'votes']);
// The same for a type's own Votes field, which lives on the card as the built-in does (item-types.md "Comments and
// Votes fields").
const neverInATab = (type: ItemTypeDef, f: string): boolean =>
  NEVER_IN_A_TAB.has(f) || customFieldOf(type, f)?.kind === 'votes';

// A Comments field, the built-in or the type's own (item-types.md "Comments and Votes fields").
const isCommentsField = (type: ItemTypeDef, f: string): boolean =>
  f === 'comments' || customFieldOf(type, f)?.kind === 'comments';

// A field the default Overview tab holds: the long-form ones, and the comment threads.
function overviewField(type: ItemTypeDef, f: string): boolean {
  return (
    f === 'description' ||
    f === 'checklist' ||
    f === 'attachments' ||
    isCommentsField(type, f) ||
    customFieldOf(type, f)?.kind === 'longtext'
  );
}

// A type's panel tabs (docs/specs/026-plan/item-types.md "An item type"): its own, or one Overview tab
// of its long-form fields. Each tab lists only fields the type offers.
export function tabsOf(type: ItemTypeDef): readonly ItemTypeTab[] {
  const offered = new Set(type.fields);
  if (type.tabs)
    return type.tabs.map((t) => ({
      ...t,
      fields: t.fields.filter((f) => offered.has(f) && !neverInATab(type, f)),
    }));
  return [
    {
      id: OVERVIEW_TAB_ID,
      label: 'Overview',
      // The conversations end the tab, after every long-form field, in the type's order (docs/specs/026-plan/items.md
      // "Comments").
      fields: type.fields
        .filter((f) => overviewField(type, f))
        .sort((a, b) => Number(isCommentsField(type, a)) - Number(isCommentsField(type, b))),
    },
  ];
}

// What a type calls Details (docs/specs/026-plan/item-types.md "Tabs"): renamable, never removed.
export const DETAILS_LABEL_DEFAULT = 'Details';
export function detailsLabelOf(type: Pick<ItemTypeDef, 'detailsLabel'>): string {
  return type.detailsLabel || DETAILS_LABEL_DEFAULT;
}

// The fields the panel's Details shows: the type's fields in no tab (never the title or votes).
export function detailFieldsOf(type: ItemTypeDef): string[] {
  const tabbed = new Set(tabsOf(type).flatMap((t) => t.fields));
  return type.fields.filter((f) => !neverInATab(type, f) && !tabbed.has(f));
}

export function newTabId(label: string, taken: Iterable<string>): string {
  return uniqueSlug(`t-${slugOf(label, 30) || 'tab'}`, new Set(taken), 32);
}

function readTabs(input: unknown, fields: readonly string[], at: string): ItemTypeTab[] | string {
  if (!Array.isArray(input) || input.length > ITEM_TYPE_TABS_MAX) return `${at}.tabs`;
  const offered = new Set(fields.filter((f) => !NEVER_IN_A_TAB.has(f)));
  const placed = new Set<string>();
  const tabs: ItemTypeTab[] = [];
  for (const [i, t] of input.entries()) {
    if (!isObj(t)) return `${at}.tabs[${i}]`;
    const id = t['id'];
    if (
      typeof id !== 'string' ||
      !ITEM_TYPE_TAB_ID_PATTERN.test(id) ||
      tabs.some((x) => x.id === id)
    )
      return `${at}.tabs[${i}].id`;
    const label = typeof t['label'] === 'string' ? t['label'].trim() : '';
    if (
      !label ||
      label.length > ITEM_TYPE_TAB_LABEL_MAX ||
      tabs.some((x) => x.label.toLowerCase() === label.toLowerCase())
    )
      return `${at}.tabs[${i}].label`;
    if (!Array.isArray(t['fields'])) return `${at}.tabs[${i}].fields`;
    // A field the type no longer offers, or one an earlier tab holds, is left out.
    const tabFields: string[] = [];
    for (const f of t['fields']) {
      if (typeof f === 'string' && offered.has(f) && !placed.has(f)) {
        placed.add(f);
        tabFields.push(f);
      }
    }
    tabs.push({ id, label, fields: tabFields });
  }
  return tabs;
}

export const defaultNewTitle = (label: string) => `New ${label.toLowerCase()}`;

type Result = { ok: true; catalogue: ItemTypeCatalogue } | { ok: false; reason: string };

function readCustom(input: unknown, at: string): CustomFieldDef | string {
  if (!isObj(input)) return `${at}: not an object`;
  const id = input['id'];
  if (typeof id !== 'string' || !CUSTOM_FIELD_ID_PATTERN.test(id)) return `${at}.id`;
  const label = typeof input['label'] === 'string' ? input['label'].trim() : '';
  if (!label || label.length > CUSTOM_FIELD_LABEL_MAX) return `${at}.label`;
  const kind = input['kind'];
  if (!(CUSTOM_FIELD_KINDS as readonly unknown[]).includes(kind)) return `${at}.kind`;
  const field: { -readonly [K in keyof CustomFieldDef]: CustomFieldDef[K] } = {
    id,
    label,
    kind: kind as CustomFieldKind,
  };
  if (kind === 'choice' || kind === 'multichoice') {
    const raw = input['options'];
    if (!Array.isArray(raw)) return `${at}.options`;
    const options = raw.map((o) => (typeof o === 'string' ? o.trim() : ''));
    if (
      options.length < 1 ||
      options.length > CUSTOM_CHOICE_OPTIONS_MAX ||
      options.some((o) => !o || o.length > CUSTOM_CHOICE_OPTION_MAX) ||
      new Set(options.map((o) => o.toLowerCase())).size !== options.length
    )
      return `${at}.options`;
    field.options = options;
  }
  if (kind === 'rating' && input['scale'] !== undefined) {
    const scale = input['scale'];
    if (
      typeof scale !== 'number' ||
      !Number.isInteger(scale) ||
      scale < RATING_FIELD_SCALE_MIN ||
      scale > RATING_FIELD_SCALE_MAX
    )
      return `${at}.scale`;
    if (scale !== RATING_FIELD_SCALE_DEFAULT) field.scale = scale;
  }
  if (kind === 'card') {
    // The type it links to; one the catalogue lacks is kept (the type may come back), never refused.
    const linkType = input['linkType'];
    if (typeof linkType !== 'string' || !ITEM_TYPE_PATTERN.test(linkType)) return `${at}.linkType`;
    // Several types (docs/specs/026-plan/item-types.md "Card fields"): read as linkTypesOf reads them, stored as
    // withLinkTypes stores them.
    const many = input['linkTypes'];
    if (many !== undefined) {
      if (
        !Array.isArray(many) ||
        many.length < 1 ||
        many.length > CARD_LINK_TYPES_MAX ||
        many.some((t) => typeof t !== 'string' || !ITEM_TYPE_PATTERN.test(t))
      )
        return `${at}.linkTypes`;
    }
    Object.assign(
      field,
      withLinkTypes(field, linkTypesOf({ linkType, linkTypes: many as string[] | undefined })),
    );
  }
  if (kind === 'currency' && input['currency'] !== undefined) {
    const code = input['currency'];
    if (typeof code !== 'string' || !CURRENCY_CODE.test(code)) return `${at}.currency`;
    if (code !== CURRENCY_DEFAULT) field.currency = code;
  }
  if (kind === 'calculated') {
    // From the fixed menu (calculated-fields.ts): one this reader does not know is refused, as an unknown kind is.
    const calculation = input['calculation'];
    if (!isCalculation(calculation)) return `${at}.calculation`;
    field.calculation = calculation;
  }
  if (input['onCard'] === true) field.onCard = true;
  // Kept only as true, and never on a Checkbox: anything else reads as optional rather than refusing the catalogue.
  if (input['required'] === true && canBeRequired(field.kind)) field.required = true;
  // Kept only as true, and only on a Person field.
  if (input['notifies'] === true && field.kind === 'person') field.notifies = true;
  // Kept only as true, and only on a Person or Card field (docs/specs/026-plan/item-types.md "Holds Several").
  if (input['multiple'] === true && holdsSeveralKind(field.kind)) field.multiple = true;
  return field;
}

function readType(input: unknown, at: string): ItemTypeDef | string {
  if (!isObj(input)) return `${at}: not an object`;
  const id = input['id'];
  if (typeof id !== 'string' || !ITEM_TYPE_PATTERN.test(id) || id === FALLBACK_ITEM_TYPE.id)
    return `${at}.id`;
  const label = typeof input['label'] === 'string' ? input['label'].trim() : '';
  if (!label || label.length > ITEM_TYPE_LABEL_MAX) return `${at}.label`;
  const color = input['color'];
  if (typeof color !== 'string' || !HEX_COLOUR.test(color)) return `${at}.color`;
  const glyph = input['glyph'];
  if (!isPlanGlyphId(glyph)) return `${at}.glyph`;
  const customIn = input['custom'] ?? [];
  if (!Array.isArray(customIn) || customFieldCount(customIn) > ITEM_TYPE_CUSTOM_MAX)
    return `${at}.custom`;
  const custom: CustomFieldDef[] = [];
  for (const [i, c] of customIn.entries()) {
    const field = readCustom(c, `${at}.custom[${i}]`);
    if (typeof field === 'string') return field;
    if (custom.some((f) => f.id === field.id)) return `${at}.custom[${i}].id`;
    custom.push(field);
  }
  const fieldsIn = input['fields'];
  if (!Array.isArray(fieldsIn)) return `${at}.fields`;
  // Parent was a built-in field: a type stored then, naming it without defining it, gets the Parent Card field.
  if (fieldsIn.includes(PARENT_FIELD_ID) && !custom.some((f) => f.id === PARENT_FIELD_ID))
    custom.push(PARENT_FIELD);
  const known = new Set<string>([...BUILT_IN_FIELD_IDS, ...custom.map((f) => f.id)]);
  const fields: string[] = [...REQUIRED_TYPE_FIELDS];
  for (const f of fieldsIn) {
    if (typeof f !== 'string' || !known.has(f)) return `${at}.fields`;
    if (!fields.includes(f)) fields.push(f);
  }
  if (fields.length > ITEM_TYPE_FIELDS_MAX) return `${at}.fields`;
  // A stored type that lost one of its own required fields (saved before they were) gets it back, last. After the
  // cap: putting them back may take a full type past it, and must never make a stored catalogue unreadable.
  for (const f of TYPE_REQUIRED_FIELDS[id] ?? []) if (!fields.includes(f)) fields.push(f);
  let tabs: ItemTypeTab[] | undefined;
  if (input['tabs'] !== undefined) {
    const read = readTabs(input['tabs'], fields, at);
    if (typeof read === 'string') return read;
    tabs = read;
  }
  let detailsLabel: string | undefined;
  if (input['detailsLabel'] !== undefined) {
    const d = typeof input['detailsLabel'] === 'string' ? input['detailsLabel'].trim() : '';
    if (!d || d.length > ITEM_TYPE_TAB_LABEL_MAX) return `${at}.detailsLabel`;
    if (d !== DETAILS_LABEL_DEFAULT) detailsLabel = d;
  }
  // The ordered list of the statuses it uses; a type stored before it (legacy) keeps what it left out, and a type
  // with the list drops any exclusions, which it replaced.
  let statuses: string[] | undefined;
  let excludedStatuses: string[] | undefined;
  if (input['statuses'] !== undefined) {
    const read = readStatusList(input['statuses'], ITEM_TYPE_STATUSES_MAX);
    if (!read) return `${at}.statuses`;
    statuses = read;
  } else if (input['excludedStatuses'] !== undefined) {
    const read = readStatusList(input['excludedStatuses'], ITEM_TYPE_EXCLUDED_STATUSES_MAX);
    if (!read) return `${at}.excludedStatuses`;
    if (read.length) excludedStatuses = read;
  }
  let defaultStatus: string | undefined;
  if (input['defaultStatus'] !== undefined) {
    const d = input['defaultStatus'];
    if (typeof d !== 'string' || !d.trim() || d.length > ITEM_STATUS_MAX)
      return `${at}.defaultStatus`;
    defaultStatus = d;
  }
  const display = readCardDisplay(input['display'], id);
  if (display === null) return `${at}.display`;
  // The Card Colour: a custom Colour field of the type's own; anything else reads as the built-in Colour.
  const colourIn = input['colourField'];
  const colourField =
    typeof colourIn === 'string' && custom.some((f) => f.id === colourIn && f.kind === 'colour')
      ? colourIn
      : undefined;
  const newTitle =
    typeof input['newTitle'] === 'string' && input['newTitle'].trim()
      ? input['newTitle'].trim().slice(0, ITEM_TYPE_LABEL_MAX + 4)
      : defaultNewTitle(label);
  return {
    id,
    label,
    newTitle,
    glyph,
    color: color.toLowerCase(),
    fields,
    ...(custom.length ? { custom } : {}),
    ...(tabs ? { tabs } : {}),
    ...(detailsLabel ? { detailsLabel } : {}),
    ...(statuses ? { statuses } : {}),
    ...(excludedStatuses ? { excludedStatuses } : {}),
    ...(defaultStatus ? { defaultStatus } : {}),
    ...(display ? { display } : {}),
    ...(input['assigneeNotifies'] === false ? { assigneeNotifies: false } : {}),
    ...(colourField ? { colourField } : {}),
  };
}

// A type's status list as stored (the statuses it uses, or a legacy type's left-out ones): status ids
// (non-blank, de-duplicated, in order), at most `max`. An id no board names any more is kept, so the status comes
// back as it was. Null for anything else.
function readStatusList(input: unknown, max: number): string[] | null {
  if (!Array.isArray(input) || input.length > max) return null;
  const out: string[] = [];
  for (const s of input) {
    if (typeof s !== 'string' || !s.trim() || s.length > ITEM_STATUS_MAX) return null;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

// Whether a card of `type` may be in `status` (docs/specs/026-plan/item-types.md "The statuses a type uses"): one
// its list holds, or for a legacy type (no list) one it does not leave out. No status (an unplaced card) is always
// allowed.
export function typeAllowsStatus(
  type: TypeStatusesPart | undefined,
  status: string | null | undefined,
): boolean {
  if (!status || !type) return true;
  if (type.statuses) return type.statuses.includes(status);
  return !type.excludedStatuses?.includes(status);
}

// What says which statuses a type uses: its ordered list, or a legacy type's exclusions.
export type TypeStatusesPart = Pick<ItemTypeDef, 'statuses' | 'excludedStatuses'>;

// A type's Default State, or undefined: none set, or one the type has turned off (ignored, as if absent).
export function defaultStatusOf(
  type: (TypeStatusesPart & Pick<ItemTypeDef, 'defaultStatus'>) | undefined,
): string | undefined {
  const d = type?.defaultStatus;
  return d && typeAllowsStatus(type, d) ? d : undefined;
}

// A built-in or brought type's Default State, by name (docs/specs/026-plan/item-types.md "An item type"): a
// project's state ids are its own, so the name is matched to the project's state of that name. By type id, so it
// holds for such a type stored in a project's catalogue too. A brought type's is the first column of the board it
// is made for (docs/specs/026-plan/plan-templates.md "The brought types").
export const READY_MADE_DEFAULT_STATE_NAMES: Readonly<Record<string, string>> = {
  project: 'Backlog',
  task: 'To Do',
  action: 'To Do',
  note: 'To Do',
  idea: 'Ideas',
  bug: 'New',
  story: 'Backlog',
  request: 'New',
  content: 'Ideas',
  role: 'Opening Soon',
  candidate: 'Applied',
  'onboarding-task': 'Before Day One',
  objective: 'Draft',
  'key-result': 'Not Started',
  'launch-check': 'Not Checked',
};

// The built-in default's state in this project (`statusNames`: status id to name), or undefined: not a built-in
// type, no state of that name, or one the type turns off.
export function readyMadeDefaultStatus(
  type: TypeStatusesPart & Pick<ItemTypeDef, 'id'>,
  statusNames: Iterable<readonly [string, string]>,
): string | undefined {
  const name = READY_MADE_DEFAULT_STATE_NAMES[type.id];
  const hit = name ? statusNamed(name, statusNames) : undefined;
  return hit && typeAllowsStatus(type, hit.status) ? hit.status : undefined;
}

// The state a card of this type is made in outside a board, as the editor resolves it: its own Default State,
// else its built-in one, else undefined.
export function resolvedDefaultStatus(
  type: TypeStatusesPart & Pick<ItemTypeDef, 'id' | 'defaultStatus'>,
  statusNames: Iterable<readonly [string, string]>,
): string | undefined {
  return defaultStatusOf(type) ?? readyMadeDefaultStatus(type, statusNames);
}

// Creates with no status of their own given their type's Default State (an API or MCP create); a create that
// names a status, or whose type has none, is left as it is.
export function withDefaultStatuses<
  C extends {
    type: string;
    place?: { status?: string } | undefined;
    fields?: Readonly<Record<string, unknown>>;
  },
>(creates: readonly C[], types: readonly ItemTypeDef[]): C[] {
  return creates.map((c) => {
    if (c.place?.status !== undefined || typeof c.fields?.['status'] === 'string') return c;
    const status = defaultStatusOf(types.find((t) => t.id === c.type));
    return status ? { ...c, place: { ...c.place, status } } : c;
  });
}

// The refusal for a card moved into a status its type leaves out.
export function statusRefusal(typeLabel: string, statusName: string): string {
  return `${typeLabel} cards can't be ${statusName}`;
}

// The api's and the editor's check of a whole catalogue: its shape, ids, counts and lengths. Title
// and Status are put first in every type; the stored form is the normalised one.
export function validateItemTypeCatalogue(input: unknown): Result {
  if (!isObj(input)) return { ok: false, reason: 'not an object' };
  if (input['version'] !== ITEM_TYPE_CATALOGUE_VERSION) return { ok: false, reason: 'version' };
  const typesIn = input['types'];
  if (!Array.isArray(typesIn) || typesIn.length > ITEM_TYPES_MAX)
    return { ok: false, reason: 'types' };
  const types: ItemTypeDef[] = [];
  for (const [i, t] of typesIn.entries()) {
    const type = readType(t, `types[${i}]`);
    if (typeof type === 'string') return { ok: false, reason: type };
    if (types.some((x) => x.id === type.id)) return { ok: false, reason: `types[${i}].id` };
    if (types.some((x) => x.label.toLowerCase() === type.label.toLowerCase()))
      return { ok: false, reason: `types[${i}].label` };
    types.push(type);
  }
  const catalogue: ItemTypeCatalogue = { version: ITEM_TYPE_CATALOGUE_VERSION, types };
  if (new TextEncoder().encode(JSON.stringify(catalogue)).length > ITEM_TYPES_BYTES)
    return { ok: false, reason: 'too large' };
  return { ok: true, catalogue };
}

// A stored catalogue read back (D1, an offline record, a Drive file): kept when valid, else none
// (not chosen), so a damaged value never stops a project opening.
export function readItemTypeCatalogue(input: unknown): ItemTypeCatalogue | null {
  if (input === null || input === undefined) return null;
  const parsed = typeof input === 'string' ? safeParse(input) : input;
  const result = validateItemTypeCatalogue(parsed);
  return result.ok ? result.catalogue : null;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// The default types as a stored catalogue: what a project made before card types started empty, with cards,
// reads as (legacyCatalogue).
export function defaultCatalogue(): ItemTypeCatalogue {
  return { version: ITEM_TYPE_CATALOGUE_VERSION, types: ITEM_TYPES };
}

// What a project made before card types started empty reads as (docs/specs/026-plan/item-types.md "The type
// catalogue"): one never chosen (`stored` null) that has cards kept the five default types its cards were made
// with, so it reads as them; anything else reads as it is stored. Used where a project is read whole and its cards
// are known (an offline record, a Drive file); a D1 project is stored with its catalogue.
export function legacyCatalogue(
  stored: ItemTypeCatalogue | null,
  hasCards: boolean,
): ItemTypeCatalogue | null {
  return stored === null && hasCards ? defaultCatalogue() : stored;
}
