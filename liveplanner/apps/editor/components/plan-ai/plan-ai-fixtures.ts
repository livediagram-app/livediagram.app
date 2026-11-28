// Plan AI's test fixtures: a board of two columns and two card types, with cards on it.
import type { Item, ItemFields, ItemTypeDef, PlanBoardSetup } from '@liveplanner/items';

const SAM = { id: 'p-sam', name: 'Sam Lee', color: '#2563eb' };

export const TASK: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#71717a',
  fields: ['title', 'status', 'assignee', 'priority', 'due', 'labels', 'description', 'f-size'],
  custom: [{ id: 'f-size', label: 'Size', kind: 'number' }],
};
export const BUG: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'priority', 'f-sev'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'], required: true },
  ],
};
export const TYPES = [TASK, BUG];

export const SETUP: PlanBoardSetup = {
  title: 'Roadmap',
  columns: [
    { id: 'c1', status: 'todo', name: 'To Do' },
    { id: 'c2', status: 'done', name: 'Done' },
  ],
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
};

export function card(id: string, key: number, fields: ItemFields, extra: Partial<Item> = {}): Item {
  return {
    id,
    type: 'task',
    key,
    rank: `a${key}`,
    fields,
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: SAM,
    updatedBy: SAM,
    ...extra,
  };
}

export const ITEMS: ReadonlyMap<string, Item> = new Map(
  [
    card('i1', 1, { title: 'Write brief', status: 'todo', assignee: SAM, 'f-size': 3 }),
    card('i2', 2, {
      title: 'Ship it',
      status: 'done',
      description: 'All of it\n now',
      flagged: true,
    }),
    card('i3', 3, { title: 'Old', status: 'trash' }),
  ].map((i) => [i.id, i]),
);
