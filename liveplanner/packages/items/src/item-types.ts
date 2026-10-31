// The built-in item types (docs/specs/026-plan/items.md "Item types"). A type
// names the fields its item panel offers; any item may still carry others.
// `glyph` is an id from the Plan glyph set (glyphs.ts). A project may replace this
// catalogue with its own (type-catalogue.ts, docs/specs/026-plan/item-types.md).
import type { CardField, CardSize } from './board';
import type { CardSlot } from './card-display';
import type { PlanGlyphId } from './glyphs';
import type { FormulaResult } from './formula/limits';

export type ItemFieldId =
  | 'title'
  | 'description'
  | 'status'
  | 'assignee'
  | 'priority'
  // The item's own colour (docs/specs/026-plan/items.md "Colour"): a dot beside its type colour, a Project's bar.
  | 'color'
  | 'labels'
  | 'estimate'
  // When the work begins (docs/specs/026-plan/items.md "Fields"): a Project's bar on the Gantt chart.
  | 'start'
  | 'due'
  | 'checklist'
  // Pictures on the card, one of them its cover (docs/specs/026-plan/items.md "Attachments").
  | 'attachments'
  | 'votes'
  // A comment thread (docs/specs/026-plan/items.md "Comments"): the canvas's CommentThread, written only by the
  // comment writes.
  | 'comments'
  // Archived (docs/specs/026-plan/items.md "Archive"): kept, but off every board but an Archive board.
  | 'archived'
  // Flagged (docs/specs/026-plan/items.md "Flags"): marked for attention, on every board it is on.
  | 'flagged'
  // An example card a Plan template made (docs/specs/026-plan/items.md "Example cards").
  | 'example';

// A field a person adds to a type (docs/specs/026-plan/item-types.md "An item type"): its value is
// an ordinary entry in the item's `fields`, under `id`.
export const CUSTOM_FIELD_KINDS = [
  'text',
  'longtext',
  'number',
  // An amount in the field's own currency (`currency`), read as the locale formats it.
  'currency',
  'date',
  'checkbox',
  'link',
  // One email address.
  'email',
  'choice',
  // Several of its named options (docs/specs/030-forms/forms.md "New card field kinds").
  'multichoice',
  // A whole number from 1 to its `scale`, drawn as stars.
  'rating',
  // A link to one other card, of the type `linkType` names, or to several when it holds several
  // (docs/specs/026-plan/item-types.md "Card fields").
  'card',
  // A value worked out from the plan by its `calculation`, never stored (docs/specs/026-plan/item-types.md
  // "Calculated fields").
  'calculated',
  // The kinds the built-in fields are (docs/specs/026-plan/item-types.md "Custom field kinds"): each reads and is
  // edited as its built-in field, so a type may hold more than one. A Person is the Assignee's `{ id, name, color }`,
  // Labels the Labels' list, a Colour any `#rrggbb`, a Checklist the Checklist's `{ text, done }` rows.
  'person',
  'labels',
  'colour',
  'checklist',
  // One picture at liveworkspace's media service, by its id (docs/specs/026-plan/item-types.md "Image fields").
  'image',
  // Its own comment threads and its own votes (docs/specs/026-plan/item-types.md "Comments and Votes fields"): a
  // thread names its Comments field (`CardThread.field`); a Votes field holds `{ voter: dots }` as the built-in Votes,
  // written only by a session vote's tally.
  'comments',
  'votes',
] as const;
export type CustomFieldKind = (typeof CUSTOM_FIELD_KINDS)[number];

// The built-in field each of the built-in kinds reads, is edited and is checked as (docs/specs/026-plan/item-types.md
// "Custom field kinds"): a Person field as the Assignee, and so on. Undefined for every other kind.
const BUILT_IN_OF_KIND: Partial<Record<CustomFieldKind, ItemFieldId>> = {
  person: 'assignee',
  labels: 'labels',
  colour: 'color',
  checklist: 'checklist',
  comments: 'comments',
  votes: 'votes',
};
export const builtInFieldOfKind = (kind: CustomFieldKind): ItemFieldId | undefined =>
  BUILT_IN_OF_KIND[kind];

// The currencies a Currency field offers first, and the one it takes when none is given (docs/specs/026-plan/
// item-types.md "Custom field kinds"); any other ISO 4217 code is kept too.
export const COMMON_CURRENCIES = [
  'GBP',
  'USD',
  'EUR',
  'JPY',
  'CAD',
  'AUD',
  'CHF',
  'INR',
  'CNY',
  'SEK',
] as const;
export const CURRENCY_DEFAULT = 'GBP';
// A Rating field's scale (docs/specs/030-forms/forms.md "New card field kinds").
export const RATING_FIELD_SCALE_MIN = 3;
export const RATING_FIELD_SCALE_MAX = 10;
export const RATING_FIELD_SCALE_DEFAULT = 5;
export const ratingScaleOf = (field: Pick<CustomFieldDef, 'scale'>): number =>
  field.scale ?? RATING_FIELD_SCALE_DEFAULT;
