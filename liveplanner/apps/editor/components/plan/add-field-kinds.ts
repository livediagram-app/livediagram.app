// Add Field's catalogue and matching (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field): one list of
// field kinds in nine categories, built-in and custom alike, each with a one-line description and a few everyday
// words it is searched by; the built-in fields of each kind (offered as Ready to use) with what uses them; how a
// search matches a kind and narrows the categories; and what a new field still needs before it can be added.
import {
  isFormulaField,
  isLookupField,
  isRollupField,
  aggregateOf,
  aggregateReads,
  linkTypesOf,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemFieldId,
} from '@liveplanner/items';

// A kind-shaping option preset as a tile of its own (item-types.md "Fields and Tabs": Add Field, Variants): the same
// stored kind, made with the option already on, so the option is found in the gallery rather than in a field's form.
export const KIND_VARIANTS = {
  people: { kind: 'person', preset: { multiple: true } },
  'time-tracking': { kind: 'duration', preset: { timeSpent: true } },
  'datetime-range': { kind: 'daterange', preset: { withTime: true } },
  cards: { kind: 'card', preset: { multiple: true } },
  'blocked-by': { kind: 'card', preset: { blocks: true, multiple: true } },
  formula: { kind: 'calculated', preset: { calculation: 'formula' } },
  rollup: { kind: 'calculated', preset: { calculation: 'rollup' } },
  lookup: { kind: 'calculated', preset: { calculation: 'lookup' } },
} as const satisfies Record<
  string,
  { kind: CustomFieldKind; preset: Partial<Omit<CustomFieldDef, 'id' | 'label' | 'kind'>> }
>;

export type KindVariant = keyof typeof KIND_VARIANTS;

// A tile Add Field lists: every custom field kind, Comments and Votes among them (item-types.md "Comments and Votes
// fields"), and each variant, each opening Shape.
export type PickKind = CustomFieldKind | KindVariant;

const isVariant = (pick: PickKind): pick is KindVariant => pick in KIND_VARIANTS;

/** The kind a pick is stored as. */
export const storedKindOf = (pick: PickKind): CustomFieldKind =>
  isVariant(pick) ? KIND_VARIANTS[pick].kind : pick;

/** The settings a pick starts with (none for a plain kind). */
export const presetOf = (pick: PickKind): Partial<CustomFieldDef> =>
  isVariant(pick) ? KIND_VARIANTS[pick].preset : {};

/**
 * The tile a field being shaped answers to: its variant while its kind-shaping option is on (Blocked By before
 * Several Cards, as a Blocked By field holds several), else its kind. Turning the option off in Shape makes it the
 * plain kind again.
 */
export function pickOf(
  field: Pick<CustomFieldDef, 'kind'> &
    Partial<Pick<CustomFieldDef, 'multiple' | 'blocks' | 'timeSpent' | 'withTime' | 'calculation'>>,
): PickKind {
  switch (field.kind) {
    case 'person':
      return field.multiple ? 'people' : 'person';
    case 'duration':
      return field.timeSpent ? 'time-tracking' : 'duration';
    case 'daterange':
      return field.withTime ? 'datetime-range' : 'daterange';
    case 'card':
      return field.blocks ? 'blocked-by' : field.multiple ? 'cards' : 'card';
    case 'calculated':
      return field.calculation === 'formula' ||
        field.calculation === 'rollup' ||
        field.calculation === 'lookup'
        ? field.calculation
        : 'calculated';
    default:
      return field.kind;
  }
}

export type KindCategoryId =
  'text' | 'numbers' | 'dates' | 'time' | 'choices' | 'people' | 'links' | 'cards' | 'calculated';

export type KindCategory = {
  id: KindCategoryId;
  label: string;
  // Its line under its heading.
  line: string;
  kinds: readonly PickKind[];
};

