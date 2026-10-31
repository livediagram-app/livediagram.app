import { describe, expect, it } from 'vitest';
import {
  ITEM_TYPES,
  type Item,
  type ItemHistoryChange,
  type ItemHistoryEntry,
} from '@liveplanner/items';
import {
  activityParts,
  changePhrase,
  fieldName,
  valueText,
  type ActivityContext,
} from './activity-words';

// A card's history entry in words (docs/specs/026-plan/items.md "History" "Where it shows").

const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const linked: Item = {
  id: 'card-parent',
  type: 'project',
  key: 7,
  rank: 'i',
  fields: { title: 'Launch' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'Sam', color: '#2563eb' },
  updatedBy: { id: 'p', name: 'Sam', color: '#2563eb' },
};
const ctx: ActivityContext = {
  statusNames: new Map([
    ['doing', 'In Progress'],
    ['review', 'Review'],
  ]),
  types: ITEM_TYPES,
  type: {
    ...task,
    custom: [
      ...(task.custom ?? []),
      { id: 'f-size', label: 'T-Shirt Size', kind: 'choice', options: ['S', 'M'] },
      { id: 'f-done', label: 'Signed Off', kind: 'checkbox' },
    ],
  },
  items: new Map([[linked.id, linked]]),
};

const words = (change: ItemHistoryChange, tag?: ItemHistoryEntry['tag']) =>
  changePhrase(ctx, change, tag ? { tag } : {})
    .map((p) => p.text)
    .join('');

describe('changePhrase', () => {
  it('words every kind of change', () => {
    expect(words({ kind: 'created' })).toBe('created this card');
    expect(words({ kind: 'created', status: 'doing' })).toBe('created this card in In Progress');
    expect(words({ kind: 'created' }, 'form')).toBe('created this card from a form response');
    expect(words({ kind: 'moved', from: 'doing', to: 'review' })).toBe(
      'moved this from In Progress to Review',
    );
    expect(words({ kind: 'moved', from: null, to: 'review' })).toBe('moved this to Review');
    expect(words({ kind: 'moved', from: 'gone-status', to: null })).toBe(
      'moved this out of gone-status',
    );
    expect(words({ kind: 'trashed' })).toBe('moved this to the Trash');
    expect(words({ kind: 'untrashed' })).toBe('restored this from the Trash');
    expect(words({ kind: 'archived' })).toBe('archived this');
    expect(words({ kind: 'unarchived' })).toBe('restored this from the Archive');
    expect(words({ kind: 'flagged' })).toBe('flagged this');
    expect(words({ kind: 'unflagged' })).toBe('removed the flag');
    expect(words({ kind: 'type', from: 'task', to: 'unknown-type' })).toBe(
      'changed the type from Task to unknown-type',
    );
    expect(words({ kind: 'set', field: 'description' })).toBe('edited the Description');
    expect(words({ kind: 'set', field: 'title', value: 'New name' })).toBe(
      'renamed this to New name',
    );
    expect(words({ kind: 'set', field: 'priority', value: 'high' })).toBe('set Priority to High');
    expect(words({ kind: 'cleared', field: 'due' })).toBe('cleared Due Date');
  });

  it('marks names and values strong', () => {
    expect(changePhrase(ctx, { kind: 'set', field: 'priority', value: 'high' }, {})).toEqual([
      { text: 'set ' },
      { text: 'Priority', strong: true },
      { text: ' to ' },
      { text: 'High', strong: true },
    ]);
  });
});

describe('valueText and fieldName', () => {
  it('reads values as the panel shows them', () => {
    expect(valueText(ctx, 'due', '2026-11-03')).toMatch(/2026/);
    expect(valueText(ctx, 'start', 'not a day')).toBe('not a day');
    expect(valueText(ctx, 'color', '#2563eb')).not.toBe('');
    expect(valueText(ctx, 'estimate', 1)).toBe('1 point');
    expect(valueText(ctx, 'estimate', 5)).toBe('5 points');
    expect(valueText(ctx, 'labels', ['bug', 'ui'])).toBe('bug, ui');
    expect(valueText(ctx, 'f-other', true)).toBe('Yes');
    expect(valueText(ctx, 'f-other', false)).toBe('No');
    expect(valueText(ctx, 'assignee', 'Sam Lee')).toBe('Sam Lee');
    expect(valueText(ctx, 'priority', 'not-a-priority')).toBe('not-a-priority');
    // A custom field reads as its kind does; a Card field by the card's title.
    expect(valueText(ctx, 'f-size', 'M')).toBe('M');
    expect(valueText(ctx, 'f-done', true)).toBe('Yes');
    expect(valueText(ctx, 'parent', 'card-parent')).toMatch(/Launch/);
    // A value its field no longer takes reads as it was kept.
    expect(valueText(ctx, 'f-done', 'odd')).toBe('odd');
  });

  it('names fields by the card’s type, then the built-in names, then as they are', () => {
    expect(fieldName(ctx, 'f-size')).toBe('T-Shirt Size');
    expect(fieldName(ctx, 'start')).toBe('Start Date');
    expect(fieldName(ctx, 'color')).toBe('Colour');
    expect(fieldName(ctx, 'f-gone')).toBe('f-gone');
    expect(fieldName({ ...ctx, type: undefined }, 'title')).toBe('Title');
  });
});

describe('activityParts', () => {
  const entry = (changes: ItemHistoryChange[]): ItemHistoryEntry => ({
    at: 0,
    by: { name: 'Sam', color: '#2563eb' },
    changes,
  });
  const text = (changes: ItemHistoryChange[]) =>
    activityParts(ctx, entry(changes))
      .map((p) => p.text)
      .join('');

  it('joins phrases as a sentence', () => {
    expect(text([{ kind: 'flagged' }])).toBe('flagged this');
    expect(text([{ kind: 'flagged' }, { kind: 'archived' }])).toBe(
      'flagged this and archived this',
    );
    expect(
      text([{ kind: 'flagged' }, { kind: 'archived' }, { kind: 'cleared', field: 'due' }]),
    ).toBe('flagged this, archived this and cleared Due Date');
  });

  it('reads past three phrases as the first two and how many more', () => {
    expect(
      text([
        { kind: 'flagged' },
        { kind: 'archived' },
        { kind: 'cleared', field: 'due' },
        { kind: 'cleared', field: 'start' },
      ]),
    ).toBe('flagged this, archived this and made 2 more changes');
  });
});
