import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_FORMAT } from '@livediagram/api-schema';
import type { ParticipantPresence } from '@livediagram/api-schema';
import {
  MUTATION_OP_KINDS,
  PRESENCE_OP_KINDS,
  ROOM_OP_KINDS,
  SYSTEM_OP_KINDS,
} from '@livediagram/api-schema';
import { DocumentRoom } from './document-room';
import type { Env } from './types';

// PRESENCE_OP_KINDS is a readonly array (it has to be, to derive the type), so
// membership reads through this rather than `.has`.
const isPresenceKind = (kind: string): boolean =>
  (PRESENCE_OP_KINDS as readonly string[]).includes(kind);

// The DocumentRoom Durable Object is the realtime hub for one document.
// Most of its surface is straightforward fan-out, but two pieces carry
// real security weight:
//
//   1. The hello frame: the server-resolved role (set by the api worker
//      at the upgrade, pinned in the socket attachment) MUST overwrite
//      whatever role the client typed into its own hello payload. A
//      regression here lets a view-role visitor display itself as
//      Editor in peer presence, and the live-app Viewer / Editor badges
//      become spoofable.
//
//   2. `/broadcast` POST endpoint: the api worker calls this from the
//      share-revoke handler to push a `share-revoked` op into the
//      room so visitors with the revoked code disconnect. A regression
//      that silently drops the broadcast leaves revoked viewers
//      reading the document until their next refresh.
//
// Both go without alternative coverage today (no integration test
// exercises the DO and the route-level tests stub the room entirely).
// Pinned here with fake WebSocket + DurableObjectState shims because
// constructing real WebSocketPair / hibernatable sockets in node-vitest
// isn't worth the setup. The room uses the HIBERNATION API, so the shims
// cover exactly what it touches: `send` / `serializeAttachment` /
// `deserializeAttachment` on sockets, `acceptWebSocket` / `getWebSockets`
// on the state, and events are driven by calling the class-level
// `webSocketMessage` handler directly (which is precisely what the
// runtime does after a hibernation wake).

// Minimal socket stub. Captures sent payloads plus the serialized
// attachment (the hibernation-proof per-session store) so tests can
// simulate inbound frames and inspect both outbound traffic and what
// the room decided to persist.
type FakeSocket = {
  send: (data: string) => void;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
  sent: string[];
  attachment: unknown;
  // Toggle to make the next `send()` throw, mimicking a closed WS so
  // the DO's dead-socket cleanup branch can be exercised.
  failSend?: boolean;
};

// Fake DurableObjectState covering the two hibernation members the room
// uses. `getWebSockets()` is the runtime-managed connected set; the fake
// simply returns everything accepted (the real runtime also prunes
// closed sockets — that pruning is the runtime's job, not the room's).
type FakeState = {
  sockets: WebSocket[];
  acceptWebSocket: (ws: WebSocket) => void;
  getWebSockets: () => WebSocket[];
  // Backs the persisted epoch/seq (docs/specs/012-collaboration/resync-without-reload.md). Shared across DocumentRoom
  // instances built from the same FakeState, which is exactly what a
  // hibernation wake looks like: same storage, fresh instance.
  store: Map<string, unknown>;
  // The room's one alarm: the facilitator grace period (docs/specs/012-collaboration/facilitator.md) and agent
  // presence expiries; a cleared alarm records null.
  alarms: (number | null)[];
  storage: {
    get: (key: string) => Promise<unknown>;
    put: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<boolean>;
    list: (opts: { prefix: string }) => Promise<Map<string, unknown>>;
    setAlarm: (when: number) => Promise<void>;
    deleteAlarm: () => Promise<void>;
  };
  blockConcurrencyWhile: (fn: () => Promise<void>) => Promise<void>;
  waitUntil: (promise: Promise<unknown>) => void;
};

const asWs = (s: FakeSocket) => s as unknown as WebSocket;

function makeSocket(): FakeSocket {
  const sent: string[] = [];
  const socket: FakeSocket = {
    sent,
    attachment: null,
    send: (data) => {
      if (socket.failSend) throw new Error('socket closed');
      sent.push(data);
    },
    serializeAttachment: (value) => {
      socket.attachment = value;
    },
    deserializeAttachment: () => socket.attachment,
  };
  return socket;
}

function makeState(store: Map<string, unknown> = new Map()): FakeState {
  const state: FakeState = {
    sockets: [],
    acceptWebSocket: (ws) => {
      state.sockets.push(ws);
    },
    getWebSockets: () => [...state.sockets],
    store,
    alarms: [],
    storage: {
      get: (key) => Promise.resolve(store.get(key)),
      put: (key, value) => {
        store.set(key, value);
        return Promise.resolve();
      },
      delete: (key) => Promise.resolve(store.delete(key)),
      list: ({ prefix }) =>
        Promise.resolve(new Map([...store].filter(([key]) => key.startsWith(prefix)))),
      setAlarm: (when) => {
        state.alarms.push(when);
        return Promise.resolve();
      },
      deleteAlarm: () => {
        state.alarms.push(null);
        return Promise.resolve();
      },
    },
    blockConcurrencyWhile: (fn) => fn(),
    waitUntil: () => {},
  };
  return state;
}

function newRoom(): { room: DocumentRoom; state: FakeState } {
  const state = makeState();
  // Only acceptWebSocket / getWebSockets are read off the state, so the
  // fake above suffices for unit coverage.
  return { room: new DocumentRoom(state as unknown as DurableObjectState), state };
}

function presence(id: string, role?: 'edit' | 'view'): ParticipantPresence {
  return { id, name: `Name ${id}`, color: '#abc', role };
}

// Seed a fully-established session directly (attachment + connected set),
// the hibernation-API equivalent of the old `sessions.set(ws, presence)`.
function seedSession(
  state: FakeState,
  ws: FakeSocket,
  p: ParticipantPresence | null,
  isOwner = false,
): void {
  ws.attachment = { presenceId: p?.id ?? 'pre-hello', verifiedRole: p?.role, presence: p, isOwner };
  state.sockets.push(asWs(ws));
}

// What the room persisted for this socket (the attachment's presence).
function storedPresence(ws: FakeSocket): ParticipantPresence | null {
  return (ws.attachment as { presence: ParticipantPresence | null }).presence;
}

