// The preview of an import (docs/specs/026-plan/tracker-import.md "The preview"): the columns it makes with their
// cards, how each source field maps to a card field (built-in or new) with how many cards have it, the people, the
// comments, what is left out, and whether this plan has room for it all. Worked out once, with the plan.
import type { ItemFields } from '../item';
import type { TrackerBoard, TrackerSkipReason, TrackerSkips, TrackerSource } from './tracker-model';
import { TRACKER_SOURCE_NAMES } from './tracker-model';
import type { TrackerTypeResult } from './tracker-type';

type MappedField =
  | 'title'
  | 'status'
  | 'description'
  | 'assignee'
  | 'priority'
  | 'estimate'
  | 'start'
  | 'due'
  | 'labels'
  | 'checklist'
  | 'comments';

// Each source's own name for what fills a built-in field, in the order the preview lists them.
const SOURCE_FIELDS: Readonly<Record<TrackerSource, readonly (readonly [MappedField, string])[]>> =
  {
    trello: [
      ['title', 'Card name'],
      ['status', 'List'],
      ['description', 'Description'],
      ['assignee', 'Members'],
      ['priority', 'Priority labels'],
      ['start', 'Start date'],
      ['due', 'Due date'],
      ['labels', 'Labels'],
      ['checklist', 'Checklists'],
      ['comments', 'Comments'],
    ],
    asana: [
      ['title', 'Name'],
      ['status', 'Section/Column'],
      ['description', 'Notes'],
      ['assignee', 'Assignee'],
      ['priority', 'Priority'],
      ['start', 'Start Date'],
      ['due', 'Due Date'],
      ['labels', 'Tags'],
    ],
    jira: [
      ['title', 'Summary'],
      ['status', 'Status'],
      ['description', 'Description'],
      ['assignee', 'Assignee'],
      ['priority', 'Priority'],
      ['estimate', 'Story Points'],
      ['start', 'Start date'],
      ['due', 'Due date'],
      ['labels', 'Labels'],
      ['comments', 'Comment'],
    ],
    linear: [
      ['title', 'Title'],
      ['status', 'Status'],
      ['description', 'Description'],
      ['assignee', 'Assignee'],
      ['priority', 'Priority'],
      ['estimate', 'Estimate'],
      ['start', 'Started'],
      ['due', 'Due Date'],
      ['labels', 'Labels'],
    ],
  };

const CARD_FIELD_NAMES: Readonly<Record<MappedField, string>> = {
  title: 'Title',
  status: 'Column',
  description: 'Description',
  assignee: 'Assignee',
  priority: 'Priority',
  estimate: 'Estimate',
  start: 'Start',
  due: 'Due',
  labels: 'Labels',
  checklist: 'Checklist',
  comments: 'Imported comments',
};

const SKIP_LABELS: Readonly<Record<TrackerSkipReason, string>> = {
  archivedCards: 'Archived cards',
  archivedLists: 'Archived lists',
  untitledRows: 'Rows with no title',
  commentsOverCap: 'Comments past the cap',
  attachmentLinks: 'Attachments, kept as links in the description',
  attachmentsNoLink: 'Attachments with no link',
  otherColumn: 'Cards whose status is folded into Other',
  shortened: 'Cards shortened to fit',
  invalidCards: "Cards that couldn't be read",
};

const SKIP_ORDER = Object.keys(SKIP_LABELS) as TrackerSkipReason[];

export interface TrackerPreview {
  source: TrackerSource;
  sourceName: string;
  title: string;
  cards: number;
  columns: { name: string; cards: number }[];
  fields: { from: string; to: string; isNew: boolean; cards: number }[];
  // People matched to team members by email, already on the plan by name, and new named people.
  people: { matched: number; onPlan: number; named: number };
  comments: { count: number; cards: number };
  skips: { reason: TrackerSkipReason; label: string; count: number }[];
  // Whether this plan can take it all: room for every card, and for the card type.
  fits: boolean;
  reason?: string;
  // The type's name, and whether the plan gains it.
  typeName: string;
  typeIsNew: boolean;
}

const has = (fields: ItemFields, key: string) => fields[key] !== undefined;

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

export function trackerPreview(input: {
  board: TrackerBoard;
  columns: readonly string[];
  columnOf: (column: string) => string;
  creates: readonly { fields: ItemFields; importedComments: readonly unknown[] }[];
  typed: TrackerTypeResult;
  people: TrackerPreview['people'];
  skips: TrackerSkips;
  room: number;
}): TrackerPreview {
  const { board, creates, typed } = input;
  const perColumn = new Map(input.columns.map((c) => [c, 0]));
  for (const card of board.cards) {
    const column = input.columnOf(card.column);
    perColumn.set(column, (perColumn.get(column) ?? 0) + 1);
  }
  const count = (key: MappedField): number => {
    if (key === 'title' || key === 'status') return creates.length;
    if (key === 'comments') return creates.filter((c) => c.importedComments.length > 0).length;
    return creates.filter((c) => has(c.fields, key)).length;
  };
  const fields: TrackerPreview['fields'] = [];
  for (const [key, from] of SOURCE_FIELDS[board.source]) {
    const cards = count(key);
    if (cards > 0) fields.push({ from, to: CARD_FIELD_NAMES[key], isNew: false, cards });
  }
  for (const extra of board.extras) {
    const field = typed.fieldOf.get(extra.key);
    if (!field) continue;
    const cards = creates.filter((c) => has(c.fields, field.id)).length;
    fields.push({
      from: extra.from ?? extra.label,
      to: field.label,
      isNew: typed.newFields.has(field.id),
      cards,
    });
  }
  const commentCount = creates.reduce((n, c) => n + c.importedComments.length, 0);
  const roomy = creates.length <= input.room;
  const reason = !roomy
    ? `This plan has room for ${plural(Math.max(0, input.room), 'more card')} and this file has ${creates.length.toLocaleString('en-GB')}.`
    : !typed.fits
      ? `This plan's card types are full, so it can't take the ${typed.type.label} type.`
      : undefined;
  return {
    source: board.source,
    sourceName: TRACKER_SOURCE_NAMES[board.source],
    title: board.title,
    cards: creates.length,
    columns: input.columns.map((name) => ({ name, cards: perColumn.get(name) ?? 0 })),
    fields,
    people: input.people,
    comments: { count: commentCount, cards: count('comments') },
    skips: SKIP_ORDER.filter((r) => (input.skips[r] ?? 0) > 0).map((reason) => ({
      reason,
      label: SKIP_LABELS[reason],
      count: input.skips[reason]!,
    })),
    fits: reason === undefined,
    ...(reason ? { reason } : {}),
    typeName: typed.type.label,
    typeIsNew: typed.isNew,
  };
}

// The footer's line: what the import will make where it goes.
export function trackerSummary(preview: TrackerPreview, target: 'tab' | 'plan'): string {
  const what = `${plural(preview.columns.length, 'column')} and ${plural(preview.cards, 'card')}`;
  return target === 'tab'
    ? `Makes a Board tab with ${what}.`
    : `Makes a new plan with a Board tab of ${what}.`;
}

// What the plan says once it is done.
export function trackerDoneMessage(preview: TrackerPreview, added: number): string {
  const left = preview.skips
    .filter((s) => s.reason !== 'attachmentLinks' && s.reason !== 'shortened')
    .reduce((n, s) => n + s.count, 0);
  const base = `Imported ${plural(added, 'card')} from ${preview.sourceName}`;
  return left ? `${base}, ${left.toLocaleString('en-GB')} left out` : base;
}
