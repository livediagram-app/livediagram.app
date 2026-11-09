// The room's side of the calls' server checks, through the real room (docs/specs/012-collaboration/
// meeting-rooms-and-stage.md "Trust", "Share roles"; video-and-screen-bubbles.md "Share roles"): a call proving its
// session, the mint route's hearing question (#483), a let-speak from someone who may not (#495), and an Editor
// stopping someone's share (#469). Role tests for an Editor, a Participant and a Viewer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sealSessionToken } from './calls/call-tokens';
import { DocumentRoom } from './document-room/document-room';

type Socket = { sent: string[]; attachment: Record<string, unknown> };
type Frame = { kind: string; from?: string; op?: { kind?: string } };

const SECRET = 'secret';
const DOC = 'doc1';

const wsCache = new WeakMap<Socket, WebSocket>();
function wsOf(s: Socket): WebSocket {
  let ws = wsCache.get(s);
  if (!ws) {
    ws = {
      send: (d: string) => void s.sent.push(d),
      serializeAttachment: (v: Record<string, unknown>) => void (s.attachment = v),
      deserializeAttachment: () => s.attachment,
    } as unknown as WebSocket;
    wsCache.set(s, ws);
  }
  return ws;
}

function newRoom() {
  const sockets: Socket[] = [];
  const state = {
    acceptWebSocket: () => {},
    getWebSockets: () => sockets.map(wsOf),
    storage: {
      get: () => Promise.resolve(undefined),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve(false),
      list: () => Promise.resolve(new Map()),
      setAlarm: () => Promise.resolve(),
      deleteAlarm: () => Promise.resolve(),
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  const room = new DocumentRoom(
    state as unknown as DurableObjectState,
    {
      REALTIME_APP_TOKEN: SECRET,
    } as never,
  );
  const join = (id: string, role: 'edit' | 'participate' | 'view', key?: string) => {
    const s: Socket = {
      sent: [],
      // The upgrade pins the key on the session (docs/specs/013-workspace/share-roles.md "The collab key").
      attachment: {
        presenceId: id,
        verifiedRole: role,
        presence: null,
        documentId: DOC,
        ...(key ? { collabKey: key } : {}),
      },
    };
    sockets.push(s);
    room.webSocketMessage(
      wsOf(s),
      JSON.stringify({
        kind: 'hello',
        participant: { name: id, color: '#abc', tabId: 't', ...(key ? { key } : {}) },
      }),
    );
    s.sent.length = 0;
    return s;
  };
  const say = (s: Socket, op: unknown) =>
    room.webSocketMessage(wsOf(s), JSON.stringify({ kind: 'op', op }));
  const walk = (s: Socket, x: number, y: number) =>
    say(s, { kind: 'avatar', tabId: 't', avatar: { x, y, facing: 'down', walking: false } });
  const prove = async (s: Socket, sessionId: string, token?: string) => {
    say(s, {
      kind: 'call-session',
      tabId: 't',
      sessionId,
      sessionToken: token ?? (await sealSessionToken(SECRET, DOC, sessionId, 'l')),
    });
    await vi.waitFor(() => expect(s.attachment.callSession ?? 'none').toBeDefined());
  };
  // A socket dropping: gone from the room's sockets, then its close handled.
  const drop = (s: Socket) => {
    sockets.splice(sockets.indexOf(s), 1);
    room.webSocketClose(wsOf(s));
  };
  return { room, join, say, walk, prove, drop };
}

const ops = (s: Socket): Frame[] => s.sent.map((raw) => JSON.parse(raw) as Frame);
const mic = (sessionId: string) => ({ sessionId, trackName: 'mic' });

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('the room and the calls checks', () => {
  it('keeps a proven call session on the connection, never relays it, and ignores a forged one', async () => {
    const { join, prove } = newRoom();
    const viewer = join('vw', 'view');
    const other = join('ed', 'edit');
    await prove(viewer, 'S-vw');
    await vi.waitFor(() => expect(viewer.attachment.callSession).toBe('S-vw'));
    await prove(other, 'S-ed', 'l.forged');
    // The token is checked asynchronously (Web Crypto), so wait for its refusal rather than one tick: on a busy
    // runner one tick ended before the check did (#1306, 2026-11-05).
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalledWith('[calls] token', 'room'));
    expect(other.attachment.callSession).toBeUndefined();
    expect(ops(other).some((f) => f.op?.kind === 'call-session')).toBe(false);
  });

  it('answers the mint route from where each call stands (#483), for every level', async () => {
    const { room, join, walk, prove } = newRoom();
    const ed = join('ed', 'edit');
    const pt = join('pt', 'participate');
    const vw = join('vw', 'view');
    for (const [s, id] of [
      [ed, 'S-ed'],
      [pt, 'S-pt'],
      [vw, 'S-vw'],
    ] as const)
      await prove(s, id);
    await vi.waitFor(() => expect(vw.attachment.callSession).toBe('S-vw'));
    walk(ed, 100, 100);
    walk(pt, 200, 100);
    walk(vw, 3000, 3000);
    expect(await room.callsHearing(DOC, 'S-pt', [mic('S-ed')])).toEqual(['heard']);
    expect(await room.callsHearing(DOC, 'S-vw', [mic('S-ed'), mic('S-pt')])).toEqual([
      'apart',
      'apart',
    ]);
    expect(await room.callsHearing(DOC, 'S-stranger', [mic('S-ed')])).toEqual(['unknown-session']);
  });

  it('delivers a let-speak from an Editor, and drops a Participant’s off every stage (#495)', () => {
    const { join, say } = newRoom();
    const ed = join('ed', 'edit');
    const pt = join('pt', 'participate');
    const hand = join('hand', 'participate');
    say(hand, { kind: 'avatar-hand', tabId: 't', raised: true });
    hand.sent.length = 0;
    const op = { kind: 'avatar-let-speak', tabId: 't', targetId: 'hand', on: true };
    say(pt, op);
    expect(ops(hand)).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith('[calls] let-speak refused');
    say(ed, op);
    expect(ops(hand)).toEqual([{ kind: 'op', from: 'ed', op }]);
  });

  it('keeps a hand let speak heard when whoever let it reconnects as the same person', async () => {
    const { room, join, say, walk, prove, drop } = newRoom();
    const ed = join('ed', 'edit', 'K-ed');
    const hand = join('hand', 'participate', 'K-hand');
    const vw = join('vw', 'view', 'K-vw');
    await prove(hand, 'S-hand');
    await prove(vw, 'S-vw');
    await vi.waitFor(() => expect(vw.attachment.callSession).toBe('S-vw'));
    walk(ed, 100, 100);
    walk(hand, 3000, 3000);
    walk(vw, 100, 100);
    say(hand, { kind: 'avatar-hand', tabId: 't', raised: true });
    say(ed, { kind: 'avatar-let-speak', tabId: 't', targetId: 'hand', on: true });
    expect(await room.callsHearing(DOC, 'S-vw', [mic('S-hand')])).toEqual(['heard']);
    // The Editor's connection drops and comes back: a new presence id, the same key.
    drop(ed);
    expect(await room.callsHearing(DOC, 'S-vw', [mic('S-hand')])).toEqual(['apart']);
    const ed2 = join('ed2', 'edit', 'K-ed');
    expect(await room.callsHearing(DOC, 'S-vw', [mic('S-hand')])).toEqual(['heard']);
    // Another Editor is not that person: once the letter is gone, the hand is the audience again.
    drop(ed2);
    join('other', 'edit', 'K-other');
    expect(await room.callsHearing(DOC, 'S-vw', [mic('S-hand')])).toEqual(['apart']);
  });

  it('lets an Editor stop someone’s share: addressed to them alone, and no new viewer after (#469)', async () => {
    const { room, join, say, walk, prove } = newRoom();
    const ed = join('ed', 'edit');
    const pt = join('pt', 'participate');
    const sharer = join('sharer', 'edit');
    await prove(ed, 'S-ed');
    await prove(sharer, 'S-sh');
    await vi.waitFor(() => expect(sharer.attachment.callSession).toBe('S-sh'));
    walk(ed, 100, 100);
    walk(sharer, 150, 100);
    const shared = { sessionId: 'S-sh', trackName: 'screen', token: 'k' };
    say(sharer, { kind: 'call-track', tabId: 't', track: null, screen: shared });
    for (const s of [ed, pt, sharer]) s.sent.length = 0;
    const op = { kind: 'call-stop-share', tabId: 't', targetId: 'sharer' };
    say(pt, op);
    expect(ops(sharer)).toEqual([]);
    say(ed, op);
    expect(ops(sharer)).toEqual([{ kind: 'op', from: 'ed', op }]);
    expect(ops(pt).some((f) => f.op?.kind === 'call-stop-share')).toBe(false);
    const screen = { sessionId: 'S-sh', trackName: 'screen' };
    expect(await room.callsHearing(DOC, 'S-ed', [screen])).toEqual(['stopped']);
    // The sharer's call says the screen is off: the stop is done with.
    say(sharer, { kind: 'call-track', tabId: 't', track: null, screen: null });
    expect(await room.callsHearing(DOC, 'S-ed', [screen])).toEqual(['heard']);
  });
});