function sendFrame(room: DocumentRoom, ws: FakeSocket, frame: unknown): void {
  room.webSocketMessage(asWs(ws), JSON.stringify(frame));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DocumentRoom /broadcast endpoint', () => {
  it('fans the op out to every connected session with from: "system"', async () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    const b = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    seedSession(state, b, presence('p-b', 'view'));

    const res = await room.fetch(
      new Request('https://room/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: { kind: 'share-revoked', code: 'CODE-123' } }),
      }),
    );

    expect(res.status).toBe(204);
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(1);
    // The `from: 'system'` stamp is what lets the live editor
    // distinguish a server-originated op from a peer's op; pinning it
    // here means a future refactor can't silently drop it.
    const aPayload = JSON.parse(a.sent[0]!);
    expect(aPayload.from).toBe('system');
    expect(aPayload.kind).toBe('op');
    expect(aPayload.op).toEqual({ kind: 'share-revoked', code: 'CODE-123' });
  });

  it('sequences an `ordered` system op into the catch-up log (docs/specs/012-collaboration/qa-board.md)', async () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    seedSession(state, a, presence('p-a', 'view'));
    const op = { kind: 'qa', tabId: 't', elementId: 'b', notes: [], rev: 1 };
    await room.fetch(
      new Request('https://room/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered: true, op }),
      }),
    );
    const sent = JSON.parse(a.sent[0]!);
    expect(sent).toMatchObject({ kind: 'op', from: 'system', op, seq: 1 });
    expect(typeof sent.epoch).toBe('string');
    // A fresh client asking to catch up gets it replayed.
    const b = makeSocket();
    seedSession(state, b, presence('p-b', 'view'));
    room.webSocketMessage(b as never, JSON.stringify({ kind: 'sync', epoch: null, lastSeq: 0 }));
    const catchup = b.sent.map((m) => JSON.parse(m)).find((m) => Array.isArray(m.ops)) as {
      ops: { from: string; seq: number; op: unknown }[];
    };
    expect(catchup.ops).toEqual([{ from: 'system', seq: 1, op }]);
  });

  it('returns 400 when the body is not valid JSON', async () => {
    const { room } = newRoom();
    const res = await room.fetch(
      new Request('https://room/broadcast', { method: 'POST', body: 'not json at all' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when the body parses but is missing the op field', async () => {
    const { room } = newRoom();
    const res = await room.fetch(
      new Request('https://room/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ somethingElse: true }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('sheds a dead socket rate entry when its send throws', () => {
    const { room, state } = newRoom();
    const live = makeSocket();
    const dead = makeSocket();
    dead.failSend = true;
    seedSession(state, live, presence('p-live'));
    seedSession(state, dead, presence('p-dead'));
    // Simulate an in-flight rate window for the dead peer: the entry must
    // not leak once its socket dies. (Under hibernation the connected set
    // itself is runtime-managed — getWebSockets() prunes closed sockets —
    // so the rate map is the only room-owned state left to reap.)
    room.opRates.set(asWs(dead), { count: 3, windowStart: Date.now() });

    room.broadcastSystemOp({ kind: 'share-revoked', code: 'X' });

    expect(live.sent).toHaveLength(1);
    expect(room.opRates.has(asWs(dead))).toBe(false);
  });
});

describe('DocumentRoom presence broadcast', () => {
  // Each client must NOT receive its own entry: the broadcast presence id is a
  // fresh server-random (docs/specs/015-api/public-api-and-tokens.md §6), so a client can't recognise its own entry
  // by id to filter it — including it makes the user show up as a participant
  // twice (once here, once from the local self entry the editor always renders).
  it('sends each client the roster minus its own entry', () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    const b = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    seedSession(state, b, presence('p-b', 'view'));

    room.broadcastPresence();

    const ids = (s: FakeSocket) =>
      (
        JSON.parse(s.sent.at(-1)!) as { kind: string; participants: ParticipantPresence[] }
      ).participants.map((p) => p.id);
    expect(ids(a)).toEqual(['p-b']);
    expect(ids(b)).toEqual(['p-a']);
  });

  it('omits sessions that have not said hello yet (null presence)', () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    const b = makeSocket();
    seedSession(state, a, presence('p-a'));
    // Connected but no hello yet: invisible to peers and shows no one itself.
    seedSession(state, b, null);

    room.broadcastPresence();

    const aFrame = JSON.parse(a.sent.at(-1)!) as { participants: ParticipantPresence[] };
    const bFrame = JSON.parse(b.sent.at(-1)!) as { participants: ParticipantPresence[] };
    expect(aFrame.participants).toEqual([]);
    expect(bFrame.participants.map((p) => p.id)).toEqual(['p-a']);
  });

  it('excludes a departing socket from the roster it announces on close', () => {
    const { room, state } = newRoom();
    const leaver = makeSocket();
    const stayer = makeSocket();
    seedSession(state, leaver, presence('p-leaver', 'edit'));
    seedSession(state, stayer, presence('p-stayer', 'edit'));
    room.opRates.set(asWs(leaver), { count: 1, windowStart: Date.now() });

    // The runtime may not have pruned the closing socket from
    // getWebSockets() yet when webSocketClose fires (the fake never
    // prunes), so the room must exclude it explicitly.
    room.webSocketClose(asWs(leaver));

    const frame = JSON.parse(stayer.sent.at(-1)!) as { participants: ParticipantPresence[] };
    expect(frame.participants).toEqual([]);
    // The close handler is also the rate-map cleanup point.
    expect(room.opRates.has(asWs(leaver))).toBe(false);
  });
});

describe('DocumentRoom non-WebSocket upgrades', () => {
  it('rejects plain HTTP requests on the WS path with 426', async () => {
    const { room } = newRoom();
    const res = await room.fetch(new Request('https://room/ws'));
    expect(res.status).toBe(426);
  });
});

describe('DocumentRoom hello frame role forcing', () => {
  it('overrides whatever role the client claims with the server-resolved role', () => {
    const { room } = newRoom();
    const ws = makeSocket();
    // The api worker forwards X-Verified-Role='view' when the visitor
    // joined with a view-only share code; the DO reads it at the upgrade,
    // pins it in the socket attachment, and stamps it onto presence
    // regardless of what the client claims below.
    room.acceptSession(asWs(ws), 'view');

    // Client tries to claim 'edit' (the spoof attempt that justified
    // the role-forcing in the first place).
    sendFrame(room, ws, {
      kind: 'hello',
      participant: { id: 'lying-peer', name: 'L', color: '#000', role: 'edit' },
    });

    const stored = storedPresence(ws);
    expect(stored?.role).toBe('view');
    // The client-claimed id is replaced by a server-assigned ephemeral id
    // (docs/specs/015-api/public-api-and-tokens.md §6), so the spoofed value never reaches presence.
    expect(stored?.id).not.toBe('lying-peer');
    expect(stored?.id).toBeTruthy();
  });

  it('tells a joining socket the document format number', () => {
    // docs/specs/016-platform/new-version-prompt.md: a deploy restarts the room, so every editor
    // hears the server's number again on reconnect.
    const { room } = newRoom();
    const ws = makeSocket();
    room.acceptSession(asWs(ws), 'edit');
    sendFrame(room, ws, { kind: 'hello', participant: { id: 'p', name: 'P', color: '#000' } });
    const sent = ws.sent.map((f) => JSON.parse(f) as Record<string, unknown>);
    expect(sent).toContainEqual({ kind: 'format', format: DOCUMENT_FORMAT });
  });

  it('adds the live build id when the deploy set one', () => {
    // docs/specs/016-platform/stale-builds.md "Knowing which build is live".
    const room = new DocumentRoom(
      makeState() as unknown as DurableObjectState,
      { BUILD_ID: 'abc123' } as unknown as Env,
    );
    const ws = makeSocket();
    room.acceptSession(asWs(ws), 'edit');
    sendFrame(room, ws, { kind: 'hello', participant: { id: 'p', name: 'P', color: '#000' } });
    const sent = ws.sent.map((f) => JSON.parse(f) as Record<string, unknown>);
    expect(sent).toContainEqual({ kind: 'format', format: DOCUMENT_FORMAT, build: 'abc123' });
  });

  it('replaces the client participant id with a server-assigned ephemeral id', () => {
    const { room } = newRoom();
    const ws = makeSocket();
    // The DO assigns each session a fresh ephemeral presence id (docs/specs/015-api/public-api-and-tokens.md §6):
    // the real owner id is never broadcast, and a client can't impersonate
    // another peer because its claimed id is discarded.
    room.acceptSession(asWs(ws), 'edit');

    sendFrame(room, ws, {
      kind: 'hello',
      participant: { id: 'victim-peer-id', name: 'L', color: '#000' },
    });

    const stored = storedPresence(ws);
    expect(stored?.id).not.toBe('victim-peer-id');
    expect(stored?.id).toBeTruthy();
  });

  it('leaves role undefined when the upgrade carried no X-Verified-Role', () => {
    const { room } = newRoom();
    const ws = makeSocket();
    room.acceptSession(asWs(ws));

    sendFrame(room, ws, {
      kind: 'hello',
      participant: { id: 'p', name: 'P', color: '#fff', role: 'edit' },
    });

    const stored = storedPresence(ws);
    // Owner sessions (no share code, just X-Owner-Id match) intentionally
    // arrive with no verified role; the editor surfaces no peer badge
    // for them rather than defaulting to 'edit', so this null case
    // matters and is the reason `role` is optional on presence.
    expect(stored?.role).toBeUndefined();
  });

  it('clamps an oversized hello name so the attachment stays under the size limit', () => {
    const { room } = newRoom();
    const ws = makeSocket();
    room.acceptSession(asWs(ws), 'edit');

    // serializeAttachment enforces a small per-socket limit, so the room
    // length-clamps hello fields before persisting them. Without the
    // clamp a hostile hello could make the persist throw.
    sendFrame(room, ws, {
      kind: 'hello',
      participant: { id: 'p', name: 'x'.repeat(5000), color: '#fff' },
    });

    const stored = storedPresence(ws);
    expect(stored?.name).toHaveLength(120);
  });

  it('forwards op messages to peers but never echoes back to the sender', () => {
    const { room } = newRoom();
    const sender = makeSocket();
    const peer = makeSocket();
    room.acceptSession(asWs(sender), 'edit');
    room.acceptSession(asWs(peer), 'view');

    // Sender introduces itself; the peer must already be in the connected
    // set (acceptSession admits it with a null presence) so the op handler
    // can find a recipient. The hello also registers `sender` properly so
    // the op handler can derive a non-null `from`.
    sendFrame(room, sender, {
      kind: 'hello',
      participant: { id: 'sender', name: 'S', color: '#abc' },
    });
    sendFrame(room, peer, {
      kind: 'hello',
      participant: { id: 'peer', name: 'P', color: '#def' },
    });

    // Reset captured frames AFTER the hello presence broadcasts so the
    // op assertions below don't conflate the two payload kinds.
    sender.sent.length = 0;
    peer.sent.length = 0;

    sendFrame(room, sender, { kind: 'op', op: { kind: 'cursor', tabId: 't', x: 1, y: 2 } });

    // Sender must not see its own op (echo would re-render its cursor
    // for itself, and worse, fight with whatever local-first state the
    // editor already applied optimistically).
    expect(sender.sent).toHaveLength(0);
    expect(peer.sent).toHaveLength(1);
    const payload = JSON.parse(peer.sent[0]!);
    expect(payload.kind).toBe('op');
    // `from` is the sender's server-assigned ephemeral id (not the claimed
    // 'sender'), so peers still get a stable per-session attribution key.
    const senderId = storedPresence(sender)?.id;
    expect(payload.from).toBe(senderId);
    expect(payload.from).not.toBe('sender');
  });

  it('ignores op messages from a session that never sent hello', () => {
    const { room } = newRoom();
    const ws = makeSocket();
    const peer = makeSocket();
    room.acceptSession(asWs(ws), 'edit');
    room.acceptSession(asWs(peer), 'edit');

    sendFrame(room, ws, { kind: 'op', op: { kind: 'cursor', tabId: 't', x: 0, y: 0 } });

    // Without a hello, the sender has no participant id, so the op
    // can't be attributed and gets dropped silently. Critical because
    // otherwise a malformed early frame could broadcast under a null
    // `from` and confuse every peer's presence-keyed handler.
    expect(peer.sent).toHaveLength(0);
  });
});

describe('DocumentRoom op-role enforcement', () => {
  // Drive a fully-connected session (hello sent) at a given verified
  // role, returning a `sendOp` that pushes an op frame from it.
  function connect(room: DocumentRoom, id: string, role?: 'edit' | 'view') {
    const ws = makeSocket();
    room.acceptSession(asWs(ws), role);
    sendFrame(room, ws, { kind: 'hello', participant: { id, name: id, color: '#000' } });
    return {
      ws,
      sendOp: () => sendFrame(room, ws, { kind: 'op', op: { kind: 'move', id, x: 1 } }),
    };
  }

  function opsReceived(ws: FakeSocket): unknown[] {
    return ws.sent.map((s) => JSON.parse(s)).filter((m) => m.kind === 'op');
  }

  it('relays an op from an edit-role session to peers', () => {
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const viewer = connect(room, 'viewer', 'view');
    editor.ws.sent.length = 0;
    viewer.ws.sent.length = 0;

    editor.sendOp();

    expect(opsReceived(viewer.ws)).toHaveLength(1);
  });

  it('drops an op from a view-role session so it never reaches peers', () => {
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const viewer = connect(room, 'viewer', 'view');
    editor.ws.sent.length = 0;
    viewer.ws.sent.length = 0;

    // A view-only visitor tries to inject an edit op. Viewers can read
    // live ops but must not write to peers' canvases.
    viewer.sendOp();

    expect(opsReceived(editor.ws)).toHaveLength(0);
  });

  it('drops ops from a session the upgrade admitted with no role', () => {
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const noRole = connect(room, 'no-role', undefined);
    editor.ws.sent.length = 0;

    noRole.sendOp();

    expect(opsReceived(editor.ws)).toHaveLength(0);
  });

  // Presence ops are ephemeral (cursor / selection / tab-focus / laser /
  // avatar) and must relay from a view-role session too, otherwise a viewer is
  // invisible to peers — no cursor, no selection highlight, no "which tab
  // they're on", and no walking character (docs/specs/008-canvas/avatar-mode.md).
  // Driven off the real set, so a presence kind added to the gate joins this
  // loop automatically instead of shipping untested. `avatar-push` is the one
  // exclusion: it is ADDRESSED rather than broadcast (see its own tests just
  // below), so "a peer received it" is not the right assertion for it.
  const ADDRESSED_PRESENCE_KINDS = ['avatar-push'];
  // `drag-preview` is presence an editor alone may send: a viewer's would make others' elements appear
  // to move (docs/specs/008-canvas/drag-preview.md). Its own test below pins both halves.
  const EDITOR_ONLY_PRESENCE_KINDS = ['drag-preview'];
  // `poll-answer` relays only once the room accepts it for a running poll, under the key the room chose
  // (docs/specs/012-collaboration/vote-integrity.md); its own tests below and in the live poll block pin that.
  const ROOM_DECIDED_PRESENCE_KINDS = ['poll-answer'];
  for (const kind of [...PRESENCE_OP_KINDS].filter(
    (k) =>
      !ADDRESSED_PRESENCE_KINDS.includes(k) &&
      !EDITOR_ONLY_PRESENCE_KINDS.includes(k) &&
      !ROOM_DECIDED_PRESENCE_KINDS.includes(k),
  )) {
    it(`relays a '${kind}' presence op from a view-role session`, () => {
      const { room } = newRoom();
      const editor = connect(room, 'editor', 'edit');
      const viewer = connect(room, 'viewer', 'view');
      editor.ws.sent.length = 0;

      sendFrame(room, viewer.ws, { kind: 'op', op: { kind, tabId: 't', x: 1, y: 2 } });

      expect(opsReceived(editor.ws)).toHaveLength(1);
    });
  }

  // Avatar-mode shove (docs/specs/008-canvas/avatar-mode.md). It is ADDRESSED, not broadcast: the room
  // delivers it to the named presence and nobody else. That routing has to live
  // here because presence ids are server-minted (docs/specs/015-api/public-api-and-tokens.md §6) — a client never
  // learns its own, so it cannot recognise a push aimed at it, and an earlier
  // build that made the receiver check `targetId` against its local id dropped
  // every real push on the floor.
  it('delivers an avatar-push only to the addressed session', () => {
    const { room } = newRoom();
    const pusher = connect(room, 'pusher', 'edit');
    const target = connect(room, 'target', 'edit');
    const bystander = connect(room, 'bystander', 'edit');
    for (const c of [pusher, target, bystander]) c.ws.sent.length = 0;

    const targetId = storedPresence(target.ws)?.id;
    sendFrame(room, pusher.ws, {
      kind: 'op',
      op: { kind: 'avatar-push', tabId: 't', targetId, dx: 1, dy: 0 },
    });

    expect(opsReceived(target.ws)).toHaveLength(1);
    expect(opsReceived(bystander.ws)).toHaveLength(0);
    expect(opsReceived(pusher.ws)).toHaveLength(0);
  });

  it('drops an avatar-push aimed at nobody rather than broadcasting it', () => {
    const { room } = newRoom();
    const pusher = connect(room, 'pusher', 'edit');
    const peer = connect(room, 'peer', 'edit');
    peer.ws.sent.length = 0;

    sendFrame(room, pusher.ws, {
      kind: 'op',
      op: { kind: 'avatar-push', tabId: 't', targetId: 'nobody-here', dx: 1, dy: 0 },
    });

    expect(opsReceived(peer.ws)).toHaveLength(0);
  });

  // A shove relays from a view-role session too: an audience member walking a
  // document someone linked them to can push back.
  // Keeps the exclusion above honest: if an addressed kind is ever removed from
  // the gate, or renamed, this fails rather than silently excluding nothing.
  it('excludes only kinds that really are in the presence set', () => {
    expect(ADDRESSED_PRESENCE_KINDS.filter((k) => !isPresenceKind(k))).toEqual([]);
    expect(EDITOR_ONLY_PRESENCE_KINDS.filter((k) => !isPresenceKind(k))).toEqual([]);
  });

  // The dangerous direction. Everything in PRESENCE_OP_KINDS is relayed from a
  // view-role session without an edit check, so a MUTATION kind landing in that
  // set silently hands every read-only visitor a write path into the document.
  // Both lists are imported from the schema package now, so this compares two
  // lists instead of restating one — it used to hand-list the mutation kinds
  // because the only definition was a type union that could not be enumerated
  // at runtime.
  it('lets no document-mutating op kind into the presence set', () => {
    expect(MUTATION_OP_KINDS.filter(isPresenceKind)).toEqual([]);
  });

  it('lets no system-only op kind into the presence set either', () => {
    // A system op reaching the relay from a client socket is a forgery; being
    // ALSO classified as presence would mean no role check stood in its way.
    expect(SYSTEM_OP_KINDS.filter(isPresenceKind)).toEqual([]);
  });

  // `tab-focus` is deliberately both: it rides the op channel like a mutation
  // but changes nothing in the document, so a viewer may send it. Pinned so the
  // exception stays a decision rather than an accident.
  it('keeps tab-focus on the presence side of the gate', () => {
    expect(isPresenceKind('tab-focus')).toBe(true);
  });

  // The OTHER direction, which is how `viewport` slipped through: only the
  // dangerous side was guarded, so a kind whose own wire contract calls it
  // ephemeral presence could sit outside this set indefinitely and be treated
  // as an ordered mutation by the fall-through.
  //
  // That direction cannot be checked from a list kept here — restating the nine
  // presence kinds would only prove the restatement agrees. What catches it is
  // the editor's own vocabulary: every op kind it sends or handles must appear
  // in one of the three schema lists, checked in
  // apps/live/app/document/[id]/room-op-vocabulary.test.ts. What this file can
  // still pin is that the gate reads the schema's list at all.
  it('classifies every op kind in the shared vocabulary, and only those', () => {
    const classified = [...PRESENCE_OP_KINDS, ...MUTATION_OP_KINDS, ...SYSTEM_OP_KINDS];
    expect([...classified].sort()).toEqual([...ROOM_OP_KINDS].sort());
    // No kind may be two things at once — which of the three it is decides its
    // ordering, its role gate, and whether a client may send it at all.
    expect(new Set(classified).size).toBe(classified.length);
  });

  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md). Two properties, and both were broken while
  // `viewport` sat outside the presence set.
  it('relays a viewport from a view-role session, unordered and unlogged', () => {
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const viewer = connect(room, 'viewer', 'view');
    editor.ws.sent.length = 0;

    sendFrame(room, viewer.ws, {
      kind: 'op',
      op: { kind: 'viewport', tabId: 't', pan: { x: 10, y: 20 }, zoom: 1.5 },
    });

    // Followable at view role: the role gate drops any non-presence op from a
    // viewer, so this arrived nowhere — on a link whose whole audience is the
    // people most likely to want following.
    const received = opsReceived(editor.ws);
    expect(received).toHaveLength(1);
    // Unordered: a `seq` would put it in the ordered stream, and at 10 Hz it
    // would push every real mutation out of the 256-slot catch-up log within
    // half a minute of somebody scrolling, forcing the next reconnecting peer
    // into a full D1 re-hydrate.
    expect(received[0]).not.toHaveProperty('seq');
  });

  // docs/specs/007-editor/article-pages.md "Collaboration": a writer's caret is presence. Sent at
  // cursor rates while someone types, so a `seq` would flood the catch-up log with carets.
  it("relays a writer's article caret unordered, and its null too", () => {
    const { room } = newRoom();
    const writer = connect(room, 'writer', 'edit');
    const other = connect(room, 'other', 'edit');
    other.ws.sent.length = 0;

    sendFrame(room, writer.ws, {
      kind: 'op',
      op: { kind: 'article-caret', tabId: 't', flow: 'f', blockId: 'b', offset: 3 },
    });
    sendFrame(room, writer.ws, {
      kind: 'op',
      op: { kind: 'article-caret', tabId: 't', flow: null },
    });

    const received = opsReceived(other.ws);
    expect(received).toHaveLength(2);
    for (const msg of received) expect(msg).not.toHaveProperty('seq');
  });

  // docs/specs/008-canvas/drag-preview.md: an editor's live drag relays unordered, and a viewer's never
  // relays at all — a viewer must not make others' elements appear to move.
  it("relays an editor's drag preview unordered, and drops a viewer's", () => {
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const viewer = connect(room, 'viewer', 'view');
    const other = connect(room, 'other', 'edit');
    other.ws.sent.length = 0;
    const op = { kind: 'drag-preview', tabId: 't', patches: [{ id: 'a', x: 10, y: 20 }] };

    sendFrame(room, viewer.ws, { kind: 'op', op });
    expect(opsReceived(other.ws)).toHaveLength(0);

    sendFrame(room, editor.ws, { kind: 'op', op });
    const received = opsReceived(other.ws);
    expect(received).toHaveLength(1);
    expect(received[0]).not.toHaveProperty('seq');
  });

  it('keeps viewports out of the catch-up log entirely', () => {
    // The expensive half. Every ordered op costs a `seq` and a slot in the
    // 256-entry log, and at 10 Hz a scrolling editor filled the whole thing
    // with camera positions in ~26s, pushing `floor` past every real mutation
    // so the next reconnecting peer got `resync` and re-hydrated from D1.
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    sendFrame(room, editor.ws, {
      kind: 'op',
      op: { kind: 'el', tabId: 't', op: { kind: 'remove', id: 'a' } },
    });
    for (let i = 0; i < 5; i++) {
      sendFrame(room, editor.ws, {
        kind: 'op',
        op: { kind: 'viewport', tabId: 't', pan: { x: i, y: i }, zoom: 1 },
      });
    }

    // A peer that has seen nothing asks for the delta. It should be the one
    // real mutation, with the viewports consuming neither a seq nor a slot.
    const back = connect(room, 'back', 'edit');
    sendFrame(room, back.ws, { kind: 'sync', epoch: room.epoch, lastSeq: 0 });
    type Catchup = { kind: string; resync: boolean; seq: number; ops: { op: { kind: string } }[] };
    const catchup = back.ws.sent
      .map((s) => JSON.parse(s) as Catchup)
      .filter((m) => m.kind === 'catchup')
      .at(-1)!;
    expect(catchup.resync).toBe(false);
    expect(catchup.seq).toBe(1);
    expect(catchup.ops.map((o) => o.op.kind)).toEqual(['el']);
  });

  it('relays an avatar-push from a view-role session', () => {
    const { room } = newRoom();
    const viewer = connect(room, 'viewer', 'view');
    const target = connect(room, 'target', 'edit');
    target.ws.sent.length = 0;

    sendFrame(room, viewer.ws, {
      kind: 'op',
      op: {
        kind: 'avatar-push',
        tabId: 't',
        targetId: storedPresence(target.ws)?.id,
        dx: 0,
        dy: 1,
      },
    });

    expect(opsReceived(target.ws)).toHaveLength(1);
  });

  // Live poll (docs/specs/012-collaboration/live-poll.md): a presenter polling an audience is the main use,
  // and audiences sit on view links — so answering must work at view role
  // while starting / ending a poll stays behind the edit gate.
  it('relays a poll answer from a view-role session', async () => {
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const viewer = connect(room, 'viewer', 'view');
    sendFrame(room, editor.ws, {
      kind: 'op',
      op: {
        kind: 'poll-start',
        poll: {
          id: 'p1',
          question: 'Ok?',
          style: 'text',
          options: [],
          startedAt: 1,
          hostKey: 'h',
        },
      },
    });
    editor.ws.sent.length = 0;

    sendFrame(room, viewer.ws, {
      kind: 'op',
      op: { kind: 'poll-answer', pollId: 'p1', value: 'Yes', key: 'vk', proof: 'secret' },
    });
    await room.pollAnswers;

    expect(opsReceived(editor.ws)).toHaveLength(1);
  });

  for (const kind of ['poll-start', 'poll-end'] as const) {
    it(`drops '${kind}' from a view-role session`, () => {
      const { room } = newRoom();
      const editor = connect(room, 'editor', 'edit');
      const viewer = connect(room, 'viewer', 'view');
      editor.ws.sent.length = 0;

      // An audience member can answer, but can't open a poll on the room
      // or tear down the host's.
      sendFrame(room, viewer.ws, { kind: 'op', op: { kind, pollId: 'p1' } });

      expect(opsReceived(editor.ws)).toHaveLength(0);
    });
  }

  it('still drops a mutation op from a view-role session', () => {
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const viewer = connect(room, 'viewer', 'view');
    editor.ws.sent.length = 0;

    // A view-only visitor must not inject canvas edits into peers.
    sendFrame(room, viewer.ws, { kind: 'op', op: { kind: 'tab', tabId: 't', tab: {} } });

    expect(opsReceived(editor.ws)).toHaveLength(0);
  });

  it("never relays 'share-revoked' from a client socket, even at edit role", () => {
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const victim = connect(room, 'victim', 'view');
    victim.ws.sent.length = 0;

    // share-revoked is system-only (worker /broadcast). An edit-role peer
    // forging it with the code from their own URL would force-redirect
    // every collaborator out of the session.
    sendFrame(room, editor.ws, { kind: 'op', op: { kind: 'share-revoked', code: 'CODE-1' } });

    expect(opsReceived(victim.ws)).toHaveLength(0);
  });

  it("never relays 'document-trashed' from a client socket, even at edit role", () => {
    // A forged one would end everyone's session with the deleted state.
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const victim = connect(room, 'victim', 'view');
    victim.ws.sent.length = 0;

    sendFrame(room, editor.ws, { kind: 'op', op: { kind: 'document-trashed' } });

    expect(opsReceived(victim.ws)).toHaveLength(0);
  });

  it('drops frames over the size cap before they fan out', () => {
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const peer = connect(room, 'peer', 'edit');
    peer.ws.sent.length = 0;

    // Ops re-broadcast opaquely to every peer, so an uncapped frame lets
    // one socket fan a multi-MB payload out to the whole room.
    room.webSocketMessage(
      asWs(editor.ws),
      JSON.stringify({
        kind: 'op',
        op: { kind: 'cursor', tabId: 'x'.repeat(300 * 1024), x: 1, y: 2 },
      }),
    );

    expect(opsReceived(peer.ws)).toHaveLength(0);
  });

  it('caps the per-session frame rate inside one sliding window', () => {
    // Freeze the clock so every frame lands in a single 1s window and the
    // over-cap count is deterministic.
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { room } = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const peer = connect(room, 'peer', 'edit');
    peer.ws.sent.length = 0;

    // The hello above consumed 1 slot of the 240-frame window, so of 300
    // ops only 239 relay; the rest silently drop (no disconnect).
    for (let i = 0; i < 300; i++) {
      sendFrame(room, editor.ws, { kind: 'op', op: { kind: 'cursor', tabId: 't', x: i, y: 0 } });
    }

    expect(opsReceived(peer.ws)).toHaveLength(239);
  });
});

