import { describe, expect, it } from 'vitest';
import {
  ITEM_HISTORY_CHANGES_MAX,
  ITEM_HISTORY_GROUP_MS,
  ITEM_HISTORY_LIST_MAX,
  ITEM_HISTORY_VALUE_MAX,
  groupHistory,
  historyChangesOf,
  historyForReader,
  historyValueOf,
  readStoredHistory,
  type StoredHistoryEntry,
} from './item-history';
import { ALI, SAM, item } from './test-items';
import type { Item } from './item';

// docs/specs/026-plan/items.md "History": what a write kept, its values, grouping and the reader's shape.

const next = (before: Item, fields: Item['fields'], extra: Partial<Item> = {}): Item => ({
  ...before,
  fields,
  rev: before.rev + 1,
  ...extra,
});

describe('historyChangesOf', () => {
  const card = item({ title: 'Ship it', status: 'todo' });

  it('reads a create as created, in its status', () => {
    expect(historyChangesOf(null, card)).toEqual([{ kind: 'created', status: 'todo' }]);
    expect(historyChangesOf(null, item({ title: 'No status' }))).toEqual([{ kind: 'created' }]);
  });

  it('reads a status change as a move, from one to the other', () => {
    expect(historyChangesOf(card, next(card, { ...card.fields, status: 'doing' }))).toEqual([
      { kind: 'moved', from: 'todo', to: 'doing' },
    ]);
    const loose = item({ title: 'Loose' });
    expect(historyChangesOf(loose, next(loose, { ...loose.fields, status: 'todo' }))).toEqual([
      { kind: 'moved', from: null, to: 'todo' },
    ]);
  });

  it('reads the Trash in and out, never as a move or a trashedFrom change', () => {
    const trashed = next(card, { title: 'Ship it', status: 'trash', trashedFrom: 'todo' });
    expect(historyChangesOf(card, trashed)).toEqual([{ kind: 'trashed' }]);
    expect(historyChangesOf(trashed, next(trashed, { title: 'Ship it', status: 'todo' }))).toEqual([
      { kind: 'untrashed' },
    ]);
  });

  it('reads archive, flag and type changes', () => {
    const archived = next(card, { ...card.fields, archived: true, flagged: true });
    expect(historyChangesOf(card, archived)).toEqual([{ kind: 'archived' }, { kind: 'flagged' }]);
    expect(historyChangesOf(archived, next(archived, card.fields))).toEqual([
      { kind: 'unarchived' },
      { kind: 'unflagged' },
    ]);
    expect(historyChangesOf(card, next(card, card.fields, { type: 'bug' }))).toEqual([
      { kind: 'type', from: 'task', to: 'bug' },
    ]);
  });

  it('reads a field set with its value and a field gone as cleared', () => {
    const set = next(card, { ...card.fields, priority: 'high', due: '2026-11-03' });
    expect(historyChangesOf(card, set)).toEqual([
      { kind: 'set', field: 'priority', value: 'high' },
      { kind: 'set', field: 'due', value: '2026-11-03' },
    ]);
    expect(historyChangesOf(set, next(set, { ...card.fields, due: '' }))).toEqual([
      { kind: 'cleared', field: 'priority' },
      { kind: 'cleared', field: 'due' },
    ]);
  });

  it('names a long field without copying it, and reads its formatting alone as the description', () => {
    const described = next(card, { ...card.fields, description: 'A long story' });
    expect(historyChangesOf(card, described)).toEqual([{ kind: 'set', field: 'description' }]);
    const formatted = next(described, {
      ...described.fields,
      descriptionRich: [{ text: 'A long story', bold: true }],
    });
    expect(historyChangesOf(described, formatted)).toEqual([{ kind: 'set', field: 'description' }]);
    // The plain text gone but its formatting kept still reads as an edit, not a clear.
    const plainGone = next(formatted, { ...card.fields, descriptionRich: [{ text: 'x' }] });
    expect(historyChangesOf(formatted, plainGone)).toEqual([{ kind: 'set', field: 'description' }]);
    expect(
      historyChangesOf(
        card,
        next(card, { ...card.fields, checklist: [{ text: 'a', done: false }] }),
      ),
    ).toEqual([{ kind: 'set', field: 'checklist' }]);
  });

  it('names a Long Text field with formatting without copying it, and reads its formatting as the field', () => {
    const steps = next(card, {
      ...card.fields,
      'f-steps': 'Open the app',
      'f-stepsRich': [{ text: 'Open the app' }],
    });
    expect(historyChangesOf(card, steps)).toEqual([{ kind: 'set', field: 'f-steps' }]);
    const bold = next(steps, {
      ...steps.fields,
      'f-stepsRich': [{ text: 'Open the app', bold: true }],
    });
    expect(historyChangesOf(steps, bold)).toEqual([{ kind: 'set', field: 'f-steps' }]);
    // Plain Long Text (written by a form or a sheet) keeps its value as any text does.
    expect(historyChangesOf(card, next(card, { ...card.fields, 'f-steps': 'Plain' }))).toEqual([
      { kind: 'set', field: 'f-steps', value: 'Plain' },
    ]);
    const cleared = next(bold, { ...card.fields });
    expect(historyChangesOf(bold, cleared)).toEqual([{ kind: 'cleared', field: 'f-steps' }]);
  });

  it('keeps nothing for a rank, a tally, the example flag or comments', () => {
    expect(historyChangesOf(card, next(card, card.fields, { rank: 'j' }))).toEqual([]);
    expect(
      historyChangesOf(
        card,
        next(card, { ...card.fields, votes: { a: 2 }, example: true, comments: [] }),
      ),
    ).toEqual([]);
  });

  it('holds at most ITEM_HISTORY_CHANGES_MAX changes', () => {
    const many: Item['fields'] = { ...card.fields };
    for (let i = 0; i < 30; i += 1) many[`f-${i}`] = i;
    expect(historyChangesOf(card, next(card, many))).toHaveLength(ITEM_HISTORY_CHANGES_MAX);
  });
});

