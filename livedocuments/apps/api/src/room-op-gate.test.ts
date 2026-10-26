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
    const tab = { kind: 'tab', tabId: 't', tab: { id: 't', elements: [] } };
    expect(gateClientOp(tab, as('edit'))).toEqual(relay(false));
    expect(gateClientOp(tab, as('view'))).toEqual(DROP);
    // An unknown role reads as the lowest level.
    expect(gateClientOp(tab, as('admin'))).toEqual(DROP);
  });

  it("routes a participant's element op and article frame through the text rules, and drops its other mutations", () => {
    expect(gateClientOp({ kind: 'el', tabId: 't' }, as('participate'))).toEqual({
      kind: 'participant-content',
    });
    expect(gateClientOp({ kind: 'article', tabId: 't' }, as('participate'))).toEqual({
      kind: 'participant-article',
    });
    for (const kind of ['tab', 'tab-meta', 'el-delta', 'document-meta']) {
      expect(gateClientOp({ kind, tabId: 't' }, as('participate')), kind).toEqual(DROP);
    }
  });

  it("drops a participant's article frame for a tab outside its link", () => {
    const scoped = as('participate', { tabScope: 't1' });
    expect(gateClientOp({ kind: 'article', tabId: 't1' }, scoped)).toEqual({
      kind: 'participant-article',
    });
    expect(gateClientOp({ kind: 'article', tabId: 't2' }, scoped)).toEqual(DROP);
    expect(gateClientOp({ kind: 'el', tabId: 't2' }, scoped)).toEqual(DROP);
  });

  it("relays an article frame from an editor as sent, and drops a viewer's", () => {
    expect(gateClientOp({ kind: 'article', tabId: 't' }, as('edit'))).toEqual(relay(false));
    expect(gateClientOp({ kind: 'article', tabId: 't' }, as('view'))).toEqual(DROP);
  });

  it("shows only an editor's drag preview", () => {
    expect(gateClientOp({ kind: 'drag-preview' }, as('edit'))).toEqual(relay(true));
    expect(gateClientOp({ kind: 'drag-preview' }, as('participate'))).toEqual(DROP);
  });

  it('keeps a tab-scoped session to its own tab', () => {
    const scoped = as('edit', { tabScope: 't1' });
    const tabOp = (tabId: string) => ({ kind: 'tab', tabId, tab: { id: tabId, elements: [] } });
    expect(gateClientOp(tabOp('t1'), scoped)).toEqual(relay(false));
    expect(gateClientOp(tabOp('t2'), scoped)).toEqual(DROP);
    expect(gateClientOp({ kind: 'document-meta' }, scoped)).toEqual(DROP);
  });

  it("drops a tab op whose payload names another tab, so a scoped link can't renumber its tab onto one it can't reach", () => {
    const scoped = as('edit', { tabScope: 't1' });
    // The envelope names the scoped tab; the payload, which receivers merge over it, names another.
    expect(
      gateClientOp({ kind: 'tab', tabId: 't1', tab: { id: 't2', elements: [] } }, scoped),
    ).toEqual(DROP);
    expect(gateClientOp({ kind: 'tab', tabId: 't1', tab: { elements: [] } }, scoped)).toEqual(DROP);
    expect(gateClientOp({ kind: 'tab', tabId: 't1' }, scoped)).toEqual(DROP);
    for (const key of ['id', 'elements', 'articles']) {
      expect(
        gateClientOp({ kind: 'tab-meta', tabId: 't1', patch: { [key]: 't2' } }, scoped),
      ).toEqual(DROP);
    }
    expect(gateClientOp({ kind: 'tab-meta', tabId: 't1' }, scoped)).toEqual(DROP);
    expect(
      gateClientOp({ kind: 'tab-meta', tabId: 't1', patch: { name: 'Plan' } }, scoped),
    ).toEqual(relay(false));
    // The same holds for an unscoped editor: the payload's id is never the sender's to change.
    expect(gateClientOp({ kind: 'tab', tabId: 't1', tab: { id: 't2' } }, as('edit'))).toEqual(DROP);
  });
});
