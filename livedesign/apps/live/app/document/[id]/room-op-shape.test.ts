import { describe, expect, it } from 'vitest';
import { createShape, type Tab } from '@livedesign/document';
import { applyRoomOpToTabs } from './room-op-apply';
import { migrateRoomOp } from './room-op-migrate';
import { roomOpIsWellFormed } from './room-op-shape';

// A peer's op is applied only when it has its kind's shape
// (docs/specs/012-collaboration/realtime-conflict-resolution.md "A malformed op").

const el = createShape('square', 0, 0);
const tabs: Tab[] = [{ id: 't1', name: 'T', elements: [el] }];
const WELL_FORMED: Record<string, unknown>[] = [
  { kind: 'tab', tabId: 't1', tab: tabs[0] },
  { kind: 'el', tabId: 't1', op: { kind: 'add', element: { ...el, id: 'n' }, at: 0 } },
  { kind: 'el', tabId: 't1', op: { kind: 'update', element: el } },
  { kind: 'el', tabId: 't1', op: { kind: 'remove', id: el.id } },
  { kind: 'el', tabId: 't1', op: { kind: 'reorder', ids: [el.id] } },
  { kind: 'el', tabId: 't1', op: { kind: 'patch', id: el.id, set: { label: 'x' } } },
  {
    kind: 'el-delta',
    tabId: 't1',
    elementId: el.id,
    delta: { kind: 'check', index: 0, text: 'x', done: true },
  },
  {
    kind: 'changeset',
    tabId: 't1',
    id: 'c',
    rev: 2,
    elementOps: [{ kind: 'update', element: el }],
  },
  { kind: 'changeset', tabId: 't1', id: 'c', rev: 2, refetch: true, touched: [el.id] },
  { kind: 'tab-meta', tabId: 't1', patch: { name: 'x' }, clear: ['background'] },
  { kind: 'article', tabId: 't1', flow: 'f', removed: true },
  { kind: 'document-meta', name: 'Doc', tabs: [{ id: 't1', name: 'T', orderIndex: 0 }] },
  // Presence, and a kind this build does not know, pass as they always have.
  { kind: 'cursor', x: 1, y: 2 },
  { kind: 'from-a-newer-build', anything: true },
];

describe('roomOpIsWellFormed', () => {
  it.each(WELL_FORMED.map((op) => [op.kind, op] as const))(
    'takes a well-formed %s op',
    (_k, op) => {
      expect(roomOpIsWellFormed(op)).toBe(true);
    },
  );

  it.each([
    ['a tab op without its tab', { kind: 'tab', tabId: 't1' }],
    ['an el op without its op', { kind: 'el', tabId: 't1' }],
    ['an add without its element', { kind: 'el', tabId: 't1', op: { kind: 'add', at: 0 } }],
    [
      'a reorder whose ids are not a list',
      { kind: 'el', tabId: 't1', op: { kind: 'reorder', ids: 0 } },
    ],
    [
      'a patch whose clear is not a list',
      { kind: 'el', tabId: 't1', op: { kind: 'patch', id: 'a', set: {}, clear: 1 } },
    ],
    ['a delta that is not one', { kind: 'el-delta', tabId: 't1', elementId: 'a', delta: null }],
    ['a changeset whose ops are not a list', { kind: 'changeset', tabId: 't1', elementOps: true }],
    [
      'a changeset holding a patch',
      { kind: 'changeset', tabId: 't1', elementOps: [{ kind: 'patch', id: 'a', set: {} }] },
    ],
    ['a tab-meta without its patch', { kind: 'tab-meta', tabId: 't1' }],
    ['a document-meta without its tab list', { kind: 'document-meta', name: 'n' }],
    ['a document-meta tab without an id', { kind: 'document-meta', name: 'n', tabs: [null] }],
    ['no kind at all', { tabId: 't1' }],
    ['not an object', 'el'],
  ])('refuses %s', (_why, op) => {
    expect(roomOpIsWellFormed(op)).toBe(false);
  });

  it('applies every op it takes without throwing, over seeded junk', () => {
    const JUNK: unknown[] = [undefined, null, 0, 'x', [], [null], {}, true];
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed / 0x7fffffff);
    const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
    for (let i = 0; i < 4000; i++) {
      const op = structuredClone(pick(WELL_FORMED.slice(0, 13)));
      const target = rnd() < 0.5 && op.op ? (op.op as Record<string, unknown>) : op;
      target[pick(Object.keys(target))] = pick(JUNK);
      if (roomOpIsWellFormed(op))
        expect(() => applyRoomOpToTabs(tabs, migrateRoomOp(op))).not.toThrow();
    }
  });
});
