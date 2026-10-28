// Add Field's catalogue and matching (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field): the thirteen
// custom field kinds in four groups, each with a one-line description and a few everyday words it is searched by,
// how a search matches a kind or a built-in field, and what a new field still needs before it can be added.
import {
  linkTypesOf,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemFieldId,
} from '@liveplanner/items';

export type KindGroupId = 'text' | 'numbers' | 'choices' | 'cards';

export type KindGroup = { id: KindGroupId; label: string; kinds: readonly CustomFieldKind[] };

// The owner's groups, in order; the first opens to start.
export const KIND_GROUPS: readonly KindGroup[] = [
  { id: 'text', label: 'Text & links', kinds: ['text', 'longtext', 'link', 'email'] },
  { id: 'numbers', label: 'Numbers & dates', kinds: ['number', 'currency', 'rating', 'date'] },
  { id: 'choices', label: 'Choices', kinds: ['choice', 'multichoice', 'checkbox'] },
  { id: 'cards', label: 'Linked cards', kinds: ['card', 'calculated'] },
];

export const groupOfKind = (kind: CustomFieldKind): KindGroupId =>
  KIND_GROUPS.find((g) => g.kinds.includes(kind))?.id ?? KIND_GROUPS[0]!.id;

// What each kind holds, in plain words, one line.
export const KIND_DESCRIPTIONS: Record<CustomFieldKind, string> = {
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
  card: 'Another card, like a parent or an epic',
  calculated: 'Worked out from the cards linked here',
};

// The everyday words people reach for, beyond a kind's name and line.
export const KIND_ALIASES: Record<CustomFieldKind, readonly string[]> = {
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

/** A search as matched: trimmed, lower-cased, runs of spaces made one. */
export const searchKey = (query: string): string => query.trim().toLowerCase().replace(/\s+/g, ' ');

function matchesWords(haystacks: readonly string[], key: string): boolean {
  if (!key) return true;
  if (haystacks.some((h) => h.includes(key))) return true;
  // Every word of it found somewhere ("money amount", "card parent").
  const words = key.split(' ');
  return words.length > 1 && words.every((w) => haystacks.some((h) => h.includes(w)));
}

/** Whether a kind answers a search (`key` from searchKey): by its name, its line or a word for it. */
export function kindMatches(kind: CustomFieldKind, label: string, key: string): boolean {
  return matchesWords(
    [label.toLowerCase(), KIND_DESCRIPTIONS[kind].toLowerCase(), ...KIND_ALIASES[kind]],
    key,
  );
}

/** Whether a built-in field answers a search: by its name. */
export function builtInMatches(label: string, key: string): boolean {
  return matchesWords([label.toLowerCase()], key);
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

/** The built-ins a search leaves, in their order. */
export const matchingBuiltIns = (
  missing: readonly ItemFieldId[],
  labelOf: (id: ItemFieldId) => string,
  key: string,
): ItemFieldId[] => missing.filter((id) => builtInMatches(labelOf(id), key));
