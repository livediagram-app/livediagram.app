import { describe, expect, it } from 'vitest';
import {
  ITEM_TYPES,
  type Item,
  type ItemHistoryChange,
  type ItemHistoryEntry,
} from '@liveplanner/items';
import { PRIORITY_COLOURS } from '@liveplanner/project';
import {
  changeLine,
  fieldName,
  lineText,
  valueText,
  type ActivityContext,
  type PreviousValue,
} from './activity-words';

// A card's history change as a timeline line (docs/specs/026-plan/items.md "History" "Where it shows").

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
  statusPhases: new Map([
    ['doing', 'doing'],
    ['review', 'doing'],
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

const words = (
  change: ItemHistoryChange,
  tag?: ItemHistoryEntry['tag'],
  previous?: PreviousValue,
) => lineText(changeLine(ctx, change, tag ? { tag } : {}, previous));

describe('changeLine', () => {
  it('words every kind of change', () => {
    expect(words({ kind: 'created' })).toBe('Created this card');
    expect(words({ kind: 'created', status: 'doing' })).toBe('Created this card in In Progress');
    expect(words({ kind: 'created' }, 'form')).toBe('Created this card from a form response');
    expect(words({ kind: 'created' }, 'repeat')).toBe('Created this card from a repeating card');
    expect(words({ kind: 'moved', from: 'doing', to: 'review' })).toBe(
      'Moved In Progress → Review',
    );
    expect(words({ kind: 'moved', from: null, to: 'review' })).toBe('Moved to Review');
    expect(words({ kind: 'moved', from: 'gone-status', to: null })).toBe(
      'Moved out of gone-status',
    );
    expect(words({ kind: 'moved', from: null, to: null })).toBe('Moved');
    expect(words({ kind: 'trashed' })).toBe('Moved this card to the Trash');
    expect(words({ kind: 'untrashed' })).toBe('Restored this card from the Trash');
    expect(words({ kind: 'archived' })).toBe('Archived this card');
    expect(words({ kind: 'unarchived' })).toBe('Restored this card from the Archive');
    expect(words({ kind: 'flagged' })).toBe('Flagged this card');
    expect(words({ kind: 'unflagged' })).toBe('Removed the flag');
    expect(words({ kind: 'type', from: 'task', to: 'unknown-type' })).toBe(
      'Changed the type Task → unknown-type',
    );
    expect(words({ kind: 'set', field: 'description' })).toBe('Edited the Description');
    expect(words({ kind: 'set', field: 'title', value: 'New name' })).toBe(
      'Renamed this card to “New name”',
    );
    expect(words({ kind: 'set', field: 'priority', value: 'high' })).toBe('Set Priority to High');
    expect(words({ kind: 'cleared', field: 'due' })).toBe('Cleared Due Date');
  });

  it('shows the earlier value before the arrow when the history holds it', () => {
    expect(words({ kind: 'set', field: 'priority', value: 'high' }, undefined, 'low')).toBe(
      'Changed Priority Low → High',
    );
    expect(words({ kind: 'set', field: 'title', value: 'B' }, undefined, 'A')).toBe(
      'Renamed “A” → “B”',
    );
    expect(words({ kind: 'cleared', field: 'estimate' }, undefined, 3)).toBe(
      'Cleared Estimate (was 3 points)',
    );
    // Empty before, or the same value: only the new one.
    expect(words({ kind: 'set', field: 'priority', value: 'high' }, undefined, null)).toBe(
      'Set Priority to High',
    );
    expect(words({ kind: 'set', field: 'priority', value: 'high' }, undefined, 'high')).toBe(
      'Set Priority to High',
    );
    expect(words({ kind: 'cleared', field: 'due' }, undefined, null)).toBe('Cleared Due Date');
  });

  it('draws values as chips: a status with its stage, a priority with its colour, the old one muted', () => {
    expect(changeLine(ctx, { kind: 'moved', from: 'doing', to: 'other' }, {}).parts).toEqual([
      { text: 'Moved ' },
      { chip: 'In Progress', tone: { phase: 'doing' }, old: true },
      { arrow: true },
      { chip: 'other', tone: { phase: 'todo' } },
    ]);
    expect(changeLine(ctx, { kind: 'set', field: 'priority', value: 'high' }, {}, 'low')).toEqual({
      glyph: 'edited',
      parts: [
        { text: 'Changed ' },
        { text: 'Priority', strong: true },
        { text: ' ' },
        { chip: 'Low', tone: { colour: PRIORITY_COLOURS.low }, old: true },
        { arrow: true },
        { chip: 'High', tone: { colour: PRIORITY_COLOURS.high } },
      ],
    });
    // Any other value is a plain chip.
    expect(changeLine(ctx, { kind: 'set', field: 'f-size', value: 'M' }, {}).parts.at(-1)).toEqual({
      chip: 'M',
    });
  });

  it('gives each kind its glyph', () => {
    const glyph = (c: ItemHistoryChange) => changeLine(ctx, c, {}).glyph;
    expect(glyph({ kind: 'created' })).toBe('created');
    expect(glyph({ kind: 'moved', from: 'a', to: 'b' })).toBe('moved');
    expect(glyph({ kind: 'trashed' })).toBe('trash');
    expect(glyph({ kind: 'untrashed' })).toBe('restore');
    expect(glyph({ kind: 'archived' })).toBe('archive');
    expect(glyph({ kind: 'flagged' })).toBe('flag');
    expect(glyph({ kind: 'type', from: 'a', to: 'b' })).toBe('type');
    expect(glyph({ kind: 'set', field: 'title', value: 'x' })).toBe('renamed');
    expect(glyph({ kind: 'set', field: 'due', value: '2026-01-01' })).toBe('edited');
    expect(glyph({ kind: 'cleared', field: 'due' })).toBe('cleared');
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
