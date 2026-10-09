// Ready-made card types (docs/specs/026-plan/plan-templates.md "Ready-made card types"): the card types a board brings
// into a document when it is made. The five default types live in item-types.ts; these are the ten more a template or
// preset uses where none of the five fits the work: a Bug Triage board takes Bugs, a Hiring Pipeline's Pipeline board
// Candidates. Making a board chooses or adds the document's card types (catalogueWithBoardTypes); a document that
// already has a type (by id) keeps its own. Pure data, one catalogue the board presets and the Plan templates share.
import type { CardField } from './board';
import { ITEM_TYPES, PARENT_FIELD, type CustomFieldDef, type ItemTypeDef } from './item-types';
import {
  ITEM_TYPES_MAX,
  typesOf,
  ITEM_TYPE_CATALOGUE_VERSION,
  type ItemTypeCatalogue,
} from './type-catalogue';
import { normaliseBoardSetup } from './board';

const WORK = [
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

const text = (id: string, label: string): CustomFieldDef => ({ id, label, kind: 'text' });
const number = (id: string, label: string): CustomFieldDef => ({ id, label, kind: 'number' });
const card = (id: string, label: string, linkType: string): CustomFieldDef => ({
  id,
  label,
  kind: 'card',
  linkType,
});
const choice = (id: string, label: string, options: readonly string[]): CustomFieldDef => ({
  id,
  label,
  kind: 'choice',
  options,
});

// A Detailed card as a board drew one before layouts existed, with `body` (the type's own fields) Under the Title.
function detailedWith(body: readonly CardField[], foot: readonly CardField[]) {
  return {
    detailed: {
      head: ['type', 'key'] as CardField[],
      headEnd: ['priority'] as CardField[],
      body: [...body, 'description', 'labels'] as CardField[],
      foot: [...foot, 'checklist', 'comments', 'votes'] as CardField[],
      footEnd: ['assignee'] as CardField[],
    },
  };
}

const BROUGHT = [
  {
    id: 'bug',
    label: 'Bug',
    newTitle: 'New bug',
    glyph: 'bug',
    color: '#dc2626',
    fields: [...WORK, 'f-steps-to-reproduce', 'f-environment'],
    custom: [
      PARENT_FIELD,
      { id: 'f-steps-to-reproduce', label: 'Steps to Reproduce', kind: 'longtext' },
      text('f-environment', 'Environment'),
    ],
  },
  {
    id: 'story',
    label: 'Story',
    newTitle: 'New story',
    glyph: 'story',
    color: '#7c3aed',
    fields: WORK,
    custom: [PARENT_FIELD],
  },
  // An ask from someone outside the team (Kanban's Requests, Feedback Board's Feedback).
  {
    id: 'request',
    label: 'Request',
    newTitle: 'New request',
    glyph: 'inbox',
    color: '#ea580c',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'priority',
      'f-requested-by',
      'votes',
      'labels',
    ],
    custom: [text('f-requested-by', 'Requested By')],
    display: detailedWith(['f-requested-by'], ['due']),
  },
  // A piece of content, from idea to published (Content Calendar).
  {
    id: 'content',
    label: 'Content',
    newTitle: 'New content',
    glyph: 'megaphone',
    color: '#db2777',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-channel',
      'due',
      'f-link',
      'votes',
      'checklist',
      'labels',
    ],
    custom: [
      choice('f-channel', 'Channel', ['Blog', 'Newsletter', 'Social', 'Video', 'Podcast']),
      { id: 'f-link', label: 'Link', kind: 'link' },
    ],
    display: detailedWith(['f-channel'], ['due']),
  },
  // An open role (Hiring Pipeline): dated, so the Gantt chart draws it.
  {
    id: 'role',
    label: 'Role',
    newTitle: 'New role',
    glyph: 'briefcase',
    color: '#0891b2',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-team',
      'f-location',
      'f-employment',
      'priority',
      'color',
      'start',
      'due',
      'labels',
    ],
    custom: [
      text('f-team', 'Team'),
      text('f-location', 'Location'),
      choice('f-employment', 'Employment', ['Full-time', 'Part-time', 'Contract', 'Internship']),
    ],
    display: detailedWith(['f-team'], ['start', 'due']),
  },
  // Someone applying for a Role (Hiring Pipeline): the Pipeline lays a row per role by their Role.
  {
    id: 'candidate',
    label: 'Candidate',
    newTitle: 'New candidate',
    glyph: 'user-plus',
    color: '#db2777',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-role',
      'f-source',
      'f-profile',
      'due',
      'checklist',
      'labels',
    ],
    custom: [
      card('f-role', 'Role', 'role'),
      choice('f-source', 'Source', ['Referral', 'Job Board', 'Inbound', 'Agency', 'Sourced']),
      { id: 'f-profile', label: 'Profile', kind: 'link' },
    ],
  },
  // A step in a new starter's first month (Hiring Pipeline): a row per New Starter.
  {
    id: 'onboarding-task',
    label: 'Onboarding Task',
    newTitle: 'New onboarding task',
    glyph: 'checklist',
    color: '#16a34a',
    fields: ['title', 'description', 'status', 'assignee', 'f-new-starter', 'due', 'checklist'],
    custom: [card('f-new-starter', 'New Starter', 'candidate')],
  },
  // An objective for the period (OKRs): dated, so the Gantt chart draws it.
  {
    id: 'objective',
    label: 'Objective',
    newTitle: 'New objective',
    glyph: 'target',
    color: '#d97706',
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
  // A measure of an Objective (OKRs): a row per objective, its Current against its Target on the card.
  {
    id: 'key-result',
    label: 'Key Result',
    newTitle: 'New key result',
    glyph: 'trend',
    color: '#0d9488',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-objective',
      'f-baseline',
      'f-target',
      'f-current',
      'due',
      'checklist',
    ],
    custom: [
      card('f-objective', 'Objective', 'objective'),
      number('f-baseline', 'Baseline'),
      number('f-target', 'Target'),
      number('f-current', 'Current'),
    ],
    display: detailedWith(['f-current', 'f-target'], ['due']),
  },
  // A go / no-go item on launch day (Product Launch), under its workstream.
  {
    id: 'launch-check',
    label: 'Launch Check',
    newTitle: 'New launch check',
    glyph: 'flag',
    color: '#16a34a',
    fields: ['title', 'description', 'status', 'assignee', 'f-workstream', 'priority'],
    custom: [card('f-workstream', 'Workstream', 'project')],
    display: detailedWith(['f-workstream'], []),
  },
] as const satisfies readonly ItemTypeDef[];