describe('historyValueOf', () => {
  it('cuts a long string and a long list', () => {
    const v = historyValueOf('title', 'x'.repeat(200)) as string;
    expect(v).toHaveLength(ITEM_HISTORY_VALUE_MAX);
    expect(v.endsWith('…')).toBe(true);
    const labels = Array.from({ length: 20 }, (_, i) => `label ${i} `.repeat(6));
    const kept = historyValueOf('labels', labels) as string[];
    expect(kept).toHaveLength(ITEM_HISTORY_LIST_MAX);
    expect(kept[0]!.length).toBeLessThanOrEqual(40);
    expect(historyValueOf('f-n', [1, true])).toEqual([1, true]);
  });

  it('keeps a person by name alone, never their id', () => {
    expect(historyValueOf('assignee', SAM)).toBe('Sam Lee');
    expect(historyValueOf('f-x', { other: 1 })).toBeUndefined();
    expect(historyValueOf('f-x', [{ text: 'row' }])).toBeUndefined();
  });

  it('keeps numbers and booleans, and nothing for no value', () => {
    expect(historyValueOf('estimate', 5)).toBe(5);
    expect(historyValueOf('f-check', false)).toBe(false);
    expect(historyValueOf('f-x', null)).toBeUndefined();
    expect(historyValueOf('f-x', undefined)).toBeUndefined();
  });
});

