import { describe, expect, it } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import {
  archivePatches,
  assignPatches,
  fieldPatches,
  flagPatches,
  labelPatches,
  priorityPatches,
  selectionLabels,
  sharedFields,
  someOffer,
} from './board-selection-edits';

// docs/specs/026-plan/plan-board.md "Several cards at once": one write for the selected cards.
const type = (id: string, fields: string[], custom: ItemTypeDef['custom'] = []): ItemTypeDef => ({
  id,
  label: id,
  newTitle: id,
  glyph: 'item',
  color: '#000000',
  fields,
  custom,
});
const types: ItemTypeDef[] = [
  type(
    'task',
    ['assignee', 'priority', 'labels', 'f-size', 'f-many', 'f-ok'],
    [
      { id: 'f-size', label: 'Size', kind: 'choice', options: ['S', 'M'] },
      { id: 'f-many', label: 'Owners', kind: 'person', multiple: true },
      { id: 'f-ok', label: 'OK', kind: 'checkbox' },
    ],
  ),
  type(
    'bug',
    ['priority', 'f-size', 'f-ok'],
    [
      { id: 'f-size', label: 'Size', kind: 'choice', options: ['S', 'M'] },
      { id: 'f-ok', label: 'Okay', kind: 'number' },
    ],
  ),
  type('note', ['f-size'], [{ id: 'f-size', label: 'Size', kind: 'choice', options: ['S'] }]),
];
const by = { id: 'p', name: 'P', color: '#000000' };
const card = (id: string, t: string, fields: Item['fields'] = {}): Item => ({
  id,
  type: t,
  key: 1,
  rank: 'a',
  fields: { title: id, status: 'todo', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const ann = { id: 'ann', name: 'Ann', color: '#ff0000' };

describe('selection edits', () => {
  it('assigns the cards whose type has an assignee, and unassigns', () => {
    const a = card('a', 'task');
    const b = card('b', 'bug');
    const c = card('c', 'task', { assignee: { ...ann } });
    expect(assignPatches([a, b, c], types, ann)).toEqual([
      { id: 'a', patch: { set: { assignee: ann } } },
    ]);
    expect(assignPatches([a, c], types, null)).toEqual([
      { id: 'c', patch: { clear: ['assignee'] } },
    ]);
  });

  it('sets a priority, leaving cards that already have it', () => {
    const a = card('a', 'task', { priority: 'high' });
    const b = card('b', 'bug');
    expect(priorityPatches([a, b], types, 'high')).toEqual([
      { id: 'b', patch: { set: { priority: 'high' } } },
    ]);
  });

  it('adds a label to the cards lacking it and takes one off', () => {
    const a = card('a', 'task', { labels: ['ui'] });
    const b = card('b', 'task', { labels: ['ui', 'api'] });
    const c = card('c', 'task');
    const n = card('n', 'note');
    expect(labelPatches([a, b, c, n], types, 'api', 'add')).toEqual([
      { id: 'a', patch: { set: { labels: ['ui', 'api'] } } },
      { id: 'c', patch: { set: { labels: ['api'] } } },
    ]);
    expect(labelPatches([a, b, c], types, 'ui', 'remove')).toEqual([
      { id: 'a', patch: { clear: ['labels'] } },
      { id: 'b', patch: { set: { labels: ['api'] } } },
    ]);
    expect(selectionLabels([a, b, c])).toEqual(['ui', 'api']);
  });

  it('sets and clears a custom field', () => {
    const a = card('a', 'task', { 'f-size': 'S' });
    const b = card('b', 'bug');
    expect(fieldPatches([a, b], types, 'f-size', 'M')).toEqual([
      { id: 'a', patch: { set: { 'f-size': 'M' } } },
      { id: 'b', patch: { set: { 'f-size': 'M' } } },
    ]);
    expect(fieldPatches([a, b], types, 'f-size', null)).toEqual([
      { id: 'a', patch: { clear: ['f-size'] } },
    ]);
  });

  it('flags every card, or takes every flag off when all are flagged', () => {
    const a = card('a', 'task', { flagged: true });
    const b = card('b', 'task');
    expect(flagPatches([a, b])).toEqual([{ id: 'b', patch: { set: { flagged: true } } }]);
    expect(flagPatches([a])).toEqual([{ id: 'a', patch: { clear: ['flagged'] } }]);
    expect(flagPatches([])).toEqual([]);
  });

  it('archives every card, or restores them when all are archived', () => {
    const a = card('a', 'task', { archived: true });
    const b = card('b', 'task');
    expect(archivePatches([a, b])).toEqual([{ id: 'b', patch: { set: { archived: true } } }]);
    expect(archivePatches([a])).toEqual([{ id: 'a', patch: { clear: ['archived'] } }]);
  });

  it('offers the fields every type shares, of one kind, never a Person holding several', () => {
    const t = card('t', 'task');
    const b = card('b', 'bug');
    expect(sharedFields([t], types).map((f) => f.id)).toEqual(['f-size', 'f-ok']);
    expect(sharedFields([t, b], types).map((f) => f.id)).toEqual(['f-size']);
    expect(sharedFields([], types)).toEqual([]);
    expect(someOffer([b], types, 'assignee')).toBe(false);
    expect(someOffer([b, t], types, 'assignee')).toBe(true);
  });
});