// Every type offers comments, last, as the default types do (docs/specs/026-plan/items.md "Comments").
const MORE_CARD_TYPES: readonly ItemTypeDef[] = BROUGHT.map((t) => ({
  ...t,
  fields: [...t.fields, 'comments'],
}));

// Every card type a board can bring (docs/specs/026-plan/plan-templates.md "Ready-made card types"): the five default
// types, then the ten the templates and presets add. None is set apart from a type a person makes.
export const READY_MADE_CARD_TYPES: readonly ItemTypeDef[] = [...ITEM_TYPES, ...MORE_CARD_TYPES];

const DEFAULT_TYPE_IDS: readonly string[] = ITEM_TYPES.map((t) => t.id);

// The ready-made types named (ids, in order) that the document lacks, each once. One whose name a type of the
// document already has (one renamed "Task", say) is left out: names are unique within a catalogue.
export function broughtTypesToAdd(
  named: readonly string[] | undefined,
  types: readonly ItemTypeDef[],
): ItemTypeDef[] {
  const have = new Set(types.map((t) => t.id));
  const labels = new Set(types.map((t) => t.label.toLowerCase()));
  const out: ItemTypeDef[] = [];
  for (const id of named ?? []) {
    const t = READY_MADE_CARD_TYPES.find((b) => b.id === id);
    if (!t || have.has(id) || labels.has(t.label.toLowerCase())) continue;
    have.add(id);
    labels.add(t.label.toLowerCase());
    out.push(t);
  }
  return out;
}