describe('DocumentRoom tab-focus presence echo', () => {
  // A late joiner only gets the presence list, never the tab-focus ops
  // that fired before they connected. So the room must remember each
  // session's current tab and echo it in presence, or joiners default
  // existing peers to the first tab until they next switch (the bug).
  it("remembers a session's tab-focus and echoes it in later presence frames", () => {
    const { room } = newRoom();
    const a = makeSocket();
    room.acceptSession(asWs(a), 'edit');
    sendFrame(room, a, { kind: 'hello', participant: { id: 'p-a', name: 'A', color: '#abc' } });
    sendFrame(room, a, { kind: 'op', op: { kind: 'tab-focus', tabId: 'tab-2' } });

    // Persisted into the session ATTACHMENT (not memory) so future
    // broadcasts still carry it after a hibernation cycle.
    expect(storedPresence(a)?.tabId).toBe('tab-2');

    // A second peer joining triggers a presence broadcast; the frame it
    // receives must report A on tab-2, not the first-tab default.
    const b = makeSocket();
    room.acceptSession(asWs(b), 'edit');
    sendFrame(room, b, { kind: 'hello', participant: { id: 'p-b', name: 'B', color: '#def' } });
    // A's broadcast id is its server-assigned ephemeral id (docs/specs/015-api/public-api-and-tokens.md §6), not
    // the claimed 'p-a' — find its row by the stored id.
    const aId = storedPresence(a)?.id;
    const presenceFrames = b.sent.map((s) => JSON.parse(s)).filter((m) => m.kind === 'presence');
    const aRow = presenceFrames.at(-1)!.participants.find((p: { id: string }) => p.id === aId);
    expect(aRow?.tabId).toBe('tab-2');
  });
});

