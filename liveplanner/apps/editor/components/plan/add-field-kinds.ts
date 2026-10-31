// Add Field's catalogue and matching (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field): one list of
// field kinds in six groups, built-in and custom alike, each with a one-line description and a few everyday words it
// is searched by; the built-in fields of each kind (offered as Ready to use) with what uses them; how a search
// matches a kind; and what a new field still needs before it can be added.
import {
  linkTypesOf,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemFieldId,
} from '@liveplanner/items';

// A kind Add Field lists: every custom field kind, and the built-in fields that are one to a type (Comments, Votes).
export type PickKind = CustomFieldKind | 'comments' | 'votes';

export type KindGroupId = 'text' | 'numbers' | 'choices' | 'people' | 'look' | 'cards';

export type KindGroup = { id: KindGroupId; label: string; kinds: readonly PickKind[] };

// The groups, in order; the first opens to start.
export const KIND_GROUPS: readonly KindGroup[] = [
  { id: 'text', label: 'Text & links', kinds: ['text', 'longtext', 'link', 'email'] },
  { id: 'numbers', label: 'Numbers & dates', kinds: ['number', 'currency', 'rating', 'date'] },
  { id: 'choices', label: 'Choices', kinds: ['choice', 'multichoice', 'checkbox', 'labels'] },
  {
    id: 'people',
    label: 'People & teamwork',
    kinds: ['person', 'checklist', 'comments', 'votes'],
  },
  { id: 'look', label: 'Colour & images', kinds: ['colour', 'image'] },
  { id: 'cards', label: 'Linked cards', kinds: ['card', 'calculated'] },
];

export const groupOfKind = (kind: PickKind): KindGroupId =>
  KIND_GROUPS.find((g) => g.kinds.includes(kind))?.id ?? KIND_GROUPS[0]!.id;

// The kinds a type holds one of: Add Field adds the built-in field at once, and lists it only while the type lacks it.
export const isOneToAType = (kind: PickKind): kind is 'comments' | 'votes' =>
  kind === 'comments' || kind === 'votes';

// What each kind holds, in plain words, one line.
export const KIND_DESCRIPTIONS: Record<PickKind, string> = {
  text: 'A short line of text',
  longtext: 'Paragraphs of notes',
  link: 'A web address',
  email: 'An address that opens your mail app',
  number: 'Points, counts and sizes',
  currency: 'An amount, like £12,500',
  rating: 'Stars out of 3 to 10',
  date: 'A day on the calendar',
  choice: 'One option from a list',
  multichoice: 'Several options from a list',
  checkbox: 'Yes or no, ticked or not',
  labels: 'Short tags, coloured by name',
  person: 'Someone on the plan, like an owner or a reviewer',
  checklist: 'To-dos ticked off one by one',
  comments: 'Threads to talk the card through',
  votes: 'Thumbs up from the team',
  colour: 'A colour to tell cards apart',
  image: 'A picture, like a mock-up or a photo',
  card: 'Another card, like a parent or an epic',
  calculated: 'Worked out from the cards linked here',
};

// The everyday words people reach for, beyond a kind's name and line.
export const KIND_ALIASES: Record<PickKind, readonly string[]> = {
  text: ['string', 'single line', 'short', 'code', 'title'],
  longtext: ['notes', 'paragraph', 'multiline', 'multi-line', 'description', 'essay'],
  link: ['url', 'website', 'web', 'href', 'hyperlink'],
  email: ['mail', 'e-mail', 'contact', 'inbox'],
  number: ['count', 'points', 'size', 'quantity', 'integer', 'numeric', 'figure'],
  currency: [
    'money',
    'price',
    'cost',
    'budget',
    'amount',
    'dollar',
    'pound',
    'euro',
    'spend',
    '$',
    '€',
    '£',
  ],
  rating: ['stars', 'score', 'rank', 'review', 'grade'],
  date: ['day', 'deadline', 'when', 'calendar', 'due', 'time'],
  choice: ['dropdown', 'drop-down', 'select', 'option', 'single', 'picklist', 'enum', 'status'],
  multichoice: ['tags', 'multi-select', 'multiselect', 'multiple', 'many', 'select many'],
  checkbox: ['yes/no', 'yes', 'no', 'tick', 'toggle', 'boolean', 'true/false', 'done', 'switch'],
  labels: ['tags', 'tag', 'multi-select', 'category', 'categories', 'keywords'],
  person: ['people', 'owner', 'reviewer', 'user', 'member', 'who', 'teammate', 'assign'],
  checklist: ['to-do', 'todo', 'to-dos', 'subtasks', 'sub-tasks', 'steps'],
  comments: ['discussion', 'thread', 'chat', 'conversation', 'reply'],
  votes: ['like', 'upvote', 'thumbs', 'poll', 'dot vote'],
  colour: ['color', 'swatch', 'hue', 'highlight', 'tint'],
  image: ['picture', 'photo', 'screenshot', 'mock-up', 'mockup', 'upload', 'attachment', 'cover'],
  card: ['parent', 'epic', 'relation', 'related', 'reference', 'child', 'linked card', 'lookup'],
  calculated: [
    'percent',
    'percentage',
    'progress',
    'formula',
    'computed',
    'rollup',
    'roll-up',
    'sum',
    'total',
  ],
};