// The default types the document lacks (Add Default Types), in their order, as many as there is room for.
export function defaultTypesToAdd(types: readonly ItemTypeDef[]): ItemTypeDef[] {
  return broughtTypesToAdd(DEFAULT_TYPE_IDS, types).slice(
    0,
    Math.max(0, ITEM_TYPES_MAX - types.length),
  );
}

type BoardLike = { type?: unknown; shape?: unknown; planBoard?: unknown };

// The card type ids the Plan boards among `elements` bring, in board order (docs/specs/026-plan/item-types.md
// "The type catalogue"): a board's Card Types; a board that takes every type (Blank) brings the five default types;
// an Archive or All Cards board brings none.
export function boardTypeIdsOf(elements: readonly BoardLike[]): string[] {
  const named: string[] = [];
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'plan-board') continue;
    const setup = normaliseBoardSetup(el.planBoard);
    if (!setup || setup.archive || setup.allCards) continue;
    named.push(...(setup.addTypes ?? DEFAULT_TYPE_IDS));
  }
  return named;
}

// Whether a board among `elements` takes every type (Blank): made first, it chose the default types while storing
// nothing, so a later board is not among the first and only adds what is missing.
export function hasBlankBoard(elements: readonly BoardLike[]): boolean {
  return elements.some((el) => {
    if (el.type !== 'shape' || el.shape !== 'plan-board') return false;
    const setup = normaliseBoardSetup(el.planBoard);
    return !!setup && !setup.archive && !setup.allCards && setup.addTypes === undefined;
  });
}

// The ready-made types the Plan boards among `elements` bring that the document lacks, in board order.
export function boardTypesToAdd(
  elements: readonly BoardLike[],
  types: readonly ItemTypeDef[],
): ItemTypeDef[] {
  return broughtTypesToAdd(boardTypeIdsOf(elements), types);
}

const sameIds = (a: readonly ItemTypeDef[], b: readonly ItemTypeDef[]) =>
  a.length === b.length && a.every((t, i) => t.id === b[i]!.id);

// The catalogue a document holds once the boards among `elements` are made in it (docs/specs/026-plan/item-types.md
// "The type catalogue"), or null when that is what it holds already.
// - Not chosen yet (`stored` null), no cards (`hasCards` false) and no Blank board already there (`hadBlank` false,
//   hasBlankBoard): the first boards choose its card types, exactly the ones they bring. Bringing just the five
//   default types is what it reads as already: null.
// - A Blank board already there chose the default types (storing nothing): a later board adds what it lacks, as
//   below.
// - Otherwise: `stored` (or the default types) with the types the boards bring that it lacks after them, at most
//   ITEM_TYPES_MAX in all.
export function catalogueWithBoardTypes(
  stored: ItemTypeCatalogue | null,
  elements: readonly BoardLike[],
  hasCards = false,
  hadBlank = false,
): ItemTypeCatalogue | null {
  if (stored === null && !hasCards && !hadBlank) {
    const chosen = broughtTypesToAdd(boardTypeIdsOf(elements), []).slice(0, ITEM_TYPES_MAX);
    if (chosen.length === 0 || sameIds(chosen, ITEM_TYPES)) return null;
    return { version: ITEM_TYPE_CATALOGUE_VERSION, types: chosen };
  }
  const types = typesOf(stored);
  const room = ITEM_TYPES_MAX - types.length;
  const missing = boardTypesToAdd(elements, types).slice(0, Math.max(0, room));
  if (missing.length === 0) return null;
  return { version: ITEM_TYPE_CATALOGUE_VERSION, types: [...types, ...missing] };
}