// The categories, in the rail's order; every kind and variant in exactly one, a variant after its kind.
export const KIND_CATEGORIES: readonly KindCategory[] = [
  {
    id: 'text',
    label: 'Text',
    line: 'Words, from a title to pages of notes.',
    kinds: ['text', 'longtext'],
  },
  {
    id: 'numbers',
    label: 'Numbers',
    line: 'Counts, amounts, shares and scores.',
    kinds: ['number', 'currency', 'percent', 'rating'],
  },
  {
    id: 'dates',
    label: 'Dates',
    line: 'Days, moments and spans on the calendar.',
    kinds: ['date', 'datetime', 'daterange', 'datetime-range'],
  },
  {
    id: 'time',
    label: 'Time',
    line: 'How long something takes, or the time spent on it.',
    kinds: ['duration', 'time-tracking'],
  },
  {
    id: 'choices',
    label: 'Choices',
    line: 'Pick from a list, tick a box or tag a card.',
    kinds: ['choice', 'multichoice', 'checkbox', 'checklist', 'labels', 'colour'],
  },
  {
    id: 'people',
    label: 'People',
    line: 'Who has it, and what the team says about it.',
    kinds: ['person', 'people', 'comments', 'votes'],
  },
  {
    id: 'links',
    label: 'Links and Images',
    line: 'Web pages, contact details and pictures.',
    kinds: ['link', 'pullrequest', 'email', 'phone', 'image'],
  },
  {
    id: 'cards',
    label: 'Cards',
    line: 'Connect a card to other cards.',
    kinds: ['card', 'cards', 'blocked-by'],
  },
  {
    id: 'calculated',
    label: 'Calculated',
    line: 'Values worked out for you.',
    kinds: ['calculated', 'formula', 'rollup', 'lookup'],
  },
];

export const categoryOfKind = (kind: PickKind): KindCategory =>
  KIND_CATEGORIES.find((c) => c.kinds.includes(kind)) ?? KIND_CATEGORIES[0]!;

// A category with the kinds a search leaves in it (all of them with no search).
export type ShownCategory = KindCategory & { shown: readonly PickKind[] };

/**
 * Every category with the kinds that answer `key` (from searchKey), in order: a kind by its name (`labelOf`), its
 * line, a word for it, or the name of one of its built-in fields (`builtInNamesOf`). A category's own name is
 * not searched: "money" would find every kind under Numbers and Money.
 */
export function shownCategories(
  key: string,
  labelOf: (kind: PickKind) => string,
  builtInNamesOf: (kind: PickKind) => readonly string[],
): ShownCategory[] {
  return KIND_CATEGORIES.map((c) => ({
    ...c,
    shown: key
      ? c.kinds.filter((k) => kindMatches(k, labelOf(k), key, builtInNamesOf(k)))
      : c.kinds,
  }));
}

// What each kind holds, in plain words, one line.
export const KIND_DESCRIPTIONS: Record<PickKind, string> = {
  text: 'A short line of text',
  longtext: 'Paragraphs of notes',
  link: 'A web address',
  pullrequest: 'A GitHub pull request, with its state',
  email: 'An address that opens your mail app',
  phone: 'A number that calls on a phone',
  number: 'Points, counts and sizes',
  currency: 'An amount, like £12,500',
  percent: 'How far along, drawn as a bar',
  duration: 'Hours and minutes, like an estimate',
  'time-tracking': 'Time logged on the card with a timer',
  rating: 'Stars out of 3 to 10',
  date: 'A day on the calendar',
  datetime: 'A day and a time, in each person’s time zone',
  daterange: 'From one day to another',
  'datetime-range': 'From one moment to another, like a meeting',
  choice: 'One option from a list',
  multichoice: 'Several options from a list',
  checkbox: 'Yes or no, ticked or not',
  labels: 'Short tags, coloured by name',
  person: 'Someone on the plan, like an owner',
  people: 'A few people at once, like reviewers',
  checklist: 'To-dos ticked off one by one',
  comments: 'Threads to talk the card through',
  votes: 'Thumbs up from the team',
  colour: 'A colour to tell cards apart',
  image: 'A picture, like a mock-up or a photo',
  card: 'Another card, like a parent or an epic',
  cards: 'Several linked cards, like an epic’s stories',
  'blocked-by': 'Cards that must be done before this one',
  calculated: 'Counts of child cards, or how many are done',
  formula: 'Works a value out from the card’s fields',
  rollup: 'A sum, average or count over linked cards',
  lookup: 'A field read from a linked card',
};

