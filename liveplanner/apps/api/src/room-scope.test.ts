import { describe, expect, it } from 'vitest';
import { opForScope, scopedSenderMayRelay } from './room-scope';

// docs/specs/013-workspace/tab-scoped-share-links.md, Realtime. A session admitted on a link scoped to one
// tab must receive nothing about another tab and must not be able to change
// one. These are the pure rules the room applies to every frame; the tests
// fail closed on anything they don't name.

const SCOPE = 't2';

describe('opForScope (what a scoped session receives)', () => {
  it('passes everything through to an unscoped session', () => {
    const op = { kind: 'el', tabId: 't1', op: {} };
    expect(opForScope(op, null)).toBe(op);
  });

  it('delivers ops on its own tab', () => {
    for (const kind of ['el', 'tab', 'tab-meta', 'el-delta', 'vote', 'cursor']) {
      const op = { kind, tabId: SCOPE };
      expect(opForScope(op, SCOPE), kind).toBe(op);
    }
  });

  it('drops ops on any other tab', () => {
    for (const kind of ['el', 'tab', 'tab-meta', 'el-delta', 'vote', 'cursor']) {
      expect(opForScope({ kind, tabId: 't1' }, SCOPE), kind).toBeNull();
    }
  });

  it('drops a selection that does not say which tab it is on', () => {
    expect(opForScope({ kind: 'select', elementId: 'e1' }, SCOPE)).toBeNull();
    expect(opForScope({ kind: 'select', elementId: 'e1', tabId: SCOPE }, SCOPE)).not.toBeNull();
  });

  it('withholds the retired activity-log ops a stale client may still send', () => {
    expect(opForScope({ kind: 'log', entry: { tabId: SCOPE } }, SCOPE)).toBeNull();
    expect(opForScope({ kind: 'log-remove', entryId: 'e1' }, SCOPE)).toBeNull();
  });

  it('redacts project-meta the way the REST project is redacted', () => {
    const op = {
      kind: 'project-meta',
      name: 'Plan',
      tabs: [
        { id: 't1', name: 'Pricing', orderIndex: 0, folder: 'Money' },
        { id: 't2', name: 'Roadmap', orderIndex: 1 },
      ],
    };
    expect(opForScope(op, SCOPE)).toEqual({
      kind: 'project-meta',
      name: 'Plan',
      tabs: [
        { id: 't1', name: '', orderIndex: 0, outOfScope: true },
        { id: 't2', name: 'Roadmap', orderIndex: 1 },
      ],
    });
  });

  it('delivers a sheet write only to sessions on its tab', () => {
    const op = { kind: 'sheets', sheetId: 's1', tabId: SCOPE, rev: 3 };
    expect(opForScope(op, SCOPE)).toBe(op);
    expect(opForScope({ ...op, tabId: 'elsewhere' }, SCOPE)).toBeNull();
    const presence = {
      kind: 'sheet-presence',
      tabId: 'elsewhere',
      sheetId: 's1',
      ranges: null,
      editing: false,
    };
    expect(opForScope(presence, SCOPE)).toBeNull();
  });

  it('delivers item writes to a scoped session without their items', () => {
    const op = { kind: 'items', upserts: [{ id: 'i1' }], removed: ['i2'], rev: 7 };
    expect(opForScope(op, null)).toBe(op);
    expect(opForScope(op, SCOPE)).toEqual({ kind: 'items', upserts: [], removed: [], rev: 7 });
    const types = { kind: 'item-types', itemTypes: null };
    expect(opForScope(types, SCOPE)).toBe(types);
    expect(scopedSenderMayRelay(op, SCOPE)).toBe(false);
  });

  it('delivers card thread writes to a scoped session without their threads', () => {
    const op = { kind: 'threads', upserts: [{ id: 'th-1' }], removed: ['th-2'] };
    expect(opForScope(op, null)).toBe(op);
    expect(opForScope(op, SCOPE)).toEqual({ kind: 'threads', upserts: [], removed: [] });
    expect(scopedSenderMayRelay(op, SCOPE)).toBe(false);
  });

  it('delivers the tab-less worker notices', () => {
    for (const kind of ['share-revoked', 'share-rescoped', 'project-trashed']) {
      const op = { kind };
      expect(opForScope(op, SCOPE), kind).toBe(op);
    }
  });

  it('fails closed on anything it does not recognise', () => {
    expect(opForScope({ kind: 'something-new' }, SCOPE)).toBeNull();
    expect(opForScope(null, SCOPE)).toBeNull();
    expect(opForScope('el', SCOPE)).toBeNull();
    expect(opForScope({ kind: 'project-meta', tabs: 'nope' }, SCOPE)).toBeNull();
  });
});

describe('scopedSenderMayRelay (what a scoped session may send)', () => {
  it('never lets a scoped session add a board or plan view, unless its tab already showed every card', () => {
    const board = { id: 'b', type: 'shape', shape: 'plan-board', planBoard: {} };
    const view = { id: 'v', type: 'shape', shape: 'plan-view' };
    const ops = [
      { kind: 'el', tabId: SCOPE, op: { kind: 'add', element: board } },
      { kind: 'el', tabId: SCOPE, op: { kind: 'update', element: view } },
      { kind: 'tab', tabId: SCOPE, tab: { id: SCOPE, elements: [{ id: 'x' }, board] } },
    ];
    for (const op of ops) {
      expect(scopedSenderMayRelay(op, SCOPE)).toBe(false);
      expect(scopedSenderMayRelay(op, SCOPE, true)).toBe(true);
      expect(scopedSenderMayRelay(op, null)).toBe(true);
    }
    // Any other element still relays; a payload nested past any real op's depth fails closed.
    expect(
      scopedSenderMayRelay(
        { kind: 'el', tabId: SCOPE, op: { element: { shape: 'square' } } },
        SCOPE,
      ),
    ).toBe(true);
    let deep: unknown = { shape: 'square' };
    for (let i = 0; i < 12; i += 1) deep = { nested: deep };
    expect(scopedSenderMayRelay({ kind: 'el', tabId: SCOPE, op: deep }, SCOPE)).toBe(false);
  });

  it('lets an unscoped session send anything the role allows', () => {
    expect(scopedSenderMayRelay({ kind: 'project-meta' }, null)).toBe(true);
  });

  it('lets it act on its own tab', () => {
    expect(scopedSenderMayRelay({ kind: 'el', tabId: SCOPE }, SCOPE)).toBe(true);
  });

  it('refuses any other tab', () => {
    expect(scopedSenderMayRelay({ kind: 'el', tabId: 't1' }, SCOPE)).toBe(false);
    expect(scopedSenderMayRelay({ kind: 'tab-focus', tabId: 't1' }, SCOPE)).toBe(false);
    expect(scopedSenderMayRelay({ kind: 'select', elementId: 'e1' }, SCOPE)).toBe(false);
  });

  it('refuses project-meta outright: the structure is not theirs', () => {
    expect(scopedSenderMayRelay({ kind: 'project-meta', name: 'x', tabs: [] }, SCOPE)).toBe(false);
  });

  it('fails closed on anything else', () => {
    expect(scopedSenderMayRelay({ kind: 'something-new' }, SCOPE)).toBe(false);
    expect(scopedSenderMayRelay(undefined, SCOPE)).toBe(false);
  });
});