describe('groupHistory', () => {
  const at = (s: number) => 1_000_000 + s * 1000;
  const e = (
    s: number,
    changes: StoredHistoryEntry['changes'],
    by = SAM,
    tag?: StoredHistoryEntry['tag'],
  ): StoredHistoryEntry => ({ at: at(s), by, changes, ...(tag ? { tag } : {}) });

  it('groups one person’s quick changes, each field once at its newest', () => {
    const grouped = groupHistory([
      e(40, [{ kind: 'set', field: 'priority', value: 'urgent' }]),
      e(20, [{ kind: 'moved', from: 'doing', to: 'review' }]),
      e(10, [
        { kind: 'moved', from: 'todo', to: 'doing' },
        { kind: 'set', field: 'priority', value: 'high' },
      ]),
    ]);
    expect(grouped).toEqual([
      {
        at: at(40),
        by: SAM,
        changes: [
          { kind: 'moved', from: 'todo', to: 'review' },
          { kind: 'set', field: 'priority', value: 'urgent' },
        ],
      },
    ]);
  });

  it('measures the window from the group’s first entry', () => {
    const step = ITEM_HISTORY_GROUP_MS / 1000 / 2 + 1;
    const grouped = groupHistory([
      e(step * 2, [{ kind: 'flagged' }]),
      e(step, [{ kind: 'set', field: 'due', value: '2026-11-01' }]),
      e(0, [{ kind: 'set', field: 'priority', value: 'low' }]),
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]!.changes).toEqual([{ kind: 'flagged' }]);
  });

  it('keeps people, and tags, apart', () => {
    expect(
      groupHistory([
        e(3, [{ kind: 'flagged' }], ALI),
        e(2, [{ kind: 'archived' }], SAM, 'undo'),
        e(1, [{ kind: 'unarchived' }]),
      ]),
    ).toHaveLength(3);
  });

  it('drops a there-and-back, an on-and-off and a group with nothing left', () => {
    expect(
      groupHistory([
        e(6, [{ kind: 'untrashed' }]),
        e(5, [{ kind: 'unflagged' }, { kind: 'trashed' }]),
        e(4, [{ kind: 'type', from: 'bug', to: 'task' }]),
        e(3, [{ kind: 'type', from: 'task', to: 'bug' }]),
        e(2, [{ kind: 'moved', from: 'doing', to: 'todo' }]),
        e(1, [{ kind: 'moved', from: 'todo', to: 'doing' }, { kind: 'flagged' }]),
      ]),
    ).toEqual([]);
    // A change after a cancelled pair stands on its own.
    expect(
      groupHistory([
        e(3, [{ kind: 'flagged' }]),
        e(2, [{ kind: 'unflagged' }]),
        e(1, [{ kind: 'flagged' }]),
      ])[0]!.changes,
    ).toEqual([{ kind: 'flagged' }]);
  });

  it('keeps created first, and a type change that stands', () => {
    const [g] = groupHistory([
      e(3, [{ kind: 'type', from: 'task', to: 'bug' }]),
      e(2, [{ kind: 'set', field: 'priority', value: 'high' }]),
      e(1, [{ kind: 'created', status: 'todo' }]),
    ]);
    expect(g!.changes.map((c) => c.kind)).toEqual(['created', 'set', 'type']);
    const [later] = groupHistory([
      e(2, [{ kind: 'created' }]),
      e(1, [{ kind: 'set', field: 'f-a', value: 1 }]),
    ]);
    expect(later!.changes[0]!.kind).toBe('created');
  });

  it('carries the newest entry’s tag', () => {
    expect(groupHistory([e(1, [{ kind: 'flagged' }], SAM, 'ai')])[0]!.tag).toBe('ai');
  });
});

describe('historyForReader', () => {
  it('answers names and colours, and mine only to the author', () => {
    const entries: StoredHistoryEntry[] = [
      { at: 2, by: SAM, tag: 'ai', changes: [{ kind: 'flagged' }] },
      { at: 1, by: ALI, changes: [{ kind: 'archived' }] },
    ];
    const read = historyForReader(entries, SAM.id);
    expect(read).toEqual([
      {
        at: 2,
        by: { name: SAM.name, color: SAM.color },
        mine: true,
        tag: 'ai',
        changes: [{ kind: 'flagged' }],
      },
      { at: 1, by: { name: ALI.name, color: ALI.color }, changes: [{ kind: 'archived' }] },
    ]);
    expect(JSON.stringify(read)).not.toContain(ALI.id);
    // An author with no id (a form's, a deleted account's) is nobody's own.
    expect(
      historyForReader([{ ...entries[1]!, by: { ...ALI, id: '' } }], '')[0]!.mine,
    ).toBeUndefined();
  });
});

describe('readStoredHistory', () => {
  const row = {
    at: 5,
    by: JSON.stringify(SAM),
    tag: 'undo',
    changes: JSON.stringify([{ kind: 'flagged' }, { kind: 'nonsense' }, null]),
  };

  it('reads a row back, keeping only the changes it knows', () => {
    expect(readStoredHistory(row)).toEqual({
      at: 5,
      by: SAM,
      tag: 'undo',
      changes: [{ kind: 'flagged' }],
    });
    expect(readStoredHistory({ ...row, tag: 'weird', by: '{"name":"A","color":"#000"}' })).toEqual({
      at: 5,
      by: { id: '', name: 'A', color: '#000' },
      changes: [{ kind: 'flagged' }],
    });
  });

  it('skips a row that does not parse', () => {
    expect(readStoredHistory({ ...row, at: '5' })).toBeNull();
    expect(readStoredHistory({ ...row, by: '{' })).toBeNull();
    expect(readStoredHistory({ ...row, by: '{"name":1}' })).toBeNull();
    expect(readStoredHistory({ ...row, changes: '{}' })).toBeNull();
  });
});