// The everyday words people reach for, beyond a kind's name and line.
export const KIND_ALIASES: Record<PickKind, readonly string[]> = {
  text: ['string', 'single line', 'short', 'code', 'title'],
  longtext: ['notes', 'paragraph', 'multiline', 'multi-line', 'description', 'essay'],
  link: ['url', 'website', 'web', 'href', 'hyperlink'],
  pullrequest: ['pr', 'github', 'merge request', 'code review', 'branch', 'git'],
  email: ['mail', 'e-mail', 'contact', 'inbox'],
  phone: ['mobile', 'tel', 'telephone', 'call', 'cell', 'contact', 'number'],
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
  percent: ['percentage', 'progress', 'complete', 'completion', '%', 'slider', 'bar'],
  duration: ['time', 'hours', 'minutes', 'length', 'estimate'],
  'time-tracking': [
    'timer',
    'tracking',
    'billable',
    'timesheet',
    'spent',
    'time spent',
    'logged',
    'hours',
  ],
  rating: ['stars', 'score', 'rank', 'review', 'grade'],
  date: ['day', 'deadline', 'when', 'calendar', 'due', 'time'],
  datetime: ['time', 'meeting', 'appointment', 'hour', 'clock', 'timestamp', 'deadline', 'when'],
  daterange: ['range', 'event', 'trip', 'period', 'span', 'from', 'until', 'dates', 'sprint'],
  'datetime-range': [
    'range',
    'meeting',
    'booking',
    'shift',
    'event',
    'times',
    'slot',
    'from',
    'until',
  ],
  choice: ['dropdown', 'drop-down', 'select', 'option', 'single', 'picklist', 'enum', 'status'],
  multichoice: ['tags', 'multi-select', 'multiselect', 'multiple', 'many', 'select many'],
  checkbox: ['yes/no', 'yes', 'no', 'tick', 'toggle', 'boolean', 'true/false', 'done', 'switch'],
  labels: ['tags', 'tag', 'multi-select', 'category', 'categories', 'keywords'],
  person: ['owner', 'user', 'member', 'who', 'teammate', 'assign'],
  people: ['people', 'reviewers', 'team', 'members', 'several', 'multiple', 'who'],
  checklist: ['to-do', 'todo', 'to-dos', 'subtasks', 'sub-tasks', 'steps'],
  comments: ['discussion', 'thread', 'chat', 'conversation', 'reply'],
  votes: ['like', 'upvote', 'thumbs', 'poll', 'dot vote'],
  colour: ['color', 'swatch', 'hue', 'highlight', 'tint'],
  image: ['picture', 'photo', 'screenshot', 'mock-up', 'mockup', 'upload', 'attachment', 'cover'],
  card: ['parent', 'epic', 'relation', 'related', 'reference', 'child', 'linked card'],
  cards: ['related', 'children', 'stories', 'linked cards', 'several', 'multiple', 'relation'],
  'blocked-by': [
    'blocked by',
    'blocker',
    'blocks',
    'depends on',
    'dependency',
    'waiting on',
    'prerequisite',
  ],
  calculated: ['computed', 'child count', 'children', 'done'],
  formula: ['formula', 'expression', 'calculate', 'math', 'compute'],
  rollup: ['rollup', 'roll-up', 'sum', 'total', 'average', 'aggregate', 'count'],
  lookup: ['lookup', 'look up', 'linked field', 'pull', 'mirror'],
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
  // A card's pictures, one its cover (items.md "Attachments"): offered beside Image, the kind it is made of.
  image: ['attachments'],
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
  comments: 'Threads on the card, and mentions in the Inbox',
  votes: 'Session votes, Top Voted and sorting',
  attachments: 'Pictures on the card, and its cover',
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

export type Readiness = 'name' | 'options' | 'links' | 'formula' | 'through' | 'source';

/** What a new field still needs before it can be added (null: nothing): a name, an option, a type it links to. */
export function kindReadiness(field: Omit<CustomFieldDef, 'id'>): Readiness | null {
  if (!field.label.trim()) return 'name';
  if (hasOptions(field.kind) && (field.options?.length ?? 0) === 0) return 'options';
  if (field.kind === 'card' && linkTypesOf(field).length === 0) return 'links';
  // A Formula holds one only while it works (FormulaEditor): docs/specs/026-plan/item-types.md "Formula fields".
  if (isFormulaField(field) && !field.formula) return 'formula';
  // A Lookup reads through one of the type's Card fields; a Rollup's calculation (but Count) and a Lookup read a
  // field (docs/specs/026-plan/item-types.md "Rollup and Lookup fields").
  if (isLookupField(field) && !field.through) return 'through';
  if (
    (isLookupField(field) ||
      (isRollupField(field) && aggregateReads(aggregateOf(field)) !== 'none')) &&
    !field.source
  )
    return 'source';
  return null;
}

export const READINESS_HINT: Record<Readiness, string> = {
  name: 'Name the field to add it.',
  options: 'Add at least one option.',
  links: 'Pick a card type it links to.',
  formula: 'Write a formula that works.',
  through: 'Pick a Link to Card field to read through.',
  source: 'Pick a field to read.',
};

export const CUSTOM_MAX_NOTE = (max: number) =>
  `This type holds the most custom fields it can (${max}). Remove one to add another.`;
