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

describe('gateClientOp', () => {
  it('never relays a system op from a client, whatever the role', () => {
    expect(gateClientOp({ kind: 'share-revoked', code: 'x' }, as('edit'))).toEqual(DROP);
  });

  it('relays presence from anyone, mutations from an editor only', () => {
    expect(gateClientOp({ kind: 'cursor' }, as('view'))).toEqual(relay(true));
    expect(gateClientOp({ kind: 'tab', tabId: 't' }, as('edit'))).toEqual(relay(false));
    expect(gateClientOp({ kind: 'tab', tabId: 't' }, as('view'))).toEqual(DROP);
    // An unknown role reads as the lowest level.
    expect(gateClientOp({ kind: 'tab', tabId: 't' }, as('admin'))).toEqual(DROP);
  });

  it("routes a participant's element op through the content rule, and relays its own answers", () => {
    expect(gateClientOp({ kind: 'el', tabId: 't' }, as('participate'))).toEqual({
      kind: 'participant-content',
    });
    expect(gateClientOp({ kind: 'vote', voter: 'me' }, as('participate'))).toEqual(
      relay(false, true),
    );
    expect(gateClientOp({ kind: 'vote', voter: 'you' }, as('participate'))).toEqual(DROP);
    expect(gateClientOp({ kind: 'tab', tabId: 't' }, as('participate'))).toEqual(DROP);
  });

  it("shows only an editor's drag preview", () => {
    expect(gateClientOp({ kind: 'drag-preview' }, as('edit'))).toEqual(relay(true));
    expect(gateClientOp({ kind: 'drag-preview' }, as('participate'))).toEqual(DROP);
  });

  it('keeps a tab-scoped session to its own tab', () => {
    const scoped = as('edit', { tabScope: 't1' });
    expect(gateClientOp({ kind: 'tab', tabId: 't1' }, scoped)).toEqual(relay(false));
    expect(gateClientOp({ kind: 'tab', tabId: 't2' }, scoped)).toEqual(DROP);
    expect(gateClientOp({ kind: 'document-meta' }, scoped)).toEqual(DROP);
  });
});