describe('DocumentRoom hibernation survival', () => {
  // The whole point of the hibernation migration: the runtime may evict
  // the DO between messages and re-construct it on the next frame. All
  // per-session state (ephemeral id, verified role, presence incl. the
  // remembered tab) must come back off the socket attachments; only the
  // rate window resets. Simulated here by building a SECOND DocumentRoom
  // over the same state + sockets — exactly what a wake-from-hibernation
  // does — and asserting behaviour is unchanged.
  it('keeps identity, role, and tab across a simulated eviction', () => {
    const state = makeState();
    const before = new DocumentRoom(state as unknown as DurableObjectState);
    const viewer = makeSocket();
    const editor = makeSocket();
    before.acceptSession(asWs(viewer), 'view');
    before.acceptSession(asWs(editor), 'edit');
    sendFrame(before, viewer, {
      kind: 'hello',
      participant: { id: 'v', name: 'V', color: '#111' },
    });
    sendFrame(before, editor, {
      kind: 'hello',
      participant: { id: 'e', name: 'E', color: '#222' },
    });
    sendFrame(before, editor, { kind: 'op', op: { kind: 'tab-focus', tabId: 'tab-9' } });
    const editorId = storedPresence(editor)?.id;

    // --- hibernation: in-memory state is gone, attachments survive ---
    const after = new DocumentRoom(state as unknown as DurableObjectState);
    viewer.sent.length = 0;
    editor.sent.length = 0;

    // The viewer still can't inject a mutation op (verified role survived) ...
    sendFrame(after, viewer, { kind: 'op', op: { kind: 'tab', tabId: 't', tab: {} } });
    expect(editor.sent).toHaveLength(0);
    // ... the editor still relays under the SAME ephemeral id ...
    sendFrame(after, editor, { kind: 'op', op: { kind: 'cursor', tabId: 't', x: 1, y: 2 } });
    const relayed = JSON.parse(viewer.sent.at(-1)!);
    expect(relayed.from).toBe(editorId);
    // ... and the remembered tab still reaches late joiners via presence.
    const joiner = makeSocket();
    after.acceptSession(asWs(joiner), 'edit');
    sendFrame(after, joiner, { kind: 'hello', participant: { id: 'j', name: 'J', color: '#333' } });
    // The presence frame by kind, not by position: a hello is also answered
    // with the facilitator state (docs/specs/012-collaboration/facilitator.md), so "the last frame" is not it.
    const frame = joiner.sent
      .map((raw) => JSON.parse(raw) as { kind: string; participants?: ParticipantPresence[] })
      .findLast((f) => f.kind === 'presence')!;
    expect(frame.participants!.find((p) => p.id === editorId)?.tabId).toBe('tab-9');
  });
});

describe('DocumentRoom op ordering + reconnect catch-up (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1)', () => {
  // Drive an established edit-role session and expose helpers to push ops
  // and read the frames a peer receives.
  function editorAndPeer(room: DocumentRoom) {
    const editor = makeSocket();
    const peer = makeSocket();
    room.acceptSession(asWs(editor), 'edit');
    room.acceptSession(asWs(peer), 'edit');
    sendFrame(room, editor, { kind: 'hello', participant: { id: 'e', name: 'E', color: '#000' } });
    sendFrame(room, peer, { kind: 'hello', participant: { id: 'p', name: 'P', color: '#111' } });
    editor.sent.length = 0;
    peer.sent.length = 0;
    return { editor, peer };
  }
  const opFrames = (ws: FakeSocket) =>
    ws.sent.map((s) => JSON.parse(s)).filter((m) => m.kind === 'op');
  const lastCatchup = (ws: FakeSocket) =>
    ws.sent
      .map((s) => JSON.parse(s))
      .filter((m) => m.kind === 'catchup')
      .at(-1);

  it('stamps a monotonic seq + epoch on mutation ops as it relays them', () => {
    const { room } = newRoom();
    const { editor, peer } = editorAndPeer(room);

    sendFrame(room, editor, {
      kind: 'op',
      op: { kind: 'el', tabId: 't', op: { kind: 'remove', id: 'a' } },
    });
    sendFrame(room, editor, {
      kind: 'op',
      op: { kind: 'el', tabId: 't', op: { kind: 'remove', id: 'b' } },
    });

    const received = opFrames(peer);
    expect(received.map((f) => f.seq)).toEqual([1, 2]);
    expect(received[0].epoch).toBe(room.epoch);
    expect(received[1].epoch).toBe(room.epoch);
  });

  it('tells the sender the seq its own op took, and a joiner where the stream stands', () => {
    // The relay skips the sender, so without this a client only learned seqs
    // from other people's ops and a reconnect replayed its own `vote` deltas
    // back at it, counting each dot twice.
    const { room } = newRoom();
    const { editor, peer } = editorAndPeer(room);
    sendFrame(room, editor, {
      kind: 'op',
      op: { kind: 'el', tabId: 't', op: { kind: 'remove', id: 'a' } },
    });
    const cursors = (ws: FakeSocket) =>
      ws.sent.map((s) => JSON.parse(s)).filter((m) => m.kind === 'cursor');
    expect(cursors(editor)).toEqual([{ kind: 'cursor', epoch: room.epoch, seq: 1 }]);
    // Peers learn the seq from the op itself, not a cursor.
    expect(cursors(peer)).toEqual([]);

    const late = makeSocket();
    room.acceptSession(asWs(late), 'view');
    sendFrame(room, late, { kind: 'hello', participant: { id: 'l', name: 'L', color: '#333' } });
    expect(cursors(late)).toEqual([{ kind: 'cursor', epoch: room.epoch, seq: 1 }]);
  });

  it('never stamps a seq on an ephemeral presence op', () => {
    const { room } = newRoom();
    const { editor, peer } = editorAndPeer(room);

    sendFrame(room, editor, { kind: 'op', op: { kind: 'cursor', tabId: 't', x: 1, y: 2 } });

    const frame = opFrames(peer)[0];
    expect(frame.seq).toBeUndefined();
    expect(frame.epoch).toBeUndefined();
    // A presence op must not advance the mutation sequence.
    expect(room.seq).toBe(0);
  });

  it('replays the delta a same-epoch client missed on reconnect', () => {
    const { room } = newRoom();
    const { editor } = editorAndPeer(room);
    // Three mutations land (seq 1..3).
    for (const id of ['a', 'b', 'c']) {
      sendFrame(room, editor, {
        kind: 'op',
        op: { kind: 'el', tabId: 't', op: { kind: 'remove', id } },
      });
    }
    // A peer that had applied up to seq 1 reconnects and asks for the rest.
    const back = makeSocket();
    room.acceptSession(asWs(back), 'edit');
    sendFrame(room, back, { kind: 'hello', participant: { id: 'b2', name: 'B', color: '#222' } });
    back.sent.length = 0;

    sendFrame(room, back, { kind: 'sync', epoch: room.epoch, lastSeq: 1 });

    const catchup = lastCatchup(back);
    expect(catchup.resync).toBe(false);
    expect(catchup.seq).toBe(3);
    expect(catchup.ops.map((o: { seq: number }) => o.seq)).toEqual([2, 3]);
  });

  it('returns an empty non-resync delta when the client is already current', () => {
    const { room } = newRoom();
    const { editor } = editorAndPeer(room);
    sendFrame(room, editor, {
      kind: 'op',
      op: { kind: 'el', tabId: 't', op: { kind: 'remove', id: 'a' } },
    });
    editor.sent.length = 0;

    sendFrame(room, editor, { kind: 'sync', epoch: room.epoch, lastSeq: 1 });

    const catchup = lastCatchup(editor);
    expect(catchup.resync).toBe(false);
    expect(catchup.ops).toEqual([]);
  });

  it('replays the whole log (idempotent) for a fresh client with no epoch', () => {
    const { room } = newRoom();
    const { editor } = editorAndPeer(room);
    sendFrame(room, editor, {
      kind: 'op',
      op: { kind: 'el', tabId: 't', op: { kind: 'remove', id: 'a' } },
    });

    const fresh = makeSocket();
    room.acceptSession(asWs(fresh), 'edit');
    sendFrame(room, fresh, { kind: 'hello', participant: { id: 'f', name: 'F', color: '#333' } });
    fresh.sent.length = 0;

    sendFrame(room, fresh, { kind: 'sync', epoch: null, lastSeq: 0 });

    const catchup = lastCatchup(fresh);
    expect(catchup.resync).toBe(false);
    expect(catchup.ops.map((o: { seq: number }) => o.seq)).toEqual([1]);
  });

  it('tells a client from a previous room instance (stale epoch) to re-hydrate', () => {
    const { room } = newRoom();
    const { editor } = editorAndPeer(room);
    sendFrame(room, editor, {
      kind: 'op',
      op: { kind: 'el', tabId: 't', op: { kind: 'remove', id: 'a' } },
    });
    editor.sent.length = 0;

    // A different epoch with prior progress can't be mapped onto our seq.
    sendFrame(room, editor, { kind: 'sync', epoch: 'a-previous-epoch', lastSeq: 5 });

    const catchup = lastCatchup(editor);
    expect(catchup.resync).toBe(true);
    expect(catchup.ops).toEqual([]);
    expect(catchup.epoch).toBe(room.epoch);
  });

  it('re-hydrates a same-epoch client that fell behind the trimmed log floor', () => {
    const { room } = newRoom();
    const { editor } = editorAndPeer(room);
    // Simulate a room whose bounded log has already trimmed its oldest ops:
    // seq has advanced to 300 but the log only still holds 200.. onward.
    // (Driving 300 real ops would hit the per-window rate cap; the floor
    // logic is what's under test here, so seed it directly.)
    room.seq = 300;
    room.opLog = Array.from({ length: 100 }, (_, i) => ({
      seq: 200 + i,
      from: 'e',
      op: { kind: 'el', tabId: 't', op: { kind: 'remove', id: `n${i}` } },
    }));
    editor.sent.length = 0;

    // lastSeq 1 is older than anything still in the log (floor 200) → resync.
    sendFrame(room, editor, { kind: 'sync', epoch: room.epoch, lastSeq: 1 });

    expect(lastCatchup(editor).resync).toBe(true);
  });

  // docs/specs/012-collaboration/resync-without-reload.md: the room used to mint a fresh epoch on every hibernation
  // wake, so any client reconnecting afterwards mismatched and resynced —
  // which cost it a full page reload. Both values now survive the wake.
  it('keeps its epoch and seq across a simulated hibernation wake', async () => {
    const store = new Map<string, unknown>();
    const before = new DocumentRoom(makeState(store) as unknown as DurableObjectState);
    await Promise.resolve();
    const { editor } = editorAndPeer(before);
    sendFrame(before, editor, {
      kind: 'op',
      op: { kind: 'el', tabId: 't', op: { kind: 'remove', id: 'a' } },
    });
    expect(before.seq).toBe(1);

    const after = new DocumentRoom(makeState(store) as unknown as DurableObjectState);
    await Promise.resolve();
    expect(after.epoch).toBe(before.epoch);
    expect(after.seq).toBe(before.seq);
    // The replay buffer is deliberately NOT persisted — it's a cache of
    // ops, not the ordering identity.
    expect(after.opLog).toEqual([]);
  });

  it('sends a caught-up client an empty delta after a wake, not a resync', async () => {
    const store = new Map<string, unknown>();
    const before = new DocumentRoom(makeState(store) as unknown as DurableObjectState);
    await Promise.resolve();
    const seeded = editorAndPeer(before);
    sendFrame(before, seeded.editor, {
      kind: 'op',
      op: { kind: 'el', tabId: 't', op: { kind: 'remove', id: 'a' } },
    });

    const after = new DocumentRoom(makeState(store) as unknown as DurableObjectState);
    await Promise.resolve();
    const { editor } = editorAndPeer(after);
    editor.sent.length = 0;
    // The client reconnects having seen everything the room issued.
    sendFrame(after, editor, { kind: 'sync', epoch: before.epoch, lastSeq: 1 });

    const catchup = lastCatchup(editor);
    expect(catchup.resync).toBe(false);
    expect(catchup.ops).toEqual([]);
  });
});

// ── The facilitator baton (docs/specs/012-collaboration/facilitator.md) ──────────────────────────────────
//
// The room is the only thing that can arbitrate this, so these cover what
// only it can get wrong: who is told, who is told the TOKEN, and the one op
// it can enforce.

const frames = (ws: FakeSocket) => ws.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
const facFrames = (ws: FakeSocket) => frames(ws).filter((f) => f.kind === 'facilitator');

