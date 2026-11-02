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
    const tab = { kind: 'tab', tabId: 't', tab: { id: 't', elements: [] } };
    expect(gateClientOp(tab, as('edit'))).toEqual(relay(false));
    expect(gateClientOp(tab, as('view'))).toEqual(DROP);
    // An unknown role reads as the lowest level.
    expect(gateClientOp(tab, as('admin'))).toEqual(DROP);
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

  // docs/specs/012-collaboration/comment-reactions.md "Share roles": whoever may comment may react.
  it('relays a comment reaction from an Editor and a Participant as itself, never from a Viewer', () => {
    const react = (by: string) => ({
      kind: 'el-delta',
      tabId: 't',
      elementId: 'e',
      delta: { kind: 'comment-react', commentId: 'c', emoji: 'eyes', by, name: 'Me', on: true },
    });
    expect(gateClientOp(react('me'), as('edit'))).toEqual(relay(false));
    expect(gateClientOp(react('me'), as('participate'))).toEqual(relay(false, true));
    expect(gateClientOp(react('you'), as('participate'))).toEqual(DROP);
    expect(gateClientOp(react('me'), as('view'))).toEqual(DROP);
  });

  // docs/specs/012-collaboration/collab-race-hardening.md "A Dashboard's layout travels as deltas": a layout change
  // is an Editor's alone, on its own tab when the link is scoped to one.
  it('relays a Dashboard layout change from an Editor only', () => {
    const delta = {
      kind: 'dashboard-delta',
      tabId: 't',
      patch: { rows: { r1: { set: { height: 340 } } } },
    };
    expect(gateClientOp(delta, as('edit'))).toEqual(relay(false));
    expect(gateClientOp(delta, as('participate'))).toEqual(DROP);
    expect(gateClientOp(delta, as('view'))).toEqual(DROP);
    expect(gateClientOp(delta, as('edit', { tabScope: 't' }))).toEqual(relay(false));
    expect(gateClientOp(delta, as('edit', { tabScope: 'other' }))).toEqual(DROP);
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
    expect(gateClientOp({ kind: 'project-meta' }, scoped)).toEqual(DROP);
  });

  it("drops a tab op whose payload names another tab, so a scoped link can't renumber its tab onto one it can't reach", () => {
    const scoped = as('edit', { tabScope: 't1' });
    // The envelope names the scoped tab; the payload, which receivers merge over it, names another.
    expect(
      gateClientOp({ kind: 'tab', tabId: 't1', tab: { id: 't2', elements: [] } }, scoped),
    ).toEqual(DROP);
    expect(gateClientOp({ kind: 'tab', tabId: 't1', tab: { elements: [] } }, scoped)).toEqual(DROP);
    expect(gateClientOp({ kind: 'tab', tabId: 't1' }, scoped)).toEqual(DROP);
    for (const key of ['id', 'elements']) {
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
