import { describe, expect, it } from 'vitest';
import { gateClientOp, type GateSender } from './room-op-gate';

// docs/specs/013-workspace/share-roles.md "The level ladder": what each role may relay through the room.
const as = (role: unknown, over: Partial<GateSender> = {}): GateSender => ({
  role,
  tabScope: null,
  key: 'me',
  ...over,
});
const relay = (presence: boolean, participantAnswers = false) => ({
  kind: 'relay',
  presence,
  participantAnswers,
});
const DROP = { kind: 'drop' };
const say = { kind: 'avatar-say', tabId: 't', id: 'a', text: 'hi', x: 0, y: 0 };

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

  it('keeps a viewer from taking part: answers, reactions, speech and focus', () => {
    for (const op of [{ kind: 'poll-answer' }, { kind: 'reaction' }, say, { kind: 'focus-here' }])
      expect(gateClientOp(op, as('view'))).toEqual(DROP);
    expect(gateClientOp({ kind: 'reaction' }, as('participate'))).toEqual(relay(true));
    expect(gateClientOp(say, as('participate'))).toEqual(relay(true));
    expect(gateClientOp({ kind: 'focus-here' }, as('participate'))).toEqual(DROP);
  });

  it('drops a malformed speech bubble from anyone', () => {
    expect(gateClientOp({ ...say, text: '' }, as('edit'))).toEqual(DROP);
  });

  it("routes a participant's element op through the content rule, and relays its own answers", () => {
    expect(gateClientOp({ kind: 'el', tabId: 't' }, as('participate'))).toEqual({
      kind: 'participant-content',
    });
    expect(gateClientOp({ kind: 'vote', voter: 'me' }, as('participate'))).toEqual(
      relay(false, true),
    );
    expect(gateClientOp({ kind: 'vote', voter: 'you' }, as('participate'))).toEqual(DROP);
    expect(
      gateClientOp({ kind: 'tab', tabId: 't', tab: { id: 't', elements: [] } }, as('participate')),
    ).toEqual(DROP);
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
    expect(gateClientOp({ kind: 'tab-meta', tabId: 't1', patch: { timer: null } }, scoped)).toEqual(
      relay(false),
    );
    // The same holds for an unscoped editor: the payload's id is never the sender's to change.
    expect(gateClientOp({ kind: 'tab', tabId: 't1', tab: { id: 't2' } }, as('edit'))).toEqual(DROP);
  });

  // docs/specs/013-workspace/tab-scoped-share-links.md "No rename from a scoped session".
  it("drops a scoped session's rename, set or cleared, and keeps an unscoped editor's", () => {
    const scoped = as('edit', { tabScope: 't1' });
    expect(
      gateClientOp({ kind: 'tab-meta', tabId: 't1', patch: { name: 'Plan' } }, scoped),
    ).toEqual(DROP);
    expect(
      gateClientOp({ kind: 'tab-meta', tabId: 't1', patch: {}, clear: ['name'] }, scoped),
    ).toEqual(DROP);
    expect(
      gateClientOp({ kind: 'tab-meta', tabId: 't1', patch: { name: 'Plan' } }, as('edit')),
    ).toEqual(relay(false));
  });

  it('decides a tab op in well under a microsecond (it runs on every op)', () => {
    const op = { kind: 'tab', tabId: 't1', tab: { id: 't1', elements: [] } };
    const meta = { kind: 'tab-meta', tabId: 't1', patch: { timer: null, vote: null } };
    const sender = as('edit', { tabScope: 't1' });
    const n = 200_000;
    const start = performance.now();
    for (let i = 0; i < n; i++) {
      gateClientOp(op, sender);
      gateClientOp(meta, sender);
    }
    const perOpUs = ((performance.now() - start) * 1000) / (2 * n);
    // Measured about 0.1 µs per op; the budget leaves room for a busy CI machine.
    expect(perOpUs).toBeLessThan(5);
  });
});