export const CURRENCY_CODE = /^[A-Z]{3}$/;
// An email address as a field keeps it: something@domain.tld, no spaces, up to 254 characters.
export const EMAIL_MAX = 254;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmailAddress = (v: string) => v.length <= EMAIL_MAX && EMAIL_PATTERN.test(v);

// A Calculated field's menu (docs/specs/026-plan/item-types.md "Calculated fields"), in the order it is offered:
// how many children a card has, the share of them that are done, and a formula over the card's own fields
// (formula-fields.ts).
export const CALCULATIONS = ['childCount', 'childrenDone', 'formula'] as const;
export type Calculation = (typeof CALCULATIONS)[number];

export interface CustomFieldDef {
  id: string;
  label: string;
  kind: CustomFieldKind;
  // Choice's and Multiple Choice's options, in order.
  options?: readonly string[];
  // A Rating's top score, RATING_FIELD_SCALE_MIN..MAX; RATING_FIELD_SCALE_DEFAULT when absent.
  scale?: number;
  // A Card field's first target card type id: its value is the id of one card of that type (or of `linkTypes`).
  linkType?: string;
  // Every card type a Card field may link to, `linkType` first, when there is more than one (linkTypesOf).
  linkTypes?: readonly string[];
  // A Currency field's ISO 4217 code ("GBP"); CURRENCY_DEFAULT when absent.
  currency?: string;
  // A Calculated field's calculation (calculated-fields.ts).
  calculation?: Calculation;
  // A Formula's expression as stored, each field its id in braces (`{f-budget} - {f-spent}`; formula/references.ts),
  // and how its value reads (`result`, Number when absent); only on a Calculated field whose calculation is formula.
  formula?: string;
  result?: FormulaResult;
  // Drawn on the card face, after the board's card fields.
  onCard?: boolean;
  // A card of the type must have a value for it (required-fields.ts); never on a Checkbox.
  required?: boolean;
  // A Person field tells its person when a card is theirs (docs/specs/026-plan/item-types.md "Notifies"): the
  // Inbox, emails and Only Mine. Kept only as true, only on a Person field.
  notifies?: boolean;
  // A Person or Card field holds several people or cards (docs/specs/026-plan/item-types.md "Holds Several";
  // several-values.ts). Kept only as true, only on those two kinds.
  multiple?: boolean;
}

// The most card types one Card field links to: every type the catalogue can hold (ITEM_TYPES_MAX).
export const CARD_LINK_TYPES_MAX = 32;

// The card types a Card field links to (docs/specs/026-plan/item-types.md "Card fields"): `linkTypes` when it holds
// `linkType`, else `linkType` alone, so a field saved before (no `linkTypes`), or one an older editor re-pointed by
// changing `linkType` alone, reads as its `linkType`. None for a field that is no Card field.
export function linkTypesOf(
  field: Pick<CustomFieldDef, 'linkType' | 'linkTypes'>,
): readonly string[] {
  const first = field.linkType;
  if (!first) return [];
  return field.linkTypes && field.linkTypes.includes(first) ? field.linkTypes : [first];
}

// A Card field's types as stored: `linkType` the first, `linkTypes` only when there are several (deduplicated, in
// order), so a one-type field is stored exactly as before.
export function withLinkTypes<T extends CustomFieldDef | Omit<CustomFieldDef, 'id'>>(
  field: T,
  ids: readonly string[],
): T {
  const unique = [...new Set(ids)];
  const { linkTypes: _old, linkType: _first, ...rest } = field;
  if (unique.length === 0) return rest as T;
  return {
    ...rest,
    linkType: unique[0],
    ...(unique.length > 1 ? { linkTypes: unique } : {}),
  } as T;
}

// A tab of an item type's panel (docs/specs/026-plan/item-types.md "An item type"): the fields it shows.
export interface ItemTypeTab {
  id: string;
  label: string;
  fields: readonly string[];
}

