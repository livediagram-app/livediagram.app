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
// A presence op the gate parses relays as the parsed copy (`op`): here each one sent is already that shape.
const relayed = (op: unknown) => ({ ...relay(true), op });
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

  it('keeps a viewer from taking part: speech and focus', () => {
    for (const op of [say, { kind: 'focus-here' }])
      expect(gateClientOp(op, as('view'))).toEqual(DROP);
    expect(gateClientOp(say, as('participate'))).toEqual(relayed(say));
    expect(gateClientOp({ kind: 'focus-here' }, as('participate'))).toEqual(DROP);
  });

  // docs/specs/008-canvas/avatar-mode.md "The wire": the room relays the checked copy, never the op as sent.
  it('relays a speech bubble as its checked copy, trimmed and without fields the wire lacks', () => {
    const forged = { ...say, text: '  hi  ', name: 'The Owner', html: '<b>x</b>' };
    expect(gateClientOp(forged, as('edit'))).toEqual(relayed(say));
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
      expect(gateClientOp(op, as('participate'))).toEqual(relayed(op));
      expect(gateClientOp(op, as('edit'))).toEqual(relayed(op));
    }
    expect(gateClientOp({ ...track, track: null }, as('participate'))).toEqual(
      relayed({ ...track, track: null }),
    );
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
      expect(gateClientOp(op, as('participate'))).toEqual(relayed(op));
      expect(gateClientOp(op, as('edit'))).toEqual(relayed(op));
    }
    expect(gateClientOp({ ...hand, raised: 'yes' }, as('edit'))).toEqual(DROP);
    expect(gateClientOp({ ...letSpeak, targetId: '' }, as('edit'))).toEqual(DROP);
  });

  // A field the wire does not define never reaches a peer: the room relays the gate's parsed copy.
  it('answers the parsed copy of a call, knock or bell op, without fields the wire lacks', () => {
    const extra = { name: 'The Owner', html: '<b>x</b>' };
    const knock = { kind: 'avatar-knock', tabId: 't', roomId: 'room-1' };
    const letSpeak = { kind: 'avatar-let-speak', tabId: 't', targetId: 'p2', on: true };
    expect(gateClientOp({ ...knock, ...extra }, as('view'))).toEqual(relayed(knock));
    expect(gateClientOp({ ...letSpeak, ...extra }, as('edit'))).toEqual(relayed(letSpeak));
  });

  // docs/specs/008-canvas/avatar-mode.md "You can push each other": from anyone, but a direction that is not a
  // number would send the peer's character to NaN, so a malformed push reaches nobody.
  it('addresses a shove from any level as its checked copy, and drops a malformed one', () => {
    const push = { kind: 'avatar-push', tabId: 't', targetId: 'p2', dx: 0, dy: -2 };
    const unit = { ...push, dy: -1 };
    expect(gateClientOp({ ...push, name: 'x' }, as('view'))).toEqual(relayed(unit));
    expect(gateClientOp(push, as('edit'))).toEqual(relayed(unit));
    expect(gateClientOp({ ...push, dx: 'a' }, as('view'))).toEqual(DROP);
    expect(gateClientOp({ ...push, dy: {} }, as('edit'))).toEqual(DROP);
    expect(gateClientOp({ ...push, dx: 0, dy: 0 }, as('edit'))).toEqual(DROP);
    expect(gateClientOp({ ...push, targetId: 7 }, as('edit'))).toEqual(DROP);
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
    expect(gateClientOp(camera, as('participate'))).toEqual(relayed(camera));
    expect(gateClientOp(camera, as('view'))).toEqual(DROP);
    expect(gateClientOp(screen, as('edit'))).toEqual(relayed(screen));
    expect(gateClientOp(screen, as('participate'))).toEqual(DROP);
    // Stopping a share is not sharing one.
    expect(gateClientOp({ ...screen, screen: null }, as('participate'))).toEqual(
      relayed({ ...screen, screen: null }),
    );
    expect(gateClientOp({ ...camera, video: at('screen') }, as('edit'))).toEqual(DROP);
  });

  it("routes a participant's element op through the content rule", () => {
    expect(gateClientOp({ kind: 'el', tabId: 't' }, as('participate'))).toEqual({
      kind: 'participant-content',
    });
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

  // docs/specs/009-elements/social-pieces.md "Notice Board": a Participant pins and unpins as itself, signed with its
  // server-verified adder key, never its claimed collab key.
  it('relays a notice board pin or unpin from a Participant only when signed with its adder key', () => {
    const op = (delta: Record<string, unknown>) => ({
      kind: 'el-delta',
      tabId: 't',
      elementId: 'nb',
      delta,
    });
    const note = (by: string) => ({ id: 'n', text: 'Hi', author: 'Me', by, at: 1 });
    const pin = (by: string) => op({ kind: 'notice-pin', note: note(by) });
    const unpin = (by: string) => op({ kind: 'notice-unpin', noteId: 'n', by });
    const participant = as('participate', { adderKey: 'adder' });
    for (const mine of [pin('adder'), unpin('adder')]) {
      expect(gateClientOp(mine, participant)).toEqual(relay(false, true));
      expect(gateClientOp(mine, as('edit'))).toEqual(relay(false));
      expect(gateClientOp(mine, as('view', { adderKey: 'adder' }))).toEqual(DROP);
    }
    // Another's key, its claimed collab key, or no adder key at all.
    for (const other of [pin('someone'), unpin('someone'), pin('me'), unpin('me')])
      expect(gateClientOp(other, participant)).toEqual(DROP);
    expect(gateClientOp(pin('adder'), as('participate'))).toEqual(DROP);
    expect(gateClientOp(unpin(''), as('participate', { adderKey: '' }))).toEqual(DROP);
    expect(gateClientOp(op({ kind: 'notice-pin', note: null }), participant)).toEqual(DROP);
  });

  // docs/specs/009-elements/social-pieces.md "High Scores": a Participant posts its own score, never clears the table.
  it('relays an arcade score from a Participant only when signed with its adder key, and a clear only from an Editor', () => {
    const op = (delta: Record<string, unknown>) => ({
      kind: 'el-delta',
      tabId: 't',
      elementId: 'arcade',
      delta,
    });
    const post = (by: string) =>
      op({
        kind: 'arcade-score',
        score: { id: 's', name: 'Ann', score: 10, ms: 5_000, by, at: 1 },
      });
    const clear = op({ kind: 'arcade-clear' });
    const participant = as('participate', { adderKey: 'adder' });
    expect(gateClientOp(post('adder'), participant)).toEqual(relay(false, true));
    expect(gateClientOp(post('someone'), participant)).toEqual(DROP);
    expect(gateClientOp(post('me'), participant)).toEqual(DROP);
    expect(gateClientOp(post('adder'), as('view', { adderKey: 'adder' }))).toEqual(DROP);
    expect(gateClientOp(post('anyone'), as('edit'))).toEqual(relay(false));
    expect(gateClientOp(clear, participant)).toEqual(DROP);
    expect(gateClientOp(clear, as('view'))).toEqual(DROP);
    expect(gateClientOp(clear, as('edit'))).toEqual(relay(false));
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

  // docs/specs/002-project-scope/not-in-livehuddle.md "The Vote": an old client's dot is dropped from every level.
  it('drops the retired vote op from every level', () => {
    for (const level of ['edit', 'participate', 'view'] as const) {
      expect(gateClientOp({ kind: 'vote', tabId: 't', voter: 'me' }, as(level))).toEqual(DROP);
    }
  });

  it('decides a tab op in well under a microsecond (it runs on every op)', () => {
    const op = { kind: 'tab', tabId: 't1', tab: { id: 't1', elements: [] } };
    const meta = { kind: 'tab-meta', tabId: 't1', patch: { timer: null } };
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
    expect(gateClientOp(op, as('edit'))).toEqual(relayed(op));
    expect(gateClientOp(op, as('participate'))).toEqual(DROP);
    expect(gateClientOp(op, as('view'))).toEqual(DROP);
    expect(gateClientOp({ ...op, targetId: '' }, as('edit'))).toEqual(DROP);
  });

  // docs/specs/012-collaboration/knock.md "Share roles": a knock and its answer are presence from every level.
  it('relays a knock and its answer from every level, and only well formed', () => {
    const knock = { kind: 'avatar-knock', tabId: 't', roomId: 'room-1' };
    const answer = {
      kind: 'avatar-knock-answer',
      tabId: 't',
      targetId: 'p2',
      roomId: 'room-1',
      answer: 'in',
    };
    for (const role of ['edit', 'participate', 'view']) {
      expect(gateClientOp(knock, as(role))).toEqual(relayed(knock));
      expect(gateClientOp(answer, as(role))).toEqual(relayed(answer));
    }
    expect(gateClientOp({ ...knock, roomId: '' }, as('edit'))).toEqual(DROP);
    expect(gateClientOp({ ...answer, answer: 'maybe' }, as('view'))).toEqual(DROP);
  });

  // docs/specs/009-elements/workday-pieces.md "Share roles": the reception bell is presence from every level.
  it('relays a ring of the reception bell from every level, Viewer included, and only well formed', () => {
    const ring = { kind: 'avatar-bell', tabId: 't', deskId: 'desk-1' };
    for (const role of ['edit', 'participate', 'view'])
      expect(gateClientOp(ring, as(role))).toEqual(relayed(ring));
    expect(gateClientOp({ ...ring, deskId: '' }, as('view'))).toEqual(DROP);
    expect(gateClientOp({ kind: 'avatar-bell', tabId: 't' }, as('edit'))).toEqual(DROP);
  });

  // docs/specs/012-collaboration/nudge.md "Share roles": an Editor and a Participant nudge, a Viewer is only nudged.
  it("relays an Editor's and a Participant's nudge, never a Viewer's or a malformed one", () => {
    const nudge = { kind: 'nudge', targetId: 's1' };
    for (const role of ['edit', 'participate'])
      expect(gateClientOp({ ...nudge, extra: 1 }, as(role))).toEqual(relayed(nudge));
    expect(gateClientOp(nudge, as('view'))).toEqual(DROP);
    expect(gateClientOp({ kind: 'nudge', targetId: '' }, as('edit'))).toEqual(DROP);
    expect(
      gateClientOp({ kind: 'nudge-refused', targetId: 's1', retryInMs: 1 }, as('edit')),
    ).toEqual(DROP);
  });

  // docs/specs/012-collaboration/follow-me-viewport.md: a camera is presence from every level, and only well formed.
  it('relays a camera from every level, its own fields alone, and drops one a follower could not apply', () => {
    const cam = { kind: 'viewport', tabId: 't', pan: { x: 1, y: 2 }, zoom: 1 };
    for (const role of ['edit', 'participate', 'view'])
      expect(gateClientOp({ ...cam, junk: 1 }, as(role))).toEqual(relayed(cam));
    expect(gateClientOp({ ...cam, zoom: 0 }, as('view'))).toEqual(DROP);
    expect(gateClientOp({ ...cam, pan: { x: 'a', y: 0 } }, as('edit'))).toEqual(DROP);
  });

  // docs/specs/009-elements/social-pieces.md "Share roles": an Editor and a Participant play, a Viewer watches.
  it("relays a game's paddle and moments from an Editor or a Participant, never a Viewer's or a malformed one", () => {
    const input = { kind: 'game-input', tabId: 't', pieceId: 'table-1', seat: 0, axis: 0.5 };
    const event = {
      kind: 'game-event',
      tabId: 't',
      pieceId: 'table-1',
      seat: 1,
      game: 'ping-pong',
      match: 'm1',
      seq: 3,
      event: 'miss',
      score: [1, 0],
    };
    for (const role of ['edit', 'participate']) {
      expect(gateClientOp(input, as(role))).toEqual(relayed(input));
      expect(gateClientOp(event, as(role))).toEqual(relayed(event));
    }
    expect(gateClientOp(input, as('view'))).toEqual(DROP);
    expect(gateClientOp(event, as('view'))).toEqual(DROP);
    expect(gateClientOp({ ...input, axis: 2 }, as('edit'))).toEqual(DROP);
    expect(gateClientOp({ ...event, event: 'hit' }, as('edit'))).toEqual(DROP);
  });
});
