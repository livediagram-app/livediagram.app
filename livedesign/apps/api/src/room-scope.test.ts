import { describe, expect, it } from 'vitest';
import { opForScope, opFromScopedSender, scopedSenderMayRelay } from './room-scope';

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
    for (const kind of ['el', 'tab', 'tab-meta', 'el-delta', 'vote', 'cursor', 'laser']) {
      const op = { kind, tabId: SCOPE };
      expect(opForScope(op, SCOPE), kind).toBe(op);
    }
  });

  it('drops ops on any other tab', () => {
    for (const kind of ['el', 'tab', 'tab-meta', 'el-delta', 'vote', 'cursor', 'laser']) {
      expect(opForScope({ kind, tabId: 't1' }, SCOPE), kind).toBeNull();
    }
  });

  // docs/specs/009-elements/components.md: a scoped session never receives a main its tab does not use.
  it('delivers a component op only when its tab uses the main, failing closed', () => {
    const op = { kind: 'component', component: { id: 'c1' }, tabIds: ['t1', SCOPE] };
    expect(opForScope(op, SCOPE)).toBe(op);
    expect(opForScope({ ...op, tabIds: ['t1'] }, SCOPE)).toBeNull();
    expect(opForScope({ ...op, tabIds: [] }, SCOPE)).toBeNull();
    expect(opForScope({ kind: 'component', component: { id: 'c1' } }, SCOPE)).toBeNull();
    expect(opForScope({ ...op, tabIds: SCOPE }, SCOPE)).toBeNull();
    // A component op naming a tabId of its own is still judged by tabIds.
    expect(opForScope({ ...op, tabId: SCOPE, tabIds: ['t1'] }, SCOPE)).toBeNull();
    expect(opForScope({ ...op, tabIds: ['t1'] }, null)).toEqual({ ...op, tabIds: ['t1'] });
  });

  it('drops a selection that does not say which tab it is on', () => {
    expect(opForScope({ kind: 'select', elementId: 'e1' }, SCOPE)).toBeNull();
    expect(opForScope({ kind: 'select', elementId: 'e1', tabId: SCOPE }, SCOPE)).not.toBeNull();
  });

  it('withholds the retired activity-log ops a stale client may still send', () => {
    expect(opForScope({ kind: 'log', entry: { tabId: SCOPE } }, SCOPE)).toBeNull();
    expect(opForScope({ kind: 'log-remove', entryId: 'e1' }, SCOPE)).toBeNull();
  });

  it('redacts design-meta the way the REST design is redacted', () => {
    const op = {
      kind: 'design-meta',
      name: 'Plan',
      tabs: [
        { id: 't1', name: 'Pricing', orderIndex: 0, folder: 'Money' },
        { id: 't2', name: 'Roadmap', orderIndex: 1 },
      ],
    };
    expect(opForScope(op, SCOPE)).toEqual({
      kind: 'design-meta',
      name: 'Plan',
      tabs: [
        { id: 't1', name: '', orderIndex: 0, outOfScope: true },
        { id: 't2', name: 'Roadmap', orderIndex: 1 },
      ],
    });
  });

  it('delivers the tab-less notices', () => {
    for (const kind of ['share-revoked', 'share-rescoped', 'design-trashed']) {
      const op = { kind };
      expect(opForScope(op, SCOPE), kind).toBe(op);
    }
  });

  it('fails closed on anything it does not recognise', () => {
    expect(opForScope({ kind: 'something-new' }, SCOPE)).toBeNull();
    expect(opForScope(null, SCOPE)).toBeNull();
    expect(opForScope('el', SCOPE)).toBeNull();
    expect(opForScope({ kind: 'design-meta', tabs: 'nope' }, SCOPE)).toBeNull();
  });
});

describe('scopedSenderMayRelay (what a scoped session may send)', () => {
  it('lets an unscoped session send anything the role allows', () => {
    expect(scopedSenderMayRelay({ kind: 'design-meta' }, null)).toBe(true);
  });

  it('lets it act on its own tab', () => {
    expect(scopedSenderMayRelay({ kind: 'el', tabId: SCOPE }, SCOPE)).toBe(true);
  });

  // docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom": a follow names a person, not a tab.
  it('lets a scoped visitor follow someone', () => {
    expect(scopedSenderMayRelay({ kind: 'follow', target: 'p-a' }, SCOPE)).toBe(true);
  });

  it('refuses any other tab', () => {
    expect(scopedSenderMayRelay({ kind: 'el', tabId: 't1' }, SCOPE)).toBe(false);
    expect(scopedSenderMayRelay({ kind: 'tab-focus', tabId: 't1' }, SCOPE)).toBe(false);
    expect(scopedSenderMayRelay({ kind: 'select', elementId: 'e1' }, SCOPE)).toBe(false);
  });

  it('refuses design-meta outright: the structure is not theirs', () => {
    expect(scopedSenderMayRelay({ kind: 'design-meta', name: 'x', tabs: [] }, SCOPE)).toBe(false);
  });

  // A tab's name is structure (docs/specs/013-workspace/tab-scoped-share-links.md).
  it('refuses a rename of its own tab, set or cleared', () => {
    const rename = { kind: 'tab-meta', tabId: SCOPE, patch: { name: 'Mine now' } };
    expect(scopedSenderMayRelay(rename, SCOPE)).toBe(false);
    expect(scopedSenderMayRelay({ ...rename, patch: {}, clear: ['name'] }, SCOPE)).toBe(false);
    expect(scopedSenderMayRelay({ ...rename, patch: { theme: 'dark' } }, SCOPE)).toBe(true);
    expect(scopedSenderMayRelay(rename, null)).toBe(true);
  });

  it('fails closed on anything else', () => {
    expect(scopedSenderMayRelay({ kind: 'something-new' }, SCOPE)).toBe(false);
    expect(scopedSenderMayRelay(undefined, SCOPE)).toBe(false);
  });
});

describe('opFromScopedSender (a scoped whole-tab op keeps no name)', () => {
  const op = { kind: 'tab', tabId: SCOPE, tab: { id: SCOPE, name: 'Renamed', elements: [] } };

  it("drops the name from a scoped session's whole tab", () => {
    expect(opFromScopedSender(op, SCOPE)).toEqual({
      kind: 'tab',
      tabId: SCOPE,
      tab: { id: SCOPE, elements: [] },
    });
  });

  it('passes everything else through untouched', () => {
    expect(opFromScopedSender(op, null)).toBe(op);
    const el = { kind: 'el', tabId: SCOPE };
    expect(opFromScopedSender(el, SCOPE)).toBe(el);
    const nameless = { kind: 'tab', tabId: SCOPE, tab: { id: SCOPE, elements: [] } };
    expect(opFromScopedSender(nameless, SCOPE)).toBe(nameless);
  });
});