describe('DocumentRoom facilitator', () => {
  it('hands the baton to an editor who claims it, and the token to them alone', () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    const b = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    seedSession(state, b, presence('p-b', 'edit'));

    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });

    // Everybody learns who holds it...
    expect(facFrames(b)).toEqual([
      { kind: 'facilitator', holder: 'p-a', reason: 'claim', by: 'p-a' },
    ]);
    // ...and only the holder is ever sent the token, which is the whole
    // security model: no other socket can present it later.
    const mine = facFrames(a);
    expect(mine.at(-1)).toMatchObject({ holder: 'p-a', token: expect.any(String) });
    expect(JSON.stringify(b.sent)).not.toContain(String(mine.at(-1)!.token));
  });

  it('refuses a view-role claim', () => {
    const { room, state } = newRoom();
    const v = makeSocket();
    seedSession(state, v, presence('p-v', 'view'));
    sendFrame(room, v, { kind: 'facilitator', action: 'claim' });
    expect(facFrames(v)).toEqual([]);
  });

  it('refuses a second editor but lets the owner take it back', () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    const b = makeSocket();
    const o = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    seedSession(state, b, presence('p-b', 'edit'));
    seedSession(state, o, presence('p-o', 'edit'), true);

    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });
    sendFrame(room, b, { kind: 'facilitator', action: 'claim' });
    expect(facFrames(b).filter((f) => f.holder === 'p-b')).toEqual([]);

    sendFrame(room, o, { kind: 'facilitator', action: 'claim' });
    expect(facFrames(b).at(-1)).toMatchObject({ holder: 'p-o', reason: 'claim' });
  });

  it('drops a poll from anybody but the holder, and relays the holder’s', () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    const b = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    seedSession(state, b, presence('p-b', 'edit'));
    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });

    sendFrame(room, b, { kind: 'op', op: { kind: 'poll-start', poll: { id: 'q1' } } });
    expect(frames(a).some((f) => f.kind === 'op')).toBe(false);

    sendFrame(room, a, { kind: 'op', op: { kind: 'poll-start', poll: { id: 'q1' } } });
    expect(frames(b).some((f) => f.kind === 'op')).toBe(true);
  });

  it('leaves every other op alone: the baton is not an edit permission', () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    const b = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    seedSession(state, b, presence('p-b', 'edit'));
    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });

    sendFrame(room, b, { kind: 'op', op: { kind: 'el', tabId: 't', ops: [] } });
    expect(frames(a).some((f) => f.kind === 'op')).toBe(true);
  });

  it('tells a holder their own state frame carries the token', () => {
    // Without it the holder's own client would read "somebody else is
    // facilitating" off its own baton: a client cannot recognise its presence
    // id, so the token is the only thing that says the baton is theirs.
    const { room, state } = newRoom();
    const a = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });
    const token = facFrames(a).at(-1)!.token as string;

    sendFrame(room, a, { kind: 'hello', participant: presence('p-a', 'edit') });
    expect(facFrames(a).at(-1)).toMatchObject({ holder: 'p-a', reason: 'state', token });
  });

  it('announces nothing when a refresh brings the baton home', async () => {
    // A reload is not an event. Everybody's badge still has to follow the new
    // presence id, so the frame goes out — as state, which nobody toasts.
    const { room, state } = newRoom();
    const a = makeSocket();
    const b = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    seedSession(state, b, presence('p-b', 'edit'));
    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });
    const token = facFrames(a).at(-1)!.token as string;
    const before = facFrames(b).length;

    const back = makeSocket();
    seedSession(state, back, presence('p-a2', 'edit'));
    sendFrame(room, back, {
      kind: 'hello',
      participant: presence('p-a2', 'edit'),
      facilitatorToken: token,
    });
    expect(facFrames(b).slice(before)).toEqual([
      { kind: 'facilitator', holder: 'p-a2', reason: 'state' },
    ]);
  });

  it('refuses a token whose grace period ran out while the room slept', async () => {
    // The alarm is what normally releases it, and an alarm needs a room. If
    // the DO was evicted first, the next read is what has to notice.
    const { room, state } = newRoom();
    const a = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });
    const token = facFrames(a).at(-1)!.token as string;
    room.webSocketClose(asWs(a));

    vi.setSystemTime(new Date(Date.now() + 91_000));
    const back = makeSocket();
    seedSession(state, back, presence('p-a2', 'edit'));
    sendFrame(room, back, {
      kind: 'hello',
      participant: presence('p-a2', 'edit'),
      facilitatorToken: token,
    });
    expect(room.facilitator.holder).toBeNull();
    expect(facFrames(back).at(-1)).toMatchObject({ holder: null, reason: 'state' });
    vi.useRealTimers();
  });

  it('stops refusing polls once a lapsed baton is read again', async () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    const b = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    seedSession(state, b, presence('p-b', 'edit'));
    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });
    room.webSocketClose(asWs(a));

    vi.setSystemTime(new Date(Date.now() + 91_000));
    sendFrame(room, b, { kind: 'op', op: { kind: 'poll-start', poll: { id: 'q1' } } });
    expect(room.facilitator.holder).toBeNull();
    vi.useRealTimers();
  });

  it('gives a refreshing holder their baton back when they present the token', () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });
    const token = facFrames(a).at(-1)!.token as string;

    // The refresh: a brand new socket, a brand new presence id, and the one
    // thing that survived in sessionStorage.
    const back = makeSocket();
    seedSession(state, back, presence('p-a2', 'edit'));
    sendFrame(room, back, {
      kind: 'hello',
      participant: presence('p-a2', 'edit'),
      facilitatorToken: token,
    });
    expect(facFrames(back).at(-1)).toMatchObject({ holder: 'p-a2', token });
  });

  it('ignores a token somebody else guessed', () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    const thief = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    seedSession(state, thief, presence('p-t', 'edit'));
    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });

    sendFrame(room, thief, {
      kind: 'hello',
      participant: presence('p-t', 'edit'),
      facilitatorToken: 'not-the-token',
    });
    // They are told the state, and it is not them.
    expect(facFrames(thief).at(-1)).toMatchObject({ holder: 'p-a', reason: 'state' });
  });

  it('tells a joiner who is facilitating without announcing anything', () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });

    const late = makeSocket();
    seedSession(state, late, presence('p-l', 'edit'));
    sendFrame(room, late, { kind: 'hello', participant: presence('p-l', 'edit') });
    expect(facFrames(late)).toEqual([{ kind: 'facilitator', holder: 'p-a', reason: 'state' }]);
  });

  it('starts a grace clock when the holder leaves, and releases when it fires', async () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    const b = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    seedSession(state, b, presence('p-b', 'edit'));
    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });

    room.webSocketClose(asWs(a));
    // Still theirs: a refresh and a dropped connection look identical here.
    expect(state.alarms).toHaveLength(1);
    expect(room.facilitator.holder).toBe('p-a');

    vi.setSystemTime(new Date(Date.now() + 91_000));
    await room.alarm();
    expect(room.facilitator.holder).toBeNull();
    expect(facFrames(b).at(-1)).toMatchObject({ holder: null, reason: 'left' });
    vi.useRealTimers();
  });

  it('does nothing on an alarm whose holder came back', async () => {
    const { room, state } = newRoom();
    const a = makeSocket();
    seedSession(state, a, presence('p-a', 'edit'));
    sendFrame(room, a, { kind: 'facilitator', action: 'claim' });
    const token = facFrames(a).at(-1)!.token as string;
    room.webSocketClose(asWs(a));

    const back = makeSocket();
    seedSession(state, back, presence('p-a2', 'edit'));
    sendFrame(room, back, {
      kind: 'hello',
      participant: presence('p-a2', 'edit'),
      facilitatorToken: token,
    });

    await room.alarm();
    expect(room.facilitator.holder).toBe('p-a2');
  });
});

describe('DocumentRoom multiplayer telemetry (docs/specs/017-telemetry/telemetry.md)', () => {
  // A fake D1 that records every telemetry row the room writes.
  function envWithRows(): { env: Env; rows: unknown[][] } {
    const rows: unknown[][] = [];
    const DB = {
      prepare: () => ({ bind: (...args: unknown[]) => args }),
      batch: (stmts: unknown[][]) => {
        rows.push(...stmts);
        return Promise.resolve([]);
      },
    };
    return { env: { TELEMETRY_ENABLED: 'true', DB } as unknown as Env, rows };
  }

  function join(room: DocumentRoom, name: string): FakeSocket {
    const ws = makeSocket();
    room.acceptSession(asWs(ws), 'edit');
    sendFrame(room, ws, { kind: 'hello', participant: { id: name, name, color: '#000' } });
    return ws;
  }

  const multiplayerRows = (rows: unknown[][]) =>
    rows.filter((r) => r[0] === 'Document' && r[1] === 'Used' && r[2] === 'Multiplayer');

  it('counts a five-person session once, not once per participant', async () => {
    const { env, rows } = envWithRows();
    const room = new DocumentRoom(makeState() as unknown as DurableObjectState, env);
    join(room, 'a');
    await Promise.resolve();
    expect(multiplayerRows(rows)).toHaveLength(0);
    for (const name of ['b', 'c', 'd', 'e']) join(room, name);
    await Promise.resolve();
    expect(multiplayerRows(rows)).toHaveLength(1);
  });

  it('counts a new session once the room has emptied and filled again', async () => {
    const { env, rows } = envWithRows();
    const state = makeState();
    const room = new DocumentRoom(state as unknown as DurableObjectState, env);
    join(room, 'a');
    join(room, 'b');
    // Everybody leaves: the runtime drops closed sockets from the set.
    state.sockets.length = 0;
    join(room, 'c');
    join(room, 'd');
    await Promise.resolve();
    expect(multiplayerRows(rows)).toHaveLength(2);
  });

  it('writes nothing when telemetry is off', async () => {
    const { env, rows } = envWithRows();
    const room = new DocumentRoom(makeState() as unknown as DurableObjectState, {
      ...env,
      TELEMETRY_ENABLED: undefined,
    });
    join(room, 'a');
    join(room, 'b');
    await Promise.resolve();
    expect(rows).toHaveLength(0);
  });
});

describe('DocumentRoom freeing a selection lock (docs/specs/007-editor/live-app.md + docs/specs/012-collaboration/facilitator.md)', () => {
  // Sent frames as the fake socket recorded them.
  const framesOf = (ws: FakeSocket) => ws.sent.map((raw) => JSON.parse(raw) as { kind: string });
  const released = (ws: FakeSocket) => framesOf(ws).filter((f) => f.kind === 'selection-released');

  function room3() {
    const { room, state } = newRoom();
    const host = makeSocket();
    const holder = makeSocket();
    const bystander = makeSocket();
    seedSession(state, host, presence('host', 'edit'));
    seedSession(state, holder, presence('holder', 'edit'));
    seedSession(state, bystander, presence('bystander', 'edit'));
    return { room, host, holder, bystander };
  }

  const unlock = (target = 'holder', elementId = 'el-1') => ({
    kind: 'facilitator',
    action: 'unlock',
    target,
    elementId,
  });

  it('tells the holder alone, and nobody else', () => {
    // The addressing IS the delivery: a client is never told its own presence
    // id (docs/specs/015-api/public-api-and-tokens.md §6), so a broadcast naming a target would reach nobody able
    // to recognise itself in it.
    const { room, host, holder, bystander } = room3();
    sendFrame(room, host, unlock());
    expect(released(holder)).toEqual([
      { kind: 'selection-released', elementId: 'el-1', by: 'host' },
    ]);
    expect(released(bystander)).toEqual([]);
    expect(released(host)).toEqual([]);
  });

  it('refuses a view-role visitor, even while nobody is facilitating', () => {
    const { room, state } = newRoom();
    const viewer = makeSocket();
    const holder = makeSocket();
    seedSession(state, viewer, presence('viewer', 'view'));
    seedSession(state, holder, presence('holder', 'edit'));
    sendFrame(room, viewer, unlock());
    expect(released(holder)).toEqual([]);
  });

  it('refuses somebody who is not running the session', () => {
    const { room, host, holder, bystander } = room3();
    // Give the baton to `host`, then have a bystander try to use it.
    sendFrame(room, host, { kind: 'facilitator', action: 'claim' });
    sendFrame(room, bystander, unlock());
    expect(released(holder)).toEqual([]);
  });

  it('lets the facilitator use it once they hold the baton', () => {
    const { room, host, holder } = room3();
    sendFrame(room, host, { kind: 'facilitator', action: 'claim' });
    sendFrame(room, host, unlock());
    expect(released(holder)).toHaveLength(1);
  });

  it('ignores an unlock aimed at yourself', () => {
    const { room, host } = room3();
    sendFrame(room, host, unlock('host'));
    expect(released(host)).toEqual([]);
  });

  it('ignores a target who has already left, silently', () => {
    // Answering would tell a peer which presence ids are live.
    const { room, host, holder, bystander } = room3();
    sendFrame(room, host, unlock('ghost'));
    expect(released(holder)).toEqual([]);
    expect(released(bystander)).toEqual([]);
    expect(released(host)).toEqual([]);
  });

  it('ignores a missing or empty elementId', () => {
    const { room, host, holder } = room3();
    sendFrame(room, host, { kind: 'facilitator', action: 'unlock', target: 'holder' });
    sendFrame(room, host, unlock('holder', ''));
    expect(released(holder)).toEqual([]);
  });

  it('moves no baton — it uses one', () => {
    const { room, host, holder } = room3();
    sendFrame(room, host, unlock());
    // A facilitator frame would have gone out had the baton changed hands.
    expect(framesOf(holder).some((f) => f.kind === 'facilitator')).toBe(false);
  });
});

