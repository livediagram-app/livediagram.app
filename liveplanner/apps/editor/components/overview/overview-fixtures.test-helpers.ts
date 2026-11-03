// Fixtures for the Overview's tests: cards, card types and tabs as the editor holds them, built plainly.
import type { Item, ItemPerson, ItemTypeDef } from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';

export const ANA: ItemPerson = { id: 'ana', name: 'Ana Moreno', color: '#b4461c' };
export const JO: ItemPerson = { id: 'jo', name: 'Jo Reyes', color: '#2563a8' };

export const type = (id: string, label: string, color: string, fields = 3): ItemTypeDef => ({
  id,
  label,
  newTitle: label,
  glyph: 'item',
  color,
  fields: Array.from({ length: fields }, (_, i) => `f${i}`),
});

export const TYPES: ItemTypeDef[] = [
  type('bug', 'Bug', '#ef4444', 7),
  type('task', 'Task', '#3b82f6', 4),
  type('incident', 'Incident', '#f97316', 6),
];

export function card(
  id: string,
  over: Partial<Omit<Item, 'fields'>> & { fields?: Item['fields'] } = {},
): Item {
  return {
    id,
    type: 'bug',
    key: Number(id.replace(/\D/g, '')) || 1,
    rank: id,
    rev: 1,
    createdAt: 1_000,
    updatedAt: 1_000,
    createdBy: ANA,
    updatedBy: ANA,
    ...over,
    fields: { title: `Card ${id}`, status: 'todo', ...over.fields },
  };
}

export const itemsOf = (cards: Item[]): Map<string, Item> => new Map(cards.map((c) => [c.id, c]));

export const COLUMNS = [
  { id: 'c1', status: 'todo', name: 'To Do' },
  { id: 'c2', status: 'doing', name: 'Doing' },
  { id: 'c3', status: 'done', name: 'Done' },
];

export function boardTab(id: string, name: string, setup: Record<string, unknown> = {}): Tab {
  return {
    id,
    name,
    kind: 'board',
    elements: [
      {
        id: `${id}-board`,
        type: 'shape',
        shape: 'plan-board',
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        planBoard: { title: name, columns: COLUMNS, swimlaneBy: 'none', cardFields: [], ...setup },
      },
    ],
  } as unknown as Tab;
}
