// A document's type catalogue (docs/specs/026-plan/item-types.md): its item types, in order. Absent
// (null) means the built-in catalogue, read from code; once changed, the whole catalogue is stored
// with the document. Validation here is the api's and the editor's both, so a catalogue the editor
// saves is one the api keeps.
import { isPlanGlyphId } from './glyphs';
import {
  CUSTOM_FIELD_KINDS,
  FALLBACK_ITEM_TYPE,
  ITEM_TYPES,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemFieldId,
  type ItemTypeDef,
  type ItemTypeTab,
} from './item-types';
import { ITEM_TYPE_PATTERN } from './limits';

export const ITEM_TYPES_MAX = 32;
export const ITEM_TYPE_FIELDS_MAX = 24;
export const ITEM_TYPE_CUSTOM_MAX = 12;
export const ITEM_TYPE_LABEL_MAX = 32;
export const CUSTOM_FIELD_LABEL_MAX = 32;
export const CUSTOM_CHOICE_OPTIONS_MAX = 20;
export const CUSTOM_CHOICE_OPTION_MAX = 40;
// The stored catalogue's JSON, at most (blueprint DEFAULTS: room for 32 full types).
export const ITEM_TYPES_BYTES = 32_768;
export const ITEM_TYPE_CATALOGUE_VERSION = 1;
export const ITEM_TYPE_TABS_MAX = 6;
export const ITEM_TYPE_TAB_LABEL_MAX = 24;
export const ITEM_TYPE_TAB_ID_PATTERN = /^t-[a-z0-9-]{1,30}$/;
// The one tab a type without its own shows.
export const OVERVIEW_TAB_ID = 't-overview';

// The colours a type is given from: the built-in types' five (Project, Task, Note, Idea, Action), then
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
  'parent',
  'priority',
  'labels',
  'estimate',
  'start',
  'due',
  'checklist',
  'comments',
  'votes',
];

// Every type offers these, first, and they cannot be removed.
export const REQUIRED_TYPE_FIELDS: readonly ItemFieldId[] = ['title', 'status'];

export const CUSTOM_FIELD_ID_PATTERN = /^f-[a-z0-9-]{1,30}$/;

// What is stored: the catalogue whole, with a version for later shapes.
export interface ItemTypeCatalogue {
  version: number;
  types: readonly ItemTypeDef[];
}

const BUILT_IN_FIELDS = new Set<string>(BUILT_IN_FIELD_IDS);

// The types a document's stored catalogue holds, or the built-ins when it holds none.
export function typesOf(stored: ItemTypeCatalogue | null | undefined): readonly ItemTypeDef[] {
  return stored?.types ?? ITEM_TYPES;
}

// A type by id within a catalogue; an unknown id (deleted, or an agent's) draws as "Item".
export function typeIn(types: readonly ItemTypeDef[], id: string): ItemTypeDef {
  return types.find((t) => t.id === id) ?? FALLBACK_ITEM_TYPE;
}

// Matches "bug", "Bug", "bugs", "customer call" to a type, for quick add's leading `name:`.
export function typeByNameIn(types: readonly ItemTypeDef[], name: string): ItemTypeDef | undefined {
  const n = name.trim().toLowerCase();
  return types.find(
    (t) =>
      t.id === n ||
      `${t.id}s` === n ||
      t.label.toLowerCase() === n ||
      `${t.label.toLowerCase()}s` === n,
  );
}

export function customFieldOf(type: ItemTypeDef, fieldId: string): CustomFieldDef | undefined {
  return type.custom?.find((f) => f.id === fieldId);
}

export function isBuiltInFieldId(id: string): id is ItemFieldId {
  return BUILT_IN_FIELDS.has(id);
}

// A lowercase slug of a name: letters and digits joined by single hyphens.
export function slugOf(label: string, max = 32): string {
  const slug = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
  return slug;
}

function unique(base: string, taken: ReadonlySet<string>, max: number): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const id = `${base.slice(0, max - suffix.length)}${suffix}`;
    if (!taken.has(id)) return id;
  }
}

// A new type's id, made from its name and never changed (items store it).
export function newItemTypeId(label: string, types: readonly ItemTypeDef[]): string {
  let base = slugOf(label, 32);
  if (!/^[a-z]/.test(base)) base = `type-${base}`.replace(/-+$/, '').slice(0, 32);
  const taken = new Set<string>([...types.map((t) => t.id), FALLBACK_ITEM_TYPE.id]);
  return unique(base || 'type', taken, 32);
}