describe('DocumentRoom collaboration ledger (docs/specs/012-collaboration/collab-race-hardening.md phase 3)', () => {
  function editor(room: DocumentRoom) {
    const ws = makeSocket();
    room.acceptSession(asWs(ws), 'edit');
    sendFrame(room, ws, { kind: 'hello', participant: { id: 'e', name: 'E', color: '#000' } });
    return ws;
  }
  const answer = (participantId: string) => ({
    kind: 'op',
    op: {
      kind: 'el-delta',
      tabId: 't1',
      elementId: 'card',
      delta: { kind: 'response', participantId, value: 'done', at: 1 },
    },
  });
  const ledger = async (room: DocumentRoom, epoch = room.epoch) =>
    (await room.fetch(new Request(`https://room/ledger?tab=t1&epoch=${epoch}`))).json();

  it('records each answer with the seq it took, and serves the tab ledger', async () => {
    const { room } = newRoom();
    const ws = editor(room);
    sendFrame(room, ws, answer('a'));
    sendFrame(room, ws, answer('b'));
    const body = (await ledger(room)) as {
      elements: Record<string, { responses: Record<string, { seq: number }> }>;
    };
    expect(body.elements.card!.responses.a!.seq).toBe(1);
    expect(body.elements.card!.responses.b!.seq).toBe(2);
  });

  it('serves nothing to a cursor from another epoch', async () => {
    const { room } = newRoom();
    sendFrame(room, editor(room), answer('a'));
    expect(await ledger(room, 'some-other-epoch')).toEqual({ elements: {} });
  });

  it('does not record a view-role sender (the op is refused before it)', async () => {
    const { room } = newRoom();
    const viewer = makeSocket();
    room.acceptSession(asWs(viewer), 'view');
    sendFrame(room, viewer, { kind: 'hello', participant: { id: 'v', name: 'V', color: '#000' } });
    sendFrame(room, viewer, answer('v'));
    expect(await ledger(room)).toEqual({ elements: {} });
  });
});

describe('DocumentRoom live poll (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  const pollOp = (id: string, startedAt = 1) => ({
    kind: 'op',
    op: {
      kind: 'poll-start',
      poll: { id, question: 'Lunch?', style: 'text', options: [], startedAt, hostKey: 'host' },
    },
  });
  function join(room: DocumentRoom, id: string, role: 'edit' | 'view' = 'edit') {
    const ws = makeSocket();
    room.acceptSession(asWs(ws), role);
    sendFrame(room, ws, { kind: 'hello', participant: { id, name: id, color: '#000' } });
    return ws;
  }
  const ops = (ws: FakeSocket) =>
    ws.sent
      .map((s) => JSON.parse(s))
      .filter((m) => m.kind === 'op')
      .map((m) => m.op);

  it('replays the running poll and every answer to a late joiner', async () => {
    const { room } = newRoom();
    const host = join(room, 'h');
    const viewer = join(room, 'v', 'view');
    sendFrame(room, host, pollOp('p1'));
    sendFrame(room, viewer, {
      kind: 'op',
      op: { kind: 'poll-answer', pollId: 'p1', value: 'pizza', key: 'viewer-key', proof: 's1' },
    });
    await room.pollAnswers;
    const late = join(room, 'late');
    expect(ops(late)).toEqual([
      expect.objectContaining({ kind: 'poll-start', poll: expect.objectContaining({ id: 'p1' }) }),
      { kind: 'poll-answer', pollId: 'p1', value: 'pizza', key: 'viewer-key' },
    ]);
  });

  it('a re-answer under the same key replaces the first, in the order sent', async () => {
    const { room } = newRoom();
    const host = join(room, 'h');
    sendFrame(room, host, pollOp('p1'));
    for (const value of ['pizza', 'sushi']) {
      sendFrame(room, host, {
        kind: 'op',
        op: { kind: 'poll-answer', pollId: 'p1', value, key: 'k', proof: 'secret' },
      });
    }
    await room.pollAnswers;
    expect(room.poll.state?.answers).toEqual({ k: 'sushi' });
  });

  // docs/specs/012-collaboration/vote-integrity.md: the room decides who an answer belongs to.
  describe('vote integrity', () => {
    const answer = (value: string, key?: string, proof?: string) => ({
      kind: 'op',
      op: {
        kind: 'poll-answer',
        pollId: 'p1',
        value,
        ...(key ? { key } : {}),
        ...(proof ? { proof } : {}),
      },
    });
    function joinAs(
      room: DocumentRoom,
      id: string,
      opts: { personTag?: string; networkTag?: string } = {},
    ) {
      const ws = makeSocket();
      room.acceptSession(
        asWs(ws),
        'view',
        false,
        null,
        null,
        !!opts.personTag,
        opts.personTag ?? null,
        opts.networkTag ?? 'net-a',
      );
      sendFrame(room, ws, { kind: 'hello', participant: { id, name: id, color: '#000' } });
      return ws;
    }
    const presenceOf = (ws: FakeSocket) => storedPresence(ws)!.id;

    it('never relays the proof, and relays the answer under the key the room chose', async () => {
      const { room } = newRoom();
      const host = join(room, 'h');
      sendFrame(room, host, pollOp('p1'));
      const viewer = joinAs(room, 'v');
      host.sent.length = 0;
      sendFrame(room, viewer, answer('pizza', 'vk', 'secret'));
      await room.pollAnswers;
      expect(ops(host)).toEqual([{ kind: 'poll-answer', pollId: 'p1', value: 'pizza', key: 'vk' }]);
      expect(JSON.stringify(host.sent)).not.toContain('secret');
      expect(JSON.stringify(room.poll.state)).not.toContain('secret');
    });

    it("will not let another browser change an answer under somebody else's key", async () => {
      const { room } = newRoom();
      const host = join(room, 'h');
      sendFrame(room, host, pollOp('p1'));
      const victim = joinAs(room, 'victim');
      sendFrame(room, victim, answer('pizza', 'victim-key', 'victim-secret'));
      await room.pollAnswers;
      const attacker = joinAs(room, 'attacker');
      host.sent.length = 0;
      sendFrame(room, attacker, answer('sushi', 'victim-key', 'a-guess'));
      await room.pollAnswers;
      // The victim's answer stands; the attacker's counts once, under its own presence id.
      expect(room.poll.state?.answers['victim-key']).toBe('pizza');
      expect(room.poll.state?.answers[presenceOf(attacker)]).toBe('sushi');
      expect(ops(host)).toEqual([
        { kind: 'poll-answer', pollId: 'p1', value: 'sushi', key: presenceOf(attacker) },
      ]);
    });

    it('lets the same browser re-answer after a reconnect, with its secret', async () => {
      const { room } = newRoom();
      const host = join(room, 'h');
      sendFrame(room, host, pollOp('p1'));
      sendFrame(room, joinAs(room, 'first-socket'), answer('pizza', 'k', 'mine'));
      sendFrame(room, joinAs(room, 'second-socket'), answer('sushi', 'k', 'mine'));
      await room.pollAnswers;
      expect(room.poll.state?.answers).toEqual({ k: 'sushi' });
    });

    it('refuses a second key from the same socket, and relays nothing for it', async () => {
      const { room } = newRoom();
      const host = join(room, 'h');
      sendFrame(room, host, pollOp('p1'));
      const viewer = joinAs(room, 'v');
      sendFrame(room, viewer, answer('pizza', 'k1', 's1'));
      await room.pollAnswers;
      host.sent.length = 0;
      sendFrame(room, viewer, answer('sushi', 'k2', 's2'));
      await room.pollAnswers;
      expect(room.poll.state?.answers).toEqual({ k1: 'pizza' });
      expect(ops(host)).toEqual([]);
    });

    it("caps one network's answers, and lets an answer already in change", async () => {
      const { room } = newRoom();
      const host = join(room, 'h');
      sendFrame(room, host, pollOp('p1'));
      for (let i = 0; i < 100; i++)
        sendFrame(room, joinAs(room, `g${i}`), answer('pizza', `k${i}`, `s${i}`));
      await room.pollAnswers;
      sendFrame(room, joinAs(room, 'one-too-many'), answer('pizza', 'k100', 's100'));
      sendFrame(
        room,
        joinAs(room, 'other-network', { networkTag: 'net-b' }),
        answer('pizza', 'kb', 'sb'),
      );
      sendFrame(room, joinAs(room, 'g0-again'), answer('sushi', 'k0', 's0'));
      await room.pollAnswers;
      const answers = room.poll.state!.answers;
      expect(Object.keys(answers)).toHaveLength(101);
      expect(answers['k100']).toBeUndefined();
      expect(answers['kb']).toBe('pizza');
      expect(answers['k0']).toBe('sushi');
    });

    it('gives an account one answer per poll, from any of its sessions', async () => {
      const { room } = newRoom();
      const host = join(room, 'h');
      sendFrame(room, host, pollOp('p1'));
      sendFrame(
        room,
        joinAs(room, 'laptop', { personTag: 'acct' }),
        answer('pizza', 'laptop-key', 'l'),
      );
      await room.pollAnswers;
      host.sent.length = 0;
      sendFrame(
        room,
        joinAs(room, 'phone', { personTag: 'acct' }),
        answer('sushi', 'phone-key', 'p'),
      );
      await room.pollAnswers;
      expect(room.poll.state?.answers).toEqual({ 'laptop-key': 'sushi' });
      expect(ops(host)).toEqual([
        { kind: 'poll-answer', pollId: 'p1', value: 'sushi', key: 'laptop-key' },
      ]);
    });

    it("does not let an account take a guest's key", async () => {
      const { room } = newRoom();
      const host = join(room, 'h');
      sendFrame(room, host, pollOp('p1'));
      sendFrame(room, joinAs(room, 'guest'), answer('pizza', 'guest-key', 'g'));
      const account = joinAs(room, 'acct', { personTag: 'acct' });
      sendFrame(room, account, answer('sushi', 'guest-key', 'x'));
      await room.pollAnswers;
      expect(room.poll.state?.answers['guest-key']).toBe('pizza');
      expect(room.poll.state?.answers[presenceOf(account)]).toBe('sushi');
    });

    it('keys an old client with no proof on its own presence id, which nobody else can claim', async () => {
      const { room } = newRoom();
      const host = join(room, 'h');
      sendFrame(room, host, pollOp('p1'));
      const old = joinAs(room, 'old');
      sendFrame(room, old, answer('pizza', 'claimed-key'));
      await room.pollAnswers;
      expect(room.poll.state?.answers).toEqual({ [presenceOf(old)]: 'pizza' });
      const squatter = joinAs(room, 'squatter');
      sendFrame(room, squatter, answer('sushi', presenceOf(old), 'sq'));
      await room.pollAnswers;
      expect(room.poll.state?.answers[presenceOf(old)]).toBe('pizza');
    });

    it('drops an answer to a poll the room is not running', async () => {
      const { room } = newRoom();
      const host = join(room, 'h');
      const viewer = joinAs(room, 'v');
      host.sent.length = 0;
      sendFrame(room, viewer, answer('pizza', 'k', 's'));
      await room.pollAnswers;
      expect(ops(host)).toEqual([]);
    });
  });

  it('forgets the poll when it ends, and keeps the newer of two starts', () => {
    const { room } = newRoom();
    const host = join(room, 'h');
    sendFrame(room, host, pollOp('late', 9));
    sendFrame(room, host, pollOp('early', 3));
    expect(room.poll.state?.poll.id).toBe('late');
    sendFrame(room, host, { kind: 'op', op: { kind: 'poll-end', pollId: 'late' } });
    expect(room.poll.state).toBeNull();
    expect(ops(join(room, 'next'))).toEqual([]);
  });
});