export interface ItemTypeDef {
  id: string;
  label: string;
  // The title a new item of this type gets from a palette tile.
  newTitle: string;
  // Its glyph from the Plan glyph set; the fallback type's own is 'item'.
  glyph: PlanGlyphId | 'item';
  // The stripe and glyph colour on a card face.
  color: string;
  // The fields its item panel offers, in order: built-in field ids and its custom fields' ids.
  fields: readonly string[];
  custom?: readonly CustomFieldDef[];
  // The name the panel gives Details (its side column, and the phone's first tab); absent is "Details".
  detailsLabel?: string;
  // The panel's tabs; absent is one Overview tab (tabsOf).
  tabs?: readonly ItemTypeTab[];
  // The statuses this type uses, in order (docs/specs/026-plan/item-types.md "The statuses a type uses"): a card of
  // it never moves into any other, and every status menu for its cards lists them in this order. A new board's
  // statuses join only the types that board takes. Empty: it uses none. Absent: a legacy type (below).
  statuses?: readonly string[];
  // A legacy type's statuses it does not use, from before `statuses`: such a type uses every status the boards name
  // but these (typeStatusesOf). Read, never written; a type with `statuses` has none.
  excludedStatuses?: readonly string[];
  // The Default State (docs/specs/026-plan/item-types.md "An item type"): the status a card of this type is made in
  // when nothing else gives it one (a board's column always does). Absent: none.
  defaultStatus?: string;
  // What its cards show at each card size (docs/specs/026-plan/item-types.md "Card display"); a size left out takes
  // the type's default (typeCardDisplay).
  display?: Partial<Record<CardSize, Partial<Record<CardSlot, readonly CardField[]>>>>;
  // The Assignee does not tell its person (docs/specs/026-plan/item-types.md "Notifies"). Kept only as false.
  assigneeNotifies?: boolean;
  // The custom Colour field its cards take their colour from ("Fields by role"); absent is the built-in Colour.
  colourField?: string;
}

// Parent (docs/specs/026-plan/item-types.md "Card fields"): a Card field linking to Projects, under the one custom
// id without `f-`, so every card made while Parent was a built-in field keeps its value.
export const PARENT_FIELD_ID = 'parent';
export const PARENT_FIELD: CustomFieldDef = {
  id: PARENT_FIELD_ID,
  label: 'Parent',
  kind: 'card',
  linkType: 'project',
};
// Parent's own grouping, as boards, views and saved searches stored it before (legacy-parent.ts reads it as the
// Parent field): still accepted, never written.
export const LEGACY_PARENT_GROUPING = 'parent';

// Parent right under Status and Assignee: what a piece of work belongs to is read with who has it.
// No Start: only a Project, a bar on the Gantt chart, starts by default.
const WORK: readonly string[] = [
  'title',
  'description',
  'status',
  'assignee',
  'parent',
  'priority',
  'estimate',
  'due',
  'checklist',
  'labels',
];

const BUILT_IN_TYPES = [
  {
    id: 'project',
    label: 'Project',
    newTitle: 'New plan',
    glyph: 'project',
    color: '#18181b',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'priority',
      'color',
      'start',
      'due',
      'labels',
    ],
  },
  {
    id: 'task',
    label: 'Task',
    newTitle: 'New task',
    glyph: 'task',
    color: '#71717a',
    fields: WORK,
    custom: [PARENT_FIELD],
  },
  {
    id: 'note',
    label: 'Note',
    newTitle: 'New note',
    glyph: 'note',
    color: '#2563eb',
    fields: ['title', 'description', 'status', 'votes'],
  },
  {
    id: 'idea',
    label: 'Idea',
    newTitle: 'New idea',
    glyph: 'idea',
    color: '#eab308',
    fields: ['title', 'description', 'status', 'votes', 'labels'],
  },
  {
    id: 'action',
    label: 'Action',
    newTitle: 'New action',
    glyph: 'action',
    color: '#dc2626',
    fields: ['title', 'description', 'status', 'assignee', 'due', 'checklist'],
  },
] as const satisfies readonly ItemTypeDef[];

// Every default type offers comments, last (docs/specs/026-plan/items.md "Comments"). The mapped type keeps
// the tuple, so each type stays addressable by position and its id literal.
type WithComments<T extends readonly ItemTypeDef[]> = {
  readonly [K in keyof T]: Omit<T[K], 'fields'> & { fields: readonly string[] };
};
export const ITEM_TYPES = BUILT_IN_TYPES.map((t) => ({
  ...t,
  fields: [...t.fields, 'comments'],
})) as unknown as WithComments<typeof BUILT_IN_TYPES>;

type ItemTypeId = (typeof ITEM_TYPES)[number]['id'];

export const ITEM_TYPE_IDS: readonly ItemTypeId[] = ITEM_TYPES.map((t) => t.id);

// An unknown type (added later, or by an agent) is kept and drawn plainly.
export const FALLBACK_ITEM_TYPE: ItemTypeDef = {
  id: 'item',
  label: 'Item',
  newTitle: 'New item',
  glyph: 'item',
  color: '#64748b',
  fields: ['title', 'description', 'status', 'assignee', 'labels', 'comments'],
};
