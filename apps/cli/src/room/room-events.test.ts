import { describe, expect, it } from 'vitest';
import { classifyRoomOp, onTab, watchLines, type Names, type RoomEvent } from './room-events';

// docs/specs/015-api/blueprints/cli.md "The room stream", CLI33.

const comment = {
  id: 'c1',
  text: 'Idempotent?',
  createdAt: 1,
  authorName: 'Sam',
  authorColor: '#000',
};

describe('classifyRoomOp', () => {
  it('reads a changeset, with its author, summary and counts', () => {
    expect(
      classifyRoomOp({
        kind: 'changeset',
        tabId: 't1',
        id: 'cs_1',
        author: { name: 'Webber' },
        summary: 'add payments',
        counts: { added: 2, changed: 1, removed: 0 },
      }),
    ).toEqual([
      {
        kind: 'changeset',
        tabId: 't1',
        id: 'cs_1',
        author: 'Webber',
        summary: 'add payments',
        counts: { added: 2, changed: 1, removed: 0 },
      },
    ]);
    expect(classifyRoomOp({ kind: 'changeset', tabId: 't1', id: 'cs_2' })).toEqual([
      {
        kind: 'changeset',
        tabId: 't1',
        id: 'cs_2',
        author: 'someone',
        summary: null,
        counts: { added: 0, changed: 0, removed: 0 },
      },
    ]);
    expect(classifyRoomOp({ kind: 'changeset', tabId: 't1' })).toEqual([]);
  });

  it('reads element ops as added, changed or removed, and a reorder as the tab changing', () => {
    const el = (op: unknown) => classifyRoomOp({ kind: 'el', tabId: 't1', op });
    expect(el({ kind: 'add', element: { id: 'a' }, at: 0 })).toEqual([
      { kind: 'element', tabId: 't1', elementId: 'a', change: 'added' },
    ]);
    expect(el({ kind: 'update', element: { id: 'a' } })[0]).toMatchObject({ change: 'changed' });
    expect(el({ kind: 'remove', id: 'a' })[0]).toMatchObject({ change: 'removed' });
    expect(el({ kind: 'reorder', ids: [] })).toEqual([{ kind: 'tab', tabId: 't1' }]);
    expect(el({ kind: 'update' })).toEqual([]);
    expect(el({ kind: 'mystery' })).toEqual([]);
    expect(el('nope')).toEqual([]);
  });

  it('reads a new comment as a comment, other comment deltas as nothing, and any other delta as a change', () => {
    const delta = (d: unknown, elementId: unknown = 'a') =>
      classifyRoomOp({ kind: 'el-delta', tabId: 't1', elementId, delta: d });
    expect(delta({ kind: 'comment-add', comment })).toEqual([
      { kind: 'comment', tabId: 't1', elementId: 'a', authorName: 'Sam', text: 'Idempotent?' },
    ]);
    expect(delta({ kind: 'comment-add' })).toEqual([
      { kind: 'comment', tabId: 't1', elementId: 'a', authorName: 'someone', text: '' },
    ]);
    expect(delta({ kind: 'comment-resolve', resolved: true })).toEqual([]);
    expect(delta({ kind: 'response', value: 'done' })).toEqual([
      { kind: 'element', tabId: 't1', elementId: 'a', change: 'changed' },
    ]);
    expect(delta({ kind: 'response' }, 7)).toEqual([]);
    expect(delta('x')).toEqual([]);
    expect(delta({})).toEqual([]);
  });

  it('reads a vote as its element changing, and whole-tab ops as the tab changing', () => {
    expect(classifyRoomOp({ kind: 'vote', tabId: 't1', elementId: 'a', delta: 1 })).toEqual([
      { kind: 'element', tabId: 't1', elementId: 'a', change: 'changed' },
    ]);
    expect(classifyRoomOp({ kind: 'vote', tabId: 't1' })).toEqual([]);
    for (const kind of ['tab', 'tab-meta', 'article'])
      expect(classifyRoomOp({ kind, tabId: 't1' })).toEqual([{ kind: 'tab', tabId: 't1' }]);
  });

  it('reads document metadata as the document, and leaves everything else alone', () => {
    expect(
      classifyRoomOp({
        kind: 'document-meta',
        name: 'Shop',
        tabs: [{ id: 't1', name: 'Main' }, 'x', { id: 't2' }],
      }),
    ).toEqual([{ kind: 'document', name: 'Shop', tabs: [{ id: 't1', name: 'Main' }] }]);
    expect(classifyRoomOp({ kind: 'document-meta', name: 'Shop' })).toEqual([]);
    expect(classifyRoomOp({ kind: 'cursor', tabId: 't1' })).toEqual([]);
    expect(classifyRoomOp({ kind: 'select' })).toEqual([]);
    expect(classifyRoomOp(null)).toEqual([]);
  });
});

describe('onTab', () => {
  it('keeps every event without a tab narrowing, a document event always, and only the tab’s otherwise', () => {
    const tab: RoomEvent = { kind: 'tab', tabId: 't1' };
    const document: RoomEvent = { kind: 'document', name: 'Shop', tabs: [] };
    expect([onTab(tab, null), onTab(tab, 't1'), onTab(tab, 't2'), onTab(document, 't2')]).toEqual([
      true,
      true,
      false,
      true,
    ]);
  });
});

describe('watchLines', () => {
  const names: Names = {
    tabName: (id) => (id === 't1' ? 'Main' : id),
    refOf: (_t, id) => id.slice(0, 4),
    tabs: [
      { id: 't1', name: 'Main' },
      { id: 't2', name: 'Old' },
      { id: 't3', name: 'Gone' },
    ],
    documentName: 'Shop',
  };

  it('prints each event as one line', () => {
    expect(
      [
        {
          kind: 'changeset',
          tabId: 't1',
          id: 'cs_1',
          author: 'Webber',
          summary: 'add',
          counts: { added: 1, changed: 2, removed: 3 },
        },
        {
          kind: 'changeset',
          tabId: 't1',
          id: 'cs_2',
          author: 'Webber',
          summary: null,
          counts: { added: 0, changed: 1, removed: 0 },
        },
        { kind: 'comment', tabId: 't1', elementId: 'payments', authorName: 'Sam', text: 'Why?' },
        { kind: 'element', tabId: 't1', elementId: 'payments', change: 'removed' },
        { kind: 'tab', tabId: 't1' },
      ].flatMap((e) => watchLines(e as RoomEvent, names)),
    ).toEqual([
      'changeset cs_1 by Webber: "add" (+1 ~2 -3)',
      'changeset cs_2 by Webber: (+0 ~1 -0)',
      'comment on paym by Sam: "Why?"',
      'element paym removed',
      'tab "Main" changed',
    ]);
  });

  it('tells a document renamed, and tabs added, renamed and removed', () => {
    const event: RoomEvent = {
      kind: 'document',
      name: 'Shop v2',
      tabs: [
        { id: 't1', name: 'Main' },
        { id: 't2', name: 'New name' },
        { id: 't4', name: 'Fresh' },
      ],
    };
    expect(watchLines(event, names)).toEqual([
      'document renamed "Shop v2"',
      'tab "New name" renamed',
      'tab "Fresh" added',
      'tab "Gone" removed',
    ]);
    expect(watchLines({ ...event, name: 'Shop', tabs: [...names.tabs] }, names)).toEqual([]);
  });
});