// A new custom field's id: `f-` and a slug of its name, unique among the type's fields.
export function newCustomFieldId(label: string, taken: Iterable<string>): string {
  const base = `f-${slugOf(label, 30) || 'field'}`;
  return unique(base, new Set(taken), 32);
}

// The fields a panel never files under a tab: the title heads it, and votes live on the card.
const NEVER_IN_A_TAB = new Set(['title', 'votes']);

// A field the default Overview tab holds: the long-form ones, and the comment thread.
function overviewField(type: ItemTypeDef, f: string): boolean {
  return (
    f === 'description' ||
    f === 'checklist' ||
    f === 'comments' ||
    customFieldOf(type, f)?.kind === 'longtext'
  );
}

// A type's panel tabs (docs/specs/026-plan/item-types.md "An item type"): its own, or one Overview tab
// of its long-form fields. Each tab lists only fields the type offers.
export function tabsOf(type: ItemTypeDef): readonly ItemTypeTab[] {
  const offered = new Set(type.fields);
  if (type.tabs)
    return type.tabs.map((t) => ({ ...t, fields: t.fields.filter((f) => offered.has(f)) }));
  return [
    {
      id: OVERVIEW_TAB_ID,
      label: 'Overview',
      // The conversation ends the tab, after every long-form field (docs/specs/026-plan/items.md "Comments").
      fields: type.fields
        .filter((f) => overviewField(type, f))
        .sort((a, b) => Number(a === 'comments') - Number(b === 'comments')),
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
  return type.fields.filter((f) => !NEVER_IN_A_TAB.has(f) && !tabbed.has(f));
}

export function newTabId(label: string, taken: Iterable<string>): string {
  return unique(`t-${slugOf(label, 30) || 'tab'}`, new Set(taken), 32);
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

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

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
  if (kind === 'choice') {
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
  if (input['onCard'] === true) field.onCard = true;
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
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return `${at}.color`;
  const glyph = input['glyph'];
  if (!isPlanGlyphId(glyph)) return `${at}.glyph`;
  const customIn = input['custom'] ?? [];
  if (!Array.isArray(customIn) || customIn.length > ITEM_TYPE_CUSTOM_MAX) return `${at}.custom`;
  const custom: CustomFieldDef[] = [];
  for (const [i, c] of customIn.entries()) {
    const field = readCustom(c, `${at}.custom[${i}]`);
    if (typeof field === 'string') return field;
    if (custom.some((f) => f.id === field.id)) return `${at}.custom[${i}].id`;
    custom.push(field);
  }
  const fieldsIn = input['fields'];
  if (!Array.isArray(fieldsIn)) return `${at}.fields`;
  const known = new Set<string>([...BUILT_IN_FIELD_IDS, ...custom.map((f) => f.id)]);
  const fields: string[] = [...REQUIRED_TYPE_FIELDS];
  for (const f of fieldsIn) {
    if (typeof f !== 'string' || !known.has(f)) return `${at}.fields`;
    if (!fields.includes(f)) fields.push(f);
  }
  if (fields.length > ITEM_TYPE_FIELDS_MAX) return `${at}.fields`;
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
  };
}

// The api's and the editor's check of a whole catalogue: its shape, ids, counts and lengths. Title
// and Status are put first in every type; the stored form is the normalised one.
export function validateItemTypeCatalogue(input: unknown): Result {
  if (!isObj(input)) return { ok: false, reason: 'not an object' };
  if (input['version'] !== ITEM_TYPE_CATALOGUE_VERSION) return { ok: false, reason: 'version' };
  const typesIn = input['types'];
  if (!Array.isArray(typesIn) || typesIn.length < 1 || typesIn.length > ITEM_TYPES_MAX)
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

// A stored catalogue read back (D1, an offline record, a Drive file): kept when valid, else the
// built-ins, so a damaged value never stops a document opening.
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

// The catalogue a first change starts from: the built-ins, as a stored catalogue.
export function builtInCatalogue(): ItemTypeCatalogue {
  return { version: ITEM_TYPE_CATALOGUE_VERSION, types: ITEM_TYPES };
}