describe('DocumentRoom worker mutations (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  it('sequences a worker-made comment into the stream for everybody', async () => {
    const { room } = newRoom();
    const peer = makeSocket();
    room.acceptSession(asWs(peer), 'edit');
    sendFrame(room, peer, { kind: 'hello', participant: { id: 'p', name: 'P', color: '#000' } });
    peer.sent.length = 0;
    const op = {
      kind: 'el-delta',
      tabId: 't1',
      elementId: 'card',
      delta: { kind: 'comment-remove', commentId: 'c1' },
    };
    const res = await room.fetch(
      new Request('https://room/mutation', { method: 'POST', body: JSON.stringify({ op }) }),
    );
    expect(res.status).toBe(204);
    const frame = JSON.parse(peer.sent.at(-1)!);
    expect(frame).toMatchObject({ kind: 'op', from: 'system', op, seq: 1, epoch: room.epoch });
  });

  it('accepts nothing but an element delta', async () => {
    const { room } = newRoom();
    const res = await room.fetch(
      new Request('https://room/mutation', {
        method: 'POST',
        body: JSON.stringify({ op: { kind: 'tab', tabId: 't1', tab: {} } }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('DocumentRoom comment author ids (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  it('strips them from every op it relays, whatever a client sent', () => {
    const { room } = newRoom();
    const editor = makeSocket();
    const peer = makeSocket();
    room.acceptSession(asWs(editor), 'edit');
    room.acceptSession(asWs(peer), 'edit');
    sendFrame(room, editor, { kind: 'hello', participant: { id: 'e', name: 'Ed', color: '#000' } });
    sendFrame(room, peer, { kind: 'hello', participant: { id: 'p', name: 'P', color: '#111' } });
    const comment = {
      id: 'c',
      text: 'hi',
      createdAt: 1,
      authorName: 'Boss',
      authorColor: '#fff',
      authorId: 'owner-secret',
    };
    sendFrame(room, editor, {
      kind: 'op',
      op: {
        kind: 'el',
        tabId: 't',
        op: {
          kind: 'update',
          element: {
            id: 'a',
            type: 'shape',
            shape: 'square',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            commentThread: { comments: [comment], resolved: false },
          },
        },
      },
    });
    sendFrame(room, editor, {
      kind: 'op',
      op: {
        kind: 'el-delta',
        tabId: 't',
        elementId: 'a',
        delta: { kind: 'comment-add', comment: { ...comment, id: 'c2' } },
      },
    });
    const received = peer.sent.join('\n');
    expect(received).not.toContain('owner-secret');
    // And a posted comment carries the sender's session name, not its claim.
    expect(received).toContain('"authorName":"Ed"');
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md, Realtime. A session admitted on a link scoped to tab
// t2 receives nothing about t1, can't change t1, and is shut out when its
// link is revoked or rescoped.
describe('DocumentRoom tab-scoped sessions', () => {
  function scopedSession(
    state: FakeState,
    ws: FakeSocket & { closed?: [number, string] },
    p: ParticipantPresence,
    tabScope: string | null,
    shareCode: string | null = null,
  ) {
    ws.attachment = {
      presenceId: p.id,
      verifiedRole: p.role,
      presence: p,
      isOwner: false,
      tabScope,
      shareCode,
    };
    (ws as unknown as { close: (code: number, reason: string) => void }).close = (code, reason) => {
      ws.closed = [code, reason];
    };
    state.sockets.push(asWs(ws));
  }
  const ops = (ws: FakeSocket) =>
    ws.sent
      .map((m) => JSON.parse(m))
      .filter((m) => m.kind === 'op')
      .map((m) => m.op);

  it('keeps another tab out of a scoped session and lets its own through', () => {
    const { room, state } = newRoom();
    const owner = makeSocket();
    const scoped = makeSocket();
    scopedSession(state, owner, presence('p-o', 'edit'), null);
    scopedSession(state, scoped, presence('p-s', 'view'), 't2');
    sendFrame(room, owner, { kind: 'op', op: { kind: 'el', tabId: 't1', op: { type: 'x' } } });
    sendFrame(room, owner, { kind: 'op', op: { kind: 'el', tabId: 't2', op: { type: 'y' } } });
    expect(ops(scoped)).toEqual([{ kind: 'el', tabId: 't2', op: { type: 'y' } }]);
  });

  it('hands a scoped session a redacted document-meta', () => {
    const { room, state } = newRoom();
    const owner = makeSocket();
    const scoped = makeSocket();
    scopedSession(state, owner, presence('p-o', 'edit'), null);
    scopedSession(state, scoped, presence('p-s', 'view'), 't2');
    sendFrame(room, owner, {
      kind: 'op',
      op: {
        kind: 'document-meta',
        name: 'Plan',
        tabs: [
          { id: 't1', name: 'Pricing', orderIndex: 0 },
          { id: 't2', name: 'Roadmap', orderIndex: 1 },
        ],
      },
    });
    expect(ops(scoped)[0].tabs[0]).toEqual({ id: 't1', name: '', orderIndex: 0, outOfScope: true });
  });

  it('refuses a scoped session changing another tab, or the document', () => {
    const { room, state } = newRoom();
    const owner = makeSocket();
    const scoped = makeSocket();
    scopedSession(state, owner, presence('p-o', 'edit'), null);
    scopedSession(state, scoped, presence('p-s', 'edit'), 't2');
    sendFrame(room, scoped, { kind: 'op', op: { kind: 'el', tabId: 't1', op: {} } });
    sendFrame(room, scoped, { kind: 'op', op: { kind: 'document-meta', name: 'x', tabs: [] } });
    expect(ops(owner)).toEqual([]);
    sendFrame(room, scoped, { kind: 'op', op: { kind: 'el', tabId: 't2', op: {} } });
    expect(ops(owner)).toEqual([{ kind: 'el', tabId: 't2', op: {} }]);
  });

  it('filters the catch-up replay the same way', () => {
    const { room, state } = newRoom();
    const owner = makeSocket();
    scopedSession(state, owner, presence('p-o', 'edit'), null);
    sendFrame(room, owner, { kind: 'op', op: { kind: 'el', tabId: 't1', op: {} } });
    sendFrame(room, owner, { kind: 'op', op: { kind: 'el', tabId: 't2', op: {} } });
    const scoped = makeSocket();
    scopedSession(state, scoped, presence('p-s', 'view'), 't2');
    sendFrame(room, scoped, { kind: 'sync', epoch: null, lastSeq: 0 });
    const catchup = scoped.sent.map((m) => JSON.parse(m)).find((m) => m.kind === 'catchup');
    expect(catchup.ops.map((o: { op: { tabId: string } }) => o.op.tabId)).toEqual(['t2']);
  });

  for (const kind of ['share-revoked', 'share-rescoped']) {
    it(`closes the sockets a ${kind} code admitted, after telling them`, async () => {
      const { room, state } = newRoom();
      const holder = makeSocket() as FakeSocket & { closed?: [number, string] };
      const other = makeSocket() as FakeSocket & { closed?: [number, string] };
      scopedSession(state, holder, presence('p-h', 'view'), 't2', 'CODE2345');
      scopedSession(state, other, presence('p-x', 'view'), null, 'OTHER234');
      await room.fetch(
        new Request('https://room/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: { kind, code: 'CODE2345' } }),
        }),
      );
      expect(ops(holder)).toEqual([{ kind, code: 'CODE2345' }]);
      expect(holder.closed?.[0]).toBe(4003);
      expect(other.closed).toBeUndefined();
    });
  }

  it('closes every socket with 4004 when the document is trashed, after telling them', async () => {
    // docs/specs/013-workspace/trash.md: open sessions end the moment the
    // document goes to the Trash, each told why.
    const { room, state } = newRoom();
    const owner = makeSocket() as FakeSocket & { closed?: [number, string] };
    const visitor = makeSocket() as FakeSocket & { closed?: [number, string] };
    scopedSession(state, owner, presence('p-o', 'edit'), null);
    scopedSession(state, visitor, presence('p-v', 'view'), 't2', 'CODE2345');
    await room.fetch(
      new Request('https://room/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: { kind: 'document-trashed' } }),
      }),
    );
    for (const ws of [owner, visitor]) {
      expect(ops(ws)).toEqual([{ kind: 'document-trashed' }]);
      expect(ws.closed).toEqual([4004, 'document-trashed']);
    }
  });

  // docs/specs/015-api/api.md "Access changes end the sessions they affect": the api's internal
  // /close-sessions ends only the matched sessions, with 4005, and broadcasts nothing.
  describe('POST /close-sessions', () => {
    const TAG = 'a'.repeat(64);
    const closeSessions = (room: DocumentRoom, body: unknown) =>
      room.fetch(
        new Request('https://room/close-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );

    it('closes every share-code session when a password is set, keeping the owner and team', async () => {
      const { room, state } = newRoom();
      const owner = makeSocket() as FakeSocket & { closed?: [number, string] };
      const member = makeSocket() as FakeSocket & { closed?: [number, string] };
      const visitor = makeSocket() as FakeSocket & { closed?: [number, string] };
      const scopedVisitor = makeSocket() as FakeSocket & { closed?: [number, string] };
      scopedSession(state, owner, presence('p-o', 'edit'), null);
      scopedSession(state, member, presence('p-m', 'edit'), null);
      scopedSession(state, visitor, presence('p-v', 'edit'), null, 'CODE2345');
      scopedSession(state, scopedVisitor, presence('p-s', 'view'), 't2', 'OTHER234');
      const res = await closeSessions(room, { match: 'share-code' });
      expect(res.status).toBe(204);
      expect(visitor.closed).toEqual([4005, 'access-changed']);
      expect(scopedVisitor.closed).toEqual([4005, 'access-changed']);
      expect(owner.closed).toBeUndefined();
      expect(member.closed).toBeUndefined();
      // Nobody is told: the close is the whole message.
      for (const ws of [owner, member]) expect(ops(ws)).toEqual([]);
    });

    it("closes only the departed member's sessions by their person tag", async () => {
      const { room, state } = newRoom();
      const gone = makeSocket() as FakeSocket & { closed?: [number, string] };
      const stays = makeSocket() as FakeSocket & { closed?: [number, string] };
      const untagged = makeSocket() as FakeSocket & { closed?: [number, string] };
      scopedSession(state, gone, presence('p-g', 'edit'), null);
      scopedSession(state, stays, presence('p-s', 'edit'), null);
      scopedSession(state, untagged, presence('p-u', 'view'), null, 'CODE2345');
      Object.assign(gone.attachment as object, { personTag: TAG });
      Object.assign(stays.attachment as object, { personTag: 'b'.repeat(64) });
      await closeSessions(room, { match: 'person', personTag: TAG });
      expect(gone.closed).toEqual([4005, 'access-changed']);
      expect(stays.closed).toBeUndefined();
      expect(untagged.closed).toBeUndefined();
    });

    it('400s a match it does not know, closing nobody', async () => {
      const { room, state } = newRoom();
      const visitor = makeSocket() as FakeSocket & { closed?: [number, string] };
      scopedSession(state, visitor, presence('p-v', 'view'), null, 'CODE2345');
      for (const body of [{}, { match: 'everyone' }, { match: 'person', personTag: 'short' }]) {
        expect((await closeSessions(room, body)).status).toBe(400);
      }
      expect(visitor.closed).toBeUndefined();
    });
  });

  it('pins the scope and code on the session at admission', () => {
    const { room } = newRoom();
    const ws = makeSocket();
    (room as unknown as { state: { acceptWebSocket: () => void } }).state.acceptWebSocket =
      () => {};
    room.acceptSession(asWs(ws), 'view', false, 't2', 'CODE2345');
    expect(ws.attachment).toMatchObject({ tabScope: 't2', shareCode: 'CODE2345' });
  });
});

// Profile pictures on the roster (docs/specs/014-identity/profile-picture.md §5, §6): kept only
// from a verified account session, sent only to account sessions, updated by a repeat hello.
describe('DocumentRoom profile pictures', () => {
  const PICTURE = 'https://img.clerk.com/eyJ0eXBlIjoicHJveHkifQ?width=96&height=96&fit=crop';
  const hello = (picture?: string) => ({
    kind: 'hello',
    participant: { id: 'x', name: 'Ann', color: '#f00', ...(picture ? { picture } : {}) },
  });
  const lastRoster = (s: FakeSocket) =>
    (
      JSON.parse(s.sent.filter((m) => m.includes('"kind":"presence"')).at(-1)!) as {
        participants: ParticipantPresence[];
      }
    ).participants;

  it('keeps a picture from an account session and drops one from anyone else', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { room } = newRoom();
    const account = makeSocket();
    const anonymous = makeSocket();
    room.acceptSession(asWs(account), 'edit', false, null, null, true);
    room.acceptSession(asWs(anonymous), 'view', false, null, 'CODE', false);
    sendFrame(room, account, hello(PICTURE));
    sendFrame(room, anonymous, hello(PICTURE));
    expect(storedPresence(account)?.picture).toBe(PICTURE);
    expect(storedPresence(anonymous)?.picture).toBeUndefined();
  });

  it("drops a picture that is not on Clerk's image host", () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { room } = newRoom();
    const ws = makeSocket();
    room.acceptSession(asWs(ws), 'edit', false, null, null, true);
    sendFrame(room, ws, hello('https://evil.example/me.png'));
    expect(storedPresence(ws)?.picture).toBeUndefined();
  });

  it('sends pictures to account sessions only: an anonymous share visitor sees none', () => {
    const { room } = newRoom();
    const ann = makeSocket();
    const bob = makeSocket();
    const visitor = makeSocket();
    room.acceptSession(asWs(ann), 'edit', false, null, null, true);
    room.acceptSession(asWs(bob), 'edit', false, null, null, true);
    room.acceptSession(asWs(visitor), 'view', false, null, 'CODE', false);
    sendFrame(room, ann, hello(PICTURE));
    sendFrame(room, bob, hello());
    sendFrame(room, visitor, hello());
    expect(lastRoster(bob).find((p) => p.name === 'Ann' && p.picture)?.picture).toBe(PICTURE);
    expect(lastRoster(visitor).some((p) => 'picture' in p)).toBe(false);
    expect(visitor.sent.join('\n')).not.toContain('img.clerk.com');
  });

  it('an identity update replaces the picture and rebroadcasts, without re-running the join', () => {
    const { room } = newRoom();
    const ann = makeSocket();
    const bob = makeSocket();
    room.acceptSession(asWs(ann), 'edit', false, null, null, true);
    room.acceptSession(asWs(bob), 'edit', false, null, null, true);
    sendFrame(room, ann, hello(PICTURE));
    sendFrame(room, bob, hello());
    const annCursorFrames = () => ann.sent.filter((m) => m.includes('"kind":"cursor"')).length;
    const before = annCursorFrames();
    sendFrame(room, ann, { ...hello(), kind: 'identity' });
    expect(storedPresence(ann)?.picture).toBeUndefined();
    expect(lastRoster(bob).some((p) => 'picture' in p)).toBe(false);
    expect(annCursorFrames()).toBe(before);
  });
});

describe('DocumentRoom identity updates', () => {
  it('are ignored before hello, and keep the tab the session is on', () => {
    const { room } = newRoom();
    const ws = makeSocket();
    room.acceptSession(asWs(ws), 'edit', false, null, null, true);
    sendFrame(room, ws, {
      kind: 'identity',
      participant: { id: 'x', name: 'Early', color: '#000' },
    });
    expect(storedPresence(ws)).toBeNull();
    sendFrame(room, ws, {
      kind: 'hello',
      participant: { id: 'x', name: 'Ann', color: '#f00', tabId: 't2' },
    });
    sendFrame(room, ws, { kind: 'identity', participant: { id: 'x', name: 'Ann', color: '#f00' } });
    expect(storedPresence(ws)?.tabId).toBe('t2');
  });
});

// Agent changesets (docs/specs/024-agents/agent-changesets.md "What the room does").
describe('DocumentRoom and agent changesets', () => {
  const changeset = {
    kind: 'changeset',
    tabId: 't1',
    id: 'cs_0000000001',
    rev: 2,
    prevRev: null,
    author: { name: 'Webber', color: '#0ea5e9' },
    counts: { added: 1, changed: 0, removed: 0 },
    elementOps: [
      {
        kind: 'add',
        at: 0,
        element: { id: 'b', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 },
      },
    ],
  };
  function join(
    room: DocumentRoom,
    id: string,
    personTag: string | null = null,
    role: 'edit' | 'view' = 'edit',
  ) {
    const ws = makeSocket();
    room.acceptSession(asWs(ws), role, false, null, null, personTag !== null, personTag);
    sendFrame(room, ws, { kind: 'hello', participant: { id, name: `Name ${id}`, color: '#abc' } });
    ws.sent.length = 0;
    return ws;
  }
  const presenceIdOf = (ws: FakeSocket) => (ws.attachment as { presenceId: string }).presenceId;
  const mutation = (op: unknown) =>
    new Request('https://room/mutation', { method: 'POST', body: JSON.stringify({ op }) });
  const selections = async (room: DocumentRoom, query: string) =>
    (await (await room.fetch(new Request(`https://room/selections?${query}`))).json()) as {
      selections: unknown[];
    };

  it('sequences a changeset in one slot for everybody, outside the ledger', async () => {
    const { room, state } = newRoom();
    const peer = join(room, 'p');
    expect((await room.fetch(mutation(changeset))).status).toBe(204);
    expect(JSON.parse(peer.sent.at(-1)!)).toMatchObject({
      kind: 'op',
      from: 'system',
      op: changeset,
      seq: 1,
    });
    expect(room.opLog).toHaveLength(1);
    expect([...state.store.keys()].some((k) => k.startsWith('ledger:'))).toBe(false);
  });

  it('sequences the tab-meta of a tab rename the api made', async () => {
    const { room } = newRoom();
    const peer = join(room, 'p');
    const meta = { kind: 'tab-meta', tabId: 't1', patch: { name: 'Renamed' } };
    expect((await room.fetch(mutation(meta))).status).toBe(204);
    expect(JSON.parse(peer.sent.at(-1)!)).toMatchObject({ from: 'system', op: meta });
  });

  it('sequences the document-meta of a document rename the api made, and refuses other kinds', async () => {
    const { room } = newRoom();
    const peer = join(room, 'p');
    const meta = {
      kind: 'document-meta',
      name: 'Shop v2',
      tabs: [{ id: 't1', name: 'Main', orderIndex: 0 }],
    };
    expect((await room.fetch(mutation(meta))).status).toBe(204);
    expect(JSON.parse(peer.sent.at(-1)!)).toMatchObject({ from: 'system', op: meta });
    expect((await room.fetch(mutation({ kind: 'tab', tabId: 't1' }))).status).toBe(400);
  });

  it('never relays a changeset from a client socket', () => {
    const { room } = newRoom();
    const sender = join(room, 's');
    const peer = join(room, 'p');
    sendFrame(room, sender, { kind: 'op', op: changeset });
    expect(peer.sent).toEqual([]);
  });

  it("answers every selection on the tab, any role, marking the agent owner's own", async () => {
    const { room } = newRoom();
    const owner = join(room, 'o', 'tag-owner');
    const viewer = join(room, 'v', null, 'view');
    join(room, 'idle');
    sendFrame(room, owner, {
      kind: 'op',
      op: { kind: 'select', elementId: 'a', tabId: 't1', elementIds: ['a', 'b'] },
    });
    sendFrame(room, viewer, { kind: 'op', op: { kind: 'select', elementId: 'c', tabId: 't1' } });
    await Promise.resolve();
    expect((await selections(room, 'tab=t1&person=tag-owner')).selections).toEqual([
      { elementIds: ['a', 'b'], name: 'Name o', color: '#abc', mine: true },
      { elementIds: ['c'], name: 'Name v', color: '#abc', mine: false },
    ]);
    expect((await selections(room, 'tab=t2&person=tag-owner')).selections).toEqual([]);
  });

  it('forgets a selection when it clears or its socket closes', async () => {
    const { room, state } = newRoom();
    const a = join(room, 'a');
    const b = join(room, 'b');
    sendFrame(room, a, { kind: 'op', op: { kind: 'select', elementId: 'x', tabId: 't1' } });
    sendFrame(room, b, { kind: 'op', op: { kind: 'select', elementId: 'y', tabId: 't1' } });
    await Promise.resolve();
    sendFrame(room, a, { kind: 'op', op: { kind: 'select', elementId: null, tabId: 't1' } });
    room.webSocketClose(asWs(b));
    await Promise.resolve();
    expect(state.store.has(`selection:${presenceIdOf(a)}`)).toBe(false);
    expect(state.store.has(`selection:${presenceIdOf(b)}`)).toBe(false);
  });

  it('refuses a selections query without a tab', async () => {
    const { room } = newRoom();
    expect((await room.fetch(new Request('https://room/selections'))).status).toBe(400);
  });

  it('pins the verified person tag on the session from the upgrade, never from a client', () => {
    const { room } = newRoom();
    const ws = join(room, 'o', 'tag-owner');
    expect((ws.attachment as { personTag?: string }).personTag).toBe('tag-owner');
    sendFrame(room, ws, {
      kind: 'hello',
      participant: { id: 'o', name: 'O', color: '#000', personTag: 'forged' },
    });
    expect((ws.attachment as { personTag?: string }).personTag).toBe('tag-owner');
  });
});

describe('DocumentRoom agent presence (docs/specs/024-agents/agent-presence.md)', () => {
  const body = (over: Record<string, unknown> = {}) => ({
    tokenId: 'tok_1',
    tabId: 't1',
    personTag: 'p-webber',
    shareCode: null,
    name: 'Webber',
    color: '#3b82f6',
    role: 'edit',
    status: 'adding payment service',
    focus: ['n3'],
    ttlMs: 30_000,
    mode: 'set',
    ...over,
  });
  const put = (room: DocumentRoom, b: unknown) =>
    room.fetch(new Request('https://room/presence', { method: 'PUT', body: JSON.stringify(b) }));
  const del = (room: DocumentRoom, query: string) =>
    room.fetch(new Request(`https://room/presence${query}`, { method: 'DELETE' }));
  const lastAgents = (ws: FakeSocket) => {
    const frames = ws.sent
      .map((s) => JSON.parse(s) as { kind: string; agents?: unknown[] })
      .filter((f) => f.kind === 'presence');
    return frames.at(-1)?.agents;
  };

  it('sends each session the agent with joins and self, apart from participants', async () => {
    const { room, state } = newRoom();
    const owner = makeSocket();
    const ada = makeSocket();
    seedSession(state, owner, presence('p-owner', 'edit'));
    (owner.attachment as { personTag?: string }).personTag = 'p-webber';
    seedSession(state, ada, presence('p-ada', 'edit'));
    const res = await put(room, body());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ created: true });
    expect(lastAgents(ada)).toEqual([
      expect.objectContaining({
        name: 'Webber',
        status: 'adding payment service',
        focus: ['n3'],
        joins: ['p-owner'],
        person: 0,
      }),
    ]);
    expect(lastAgents(owner)).toEqual([expect.objectContaining({ joins: [], self: true })]);
    const frame = JSON.parse(ada.sent.at(-1)!) as { participants: { id: string }[] };
    expect(frame.participants.map((p) => p.id)).toEqual(['p-owner']);
    expect(ada.sent.at(-1)).not.toMatch(/tok_1|p-webber/);
  });

  it('refreshes without a frame, refuses a bad body, and clears with a frame', async () => {
    const { room, state } = newRoom();
    const ada = makeSocket();
    seedSession(state, ada, presence('p-ada', 'edit'));
    await put(room, body());
    const sent = ada.sent.length;
    expect((await put(room, body({ mode: 'refresh' }))).status).toBe(200);
    expect(ada.sent.length).toBe(sent);
    expect((await put(room, { tokenId: 'x' })).status).toBe(400);
    expect((await del(room, '?tab=t1')).status).toBe(400);
    expect(await (await del(room, '?token=tok_1&tab=t1')).json()).toEqual({ cleared: true });
    expect(lastAgents(ada)).toEqual([]);
    expect(await (await del(room, '?token=tok_1&tab=t1')).json()).toEqual({ cleared: false });
  });

  it('refuses a new entry past the room’s cap', async () => {
    const { room } = newRoom();
    for (let i = 0; i < 32; i += 1) await put(room, body({ tokenId: `tok_${i}` }));
    const full = await put(room, body({ tokenId: 'tok_over' }));
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: 'agent_presence_full' });
  });

  it('arms the alarm at the earliest expiry, sweeps on it, and clears the alarm when nothing is left', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_000));
    const { room, state } = newRoom();
    const ada = makeSocket();
    seedSession(state, ada, presence('p-ada', 'edit'));
    await put(room, body({ ttlMs: 5_000 }));
    expect(state.alarms.at(-1)).toBe(1_005_000);
    vi.setSystemTime(new Date(1_006_000));
    await room.alarm();
    expect(lastAgents(ada)).toEqual([]);
    expect(state.alarms.at(-1)).toBeNull();
    vi.useRealTimers();
  });

  it('leaves an expired entry out of a frame before the alarm fires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2_000_000));
    const { room, state } = newRoom();
    const ada = makeSocket();
    seedSession(state, ada, presence('p-ada', 'edit'));
    await put(room, body({ ttlMs: 1_000 }));
    vi.setSystemTime(new Date(2_002_000));
    room.broadcastPresence();
    expect(lastAgents(ada)).toEqual([]);
    vi.useRealTimers();
  });

  it('clears every entry when the document is trashed, and a link’s entries when it is revoked', async () => {
    const { room, state } = newRoom();
    const ada = makeSocket();
    seedSession(state, ada, presence('p-ada', 'edit'), true);
    await put(room, body({ tokenId: 'tok_a', shareCode: 'CODE' }));
    await put(room, body({ tokenId: 'tok_b' }));
    const broadcast = (op: unknown) =>
      room.fetch(
        new Request('https://room/broadcast', { method: 'POST', body: JSON.stringify({ op }) }),
      );
    await broadcast({ kind: 'share-revoked', code: 'CODE' });
    expect(room.agents.live().map((r) => r.tokenId)).toEqual(['tok_b']);
    await broadcast({ kind: 'share-rescoped', code: 'OTHER' });
    expect(room.agents.live()).toHaveLength(1);
    await broadcast({ kind: 'document-trashed' });
    expect(room.agents.live()).toEqual([]);
  });

  it('restores entries after a wake', async () => {
    const state = makeState();
    const room = new DocumentRoom(state as unknown as DurableObjectState);
    await put(room, body());
    const woken = new DocumentRoom(state as unknown as DurableObjectState);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(woken.agents.live().map((r) => r.tokenId)).toEqual(['tok_1']);
  });
});