// The built-in fields of each kind, in the order Ready to use offers them: what the features that use a role read
// (the Gantt chart's dates, Workload's person, a card's colour). Every built-in field a type can add is here once.
export const BUILT_INS_OF_KIND: Partial<Record<PickKind, readonly ItemFieldId[]>> = {
  longtext: ['description'],
  number: ['estimate'],
  date: ['start', 'due'],
  choice: ['priority'],
  labels: ['labels'],
  person: ['assignee'],
  checklist: ['checklist'],
  comments: ['comments'],
  votes: ['votes'],
  colour: ['color'],
};

// What uses each built-in field, one line under its name in Ready to use.
export const BUILT_IN_ROLES: Partial<Record<ItemFieldId, string>> = {
  description: 'The card’s main notes, with rich text',
  estimate: 'Story points, summed in Workload',
  start: 'Where its bar starts on the Gantt chart',
  due: 'On the calendar and the Gantt chart',
  priority: 'Urgent to Low, for sorting and swimlanes',
  labels: 'Filters, swimlanes and coloured chips',
  assignee: 'Notifies them, and fills My Work and Workload',
  checklist: 'Progress on the card, like 2/5',
  color: 'A dot on the card, and its bar on the Gantt chart',
};

/** The built-in fields of `kind` the type lacks (`missing`), in Ready to use's order. */
export const readyBuiltIns = (kind: PickKind, missing: readonly ItemFieldId[]): ItemFieldId[] =>
  (BUILT_INS_OF_KIND[kind] ?? []).filter((id) => missing.includes(id));

/** A search as matched: trimmed, lower-cased, runs of spaces made one. */
export const searchKey = (query: string): string => query.trim().toLowerCase().replace(/\s+/g, ' ');

function matchesWords(haystacks: readonly string[], key: string): boolean {
  if (!key) return true;
  if (haystacks.some((h) => h.includes(key))) return true;
  // Every word of it found somewhere ("money amount", "card parent").
  const words = key.split(' ');
  return words.length > 1 && words.every((w) => haystacks.some((h) => h.includes(w)));
}

/**
 * Whether a kind answers a search (`key` from searchKey): by its name, its line, a word for it, or the name of one of
 * its built-in fields (`builtInNames`: "due" finds Date).
 */
export function kindMatches(
  kind: PickKind,
  label: string,
  key: string,
  builtInNames: readonly string[] = [],
): boolean {
  return matchesWords(
    [
      label.toLowerCase(),
      KIND_DESCRIPTIONS[kind].toLowerCase(),
      ...KIND_ALIASES[kind],
      ...builtInNames.map((n) => n.toLowerCase()),
    ],
    key,
  );
}

export const hasOptions = (kind: CustomFieldKind) => kind === 'choice' || kind === 'multichoice';

export type Readiness = 'name' | 'options' | 'links';

/** What a new field still needs before it can be added (null: nothing): a name, an option, a type it links to. */
export function kindReadiness(field: Omit<CustomFieldDef, 'id'>): Readiness | null {
  if (!field.label.trim()) return 'name';
  if (hasOptions(field.kind) && (field.options?.length ?? 0) === 0) return 'options';
  if (field.kind === 'card' && linkTypesOf(field).length === 0) return 'links';
  return null;
}

export const READINESS_HINT: Record<Readiness, string> = {
  name: 'Name the field to add it.',
  options: 'Add at least one option.',
  links: 'Pick a card type it links to.',
};

export const CUSTOM_MAX_NOTE = (max: number) =>
  `This type holds the most custom fields it can (${max}). Remove one to add another.`;
