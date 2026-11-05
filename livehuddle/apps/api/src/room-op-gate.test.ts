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
    // The calls kill switch's push is the room's own: a forged one would end everyone's call.
    expect(gateClientOp({ kind: 'calls-mode', mode: 'off' }, as('edit'))).toEqual(DROP);
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

  // docs/specs/012-collaboration/proximity-audio.md "Share roles": a Viewer listens.
  it('relays a talking level and a microphone locator from a speaker only, and only well formed', () => {
    const voice = { kind: 'avatar-voice', tabId: 't', level: 2 };
    const track = {
      kind: 'call-track',
      tabId: 't',
      track: { sessionId: 's', trackName: 'mic', token: 'k' },
    };
    for (const op of [voice, track]) {
      expect(gateClientOp(op, as('view'))).toEqual(DROP);
      expect(gateClientOp(op, as('participate'))).toEqual(relay(true));
      expect(gateClientOp(op, as('edit'))).toEqual(relay(true));
    }
    expect(gateClientOp({ ...track, track: null }, as('participate'))).toEqual(relay(true));
    expect(gateClientOp({ ...voice, level: 7 }, as('edit'))).toEqual(DROP);
    expect(gateClientOp({ ...track, track: { sessionId: 's' } }, as('edit'))).toEqual(DROP);
  });

  // docs/specs/012-collaboration/meeting-rooms-and-stage.md "Share roles": a Viewer never raises a hand or lets one
  // speak; an Editor and a Participant may, and only well formed.
  it('relays a hand and a let-speak from an Editor or a Participant only, and only well formed', () => {
    const hand = { kind: 'avatar-hand', tabId: 't', raised: true };
    const letSpeak = { kind: 'avatar-let-speak', tabId: 't', targetId: 'p2', on: true };
    for (const op of [hand, letSpeak]) {
      expect(gateClientOp(op, as('view'))).toEqual(DROP);
      expect(gateClientOp(op, as('participate'))).toEqual(relay(true));
      expect(gateClientOp(op, as('edit'))).toEqual(relay(true));
    }
    expect(gateClientOp({ ...hand, raised: 'yes' }, as('edit'))).toEqual(DROP);
    expect(gateClientOp({ ...letSpeak, targetId: '' }, as('edit'))).toEqual(DROP);
  });

  // docs/specs/016-platform/calls-kill-switch.md "The room tells its clients": a silent publisher's nudge.
  it('lets a calls-check through from a speaker only, and only well formed', () => {
    const check = { kind: 'calls-check', tabId: 't' };
    expect(gateClientOp(check, as('view'))).toEqual(DROP);
    expect(gateClientOp(check, as('participate'))).toEqual(relay(true));
    expect(gateClientOp(check, as('edit'))).toEqual(relay(true));
    expect(gateClientOp({ kind: 'calls-check' }, as('edit'))).toEqual(DROP);
  });

  // docs/specs/012-collaboration/video-and-screen-bubbles.md "Share roles": a camera is taking part, a screen an Editor's.
  it('relays a camera from a speaker, a screen from an Editor only, and never a slot holding another track', () => {
    const at = (trackName: string) => ({ sessionId: 's', trackName, token: 'k' });
    const camera = { kind: 'call-track', tabId: 't', track: null, video: at('cam') };
    const screen = { kind: 'call-track', tabId: 't', track: null, screen: at('screen') };
    expect(gateClientOp(camera, as('participate'))).toEqual(relay(true));
    expect(gateClientOp(camera, as('view'))).toEqual(DROP);
    expect(gateClientOp(screen, as('edit'))).toEqual(relay(true));
    expect(gateClientOp(screen, as('participate'))).toEqual(DROP);
    // Stopping a share is not sharing one.
    expect(gateClientOp({ ...screen, screen: null }, as('participate'))).toEqual(relay(true));
    expect(gateClientOp({ ...camera, video: at('screen') }, as('edit'))).toEqual(DROP);
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

  // docs/specs/012-collaboration/proximity-audio.md "The wire": a call proves its session from any level.
  it('takes a call-session op from every level, and only well formed', () => {
    const op = { kind: 'call-session', tabId: 't', sessionId: 's', sessionToken: 'l.x' };
    for (const role of ['edit', 'participate', 'view'])
      expect(gateClientOp(op, as(role))).toEqual(relay(true));
    expect(gateClientOp({ ...op, sessionToken: '' }, as('edit'))).toEqual(DROP);
  });

  // docs/specs/012-collaboration/video-and-screen-bubbles.md "Share roles" (#469): an Editor's alone.
  it('relays a stop-share from an Editor only, and only well formed', () => {
    const op = { kind: 'call-stop-share', tabId: 't', targetId: 'p2' };
    expect(gateClientOp(op, as('edit'))).toEqual(relay(true));
    expect(gateClientOp(op, as('participate'))).toEqual(DROP);
    expect(gateClientOp(op, as('view'))).toEqual(DROP);
    expect(gateClientOp({ ...op, targetId: '' }, as('edit'))).toEqual(DROP);
  });
});
