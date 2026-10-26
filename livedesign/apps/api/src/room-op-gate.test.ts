import { describe, expect, it } from 'vitest';
import { gateClientOp, type GateSender } from './room-op-gate';

// docs/specs/013-workspace/share-roles.md "The level ladder": what each role may relay through the room.
const as = (role: unknown, over: Partial<GateSender> = {}): GateSender => ({
  role,
  tabScope: null,
  ...over,
});
const relay = (presence: boolean) => ({ kind: 'relay', presence });
const DROP = { kind: 'drop' };

describe('gateClientOp', () => {
  it('never relays a system op from a client, whatever the role', () => {
    expect(gateClientOp({ kind: 'share-revoked', code: 'x' }, as('edit'))).toEqual(DROP);
  });

  it('relays presence from anyone, mutations from an editor only', () => {
    expect(gateClientOp({ kind: 'cursor' }, as('view'))).toEqual(relay(true));
    expect(gateClientOp({ kind: 'tab', tabId: 't', tab: { id: 't' } }, as('edit'))).toEqual(
      relay(false),
    );
    expect(gateClientOp({ kind: 'tab', tabId: 't', tab: { id: 't' } }, as('view'))).toEqual(DROP);
    // An unknown role reads as the lowest level.
    expect(gateClientOp({ kind: 'tab', tabId: 't', tab: { id: 't' } }, as('admin'))).toEqual(DROP);
  });

  it('relays a photo page\'s layer changes from an editor alone (docs/specs/031-photo/photo-pages.md "Share roles")', () => {
    const op = { kind: 'photo', tabId: 't', pageId: 'p', ops: [] };
    expect(gateClientOp(op, as('edit'))).toEqual(relay(false));
    expect(gateClientOp(op, as('participate'))).toEqual(DROP);
    expect(gateClientOp(op, as('view'))).toEqual(DROP);
    expect(gateClientOp(op, as('edit', { tabScope: 'other' }))).toEqual(DROP);
    expect(gateClientOp(op, as('edit', { tabScope: 't' }))).toEqual(relay(false));
  });

  // docs/specs/013-workspace/tab-scoped-share-links.md: a receiving editor takes the id inside a whole tab, or a
  // tab-meta patch's fields, as its tab's own, so a payload naming another tab would rewrite that tab through a peer.
  it('drops a tab op whose payload reaches past the tab it names, from anyone', () => {
    for (const sender of [as('edit'), as('edit', { tabScope: 't1' })]) {
      expect(gateClientOp({ kind: 'tab', tabId: 't1', tab: { id: 't2' } }, sender)).toEqual(DROP);
      expect(gateClientOp({ kind: 'tab', tabId: 't1' }, sender)).toEqual(DROP);
      for (const key of ['id', 'elements', 'photos']) {
        const op = { kind: 'tab-meta', tabId: 't1', patch: { [key]: 't2' } };
        expect(gateClientOp(op, sender), key).toEqual(DROP);
      }
      const recolour = { kind: 'tab-meta', tabId: 't1', patch: { color: '#0ea5e9' } };
      expect(gateClientOp(recolour, sender)).toEqual(relay(false));
      expect(gateClientOp({ kind: 'tab', tabId: 't1', tab: { id: 't1' } }, sender)).toEqual(
        relay(false),
      );
    }
  });

  // A tab's name is structure (docs/specs/013-workspace/tab-scoped-share-links.md): a tab-limited editor can't rename
  // even the tab it holds; a full editor can.
  it('relays a rename from a full editor only', () => {
    const rename = { kind: 'tab-meta', tabId: 't1', patch: { name: 'Roadmap' } };
    expect(gateClientOp(rename, as('edit'))).toEqual(relay(false));
    expect(gateClientOp(rename, as('edit', { tabScope: 't1' }))).toEqual(DROP);
  });

  it("routes a participant's element op through the content rule, and drops its other mutations", () => {
    expect(gateClientOp({ kind: 'el', tabId: 't' }, as('participate'))).toEqual({
      kind: 'participant-content',
    });
    expect(gateClientOp({ kind: 'vote', voter: 'me' }, as('participate'))).toEqual(DROP);
    expect(gateClientOp({ kind: 'tab', tabId: 't', tab: { id: 't' } }, as('participate'))).toEqual(
      DROP,
    );
  });

  it("shows only an editor's drag preview", () => {
    expect(gateClientOp({ kind: 'drag-preview' }, as('edit'))).toEqual(relay(true));
    expect(gateClientOp({ kind: 'drag-preview' }, as('participate'))).toEqual(DROP);
  });

  it('keeps a tab-scoped session to its own tab', () => {
    const scoped = as('edit', { tabScope: 't1' });
    expect(gateClientOp({ kind: 'tab', tabId: 't1', tab: { id: 't1' } }, scoped)).toEqual(
      relay(false),
    );
    expect(gateClientOp({ kind: 'tab', tabId: 't2', tab: { id: 't2' } }, scoped)).toEqual(DROP);
    expect(gateClientOp({ kind: 'design-meta' }, scoped)).toEqual(DROP);
  });
});
