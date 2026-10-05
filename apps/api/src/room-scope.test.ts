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
    for (const kind of ['el', 'tab', 'tab-meta', 'el-delta', 'vote', 'cursor', 'laser', 'qa']) {
      const op = { kind, tabId: SCOPE };
      expect(opForScope(op, SCOPE), kind).toBe(op);
    }
  });

  it('drops ops on any other tab', () => {
    for (const kind of ['el', 'tab', 'tab-meta', 'el-delta', 'vote', 'cursor', 'laser', 'qa']) {
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

  it('redacts document-meta the way the REST document is redacted', () => {
    const op = {
      kind: 'document-meta',
      name: 'Plan',
      tabs: [
        { id: 't1', name: 'Pricing', orderIndex: 0, folder: 'Money' },
        { id: 't2', name: 'Roadmap', orderIndex: 1 },
      ],
    };
    expect(opForScope(op, SCOPE)).toEqual({
      kind: 'document-meta',
      name: 'Plan',
      tabs: [
        { id: 't1', name: '', orderIndex: 0, outOfScope: true },
        { id: 't2', name: 'Roadmap', orderIndex: 1 },
      ],
    });
  });

  it('delivers item writes to a scoped session without their items', () => {
    const op = { kind: 'items', upserts: [{ id: 'i1' }], removed: ['i2'], rev: 7 };
    expect(opForScope(op, null)).toBe(op);
    expect(opForScope(op, SCOPE)).toEqual({ kind: 'items', upserts: [], removed: [], rev: 7 });
    const types = { kind: 'item-types', itemTypes: null };
    expect(opForScope(types, SCOPE)).toBe(types);
    expect(scopedSenderMayRelay(op, SCOPE)).toBe(false);
  });

  it('delivers the tab-less session ops', () => {
    for (const kind of [
      'poll-start',
      'poll-answer',
      'poll-end',
      'share-revoked',
      'share-rescoped',
      'document-trashed',
    ]) {
      const op = { kind };
      expect(opForScope(op, SCOPE), kind).toBe(op);
    }
  });

  it('fails closed on anything it does not recognise', () => {
    expect(opForScope({ kind: 'something-new' }, SCOPE)).toBeNull();
    expect(opForScope(null, SCOPE)).toBeNull();
    expect(opForScope('el', SCOPE)).toBeNull();
    expect(opForScope({ kind: 'document-meta', tabs: 'nope' }, SCOPE)).toBeNull();
  });
});

describe('scopedSenderMayRelay (what a scoped session may send)', () => {
  it('lets an unscoped session send anything the role allows', () => {
    expect(scopedSenderMayRelay({ kind: 'document-meta' }, null)).toBe(true);
  });

  it('lets it act on its own tab', () => {
    expect(scopedSenderMayRelay({ kind: 'el', tabId: SCOPE }, SCOPE)).toBe(true);
  });

  it('refuses any other tab', () => {
    expect(scopedSenderMayRelay({ kind: 'el', tabId: 't1' }, SCOPE)).toBe(false);
    expect(scopedSenderMayRelay({ kind: 'tab-focus', tabId: 't1' }, SCOPE)).toBe(false);
    expect(scopedSenderMayRelay({ kind: 'select', elementId: 'e1' }, SCOPE)).toBe(false);
  });

  it('refuses document-meta outright: the structure is not theirs', () => {
    expect(scopedSenderMayRelay({ kind: 'document-meta', name: 'x', tabs: [] }, SCOPE)).toBe(false);
  });

  it('lets it take part in the session', () => {
    for (const kind of ['poll-answer', 'poll-start', 'poll-end']) {
      expect(scopedSenderMayRelay({ kind }, SCOPE), kind).toBe(true);
    }
  });

  it('fails closed on anything else', () => {
    expect(scopedSenderMayRelay({ kind: 'something-new' }, SCOPE)).toBe(false);
    expect(scopedSenderMayRelay(undefined, SCOPE)).toBe(false);
  });
});
