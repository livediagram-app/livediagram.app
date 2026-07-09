import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ParticipantPresence } from '@livediagram/api-schema';
import {
  applyDiagramUpdate,
  base64ToUpdate,
  encodeDiagramUpdate,
  newDiagramDoc,
  readTabElements,
  updateToBase64,
  writeElements,
} from '@livediagram/diagram/yjs';
import { DiagramRoom } from './diagram-room';

// The DiagramRoom Durable Object is the realtime hub for one diagram.
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
//      reading the diagram until their next refresh.
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

function makeState(): FakeState {
  const state: FakeState = {
    sockets: [],
    acceptWebSocket: (ws) => {
      state.sockets.push(ws);
    },
    getWebSockets: () => [...state.sockets],
  };
  return state;
}

function newRoom(): { room: DiagramRoom; state: FakeState } {
  const state = makeState();
  // Only acceptWebSocket / getWebSockets are read off the state, so the
  // fake above suffices for unit coverage.
  return { room: new DiagramRoom(state as unknown as DurableObjectState), state };
}

function presence(id: string, role?: 'edit' | 'view'): ParticipantPresence {
  return { id, name: `Name ${id}`, color: '#abc', role };
}

// Seed a fully-established session directly (attachment + connected set),
// the hibernation-API equivalent of the old `sessions.set(ws, presence)`.
function seedSession(state: FakeState, ws: FakeSocket, p: ParticipantPresence | null): void {
  ws.attachment = { presenceId: p?.id ?? 'pre-hello', verifiedRole: p?.role, presence: p };
  state.sockets.push(asWs(ws));
}

// What the room persisted for this socket (the attachment's presence).
function storedPresence(ws: FakeSocket): ParticipantPresence | null {
  return (ws.attachment as { presence: ParticipantPresence | null }).presence;
}

function sendFrame(room: DiagramRoom, ws: FakeSocket, frame: unknown): void {
  room.webSocketMessage(asWs(ws), JSON.stringify(frame));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DiagramRoom /broadcast endpoint', () => {
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

describe('DiagramRoom presence broadcast', () => {
  // Each client must NOT receive its own entry: the broadcast presence id is a
  // fresh server-random (spec/61 §6), so a client can't recognise its own entry
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

describe('DiagramRoom non-WebSocket upgrades', () => {
  it('rejects plain HTTP requests on the WS path with 426', async () => {
    const { room } = newRoom();
    const res = await room.fetch(new Request('https://room/ws'));
    expect(res.status).toBe(426);
  });
});

describe('DiagramRoom hello frame role forcing', () => {
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
    // (spec/61 §6), so the spoofed value never reaches presence.
    expect(stored?.id).not.toBe('lying-peer');
    expect(stored?.id).toBeTruthy();
  });

  it('replaces the client participant id with a server-assigned ephemeral id', () => {
    const { room } = newRoom();
    const ws = makeSocket();
    // The DO assigns each session a fresh ephemeral presence id (spec/61 §6):
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

describe('DiagramRoom op-role enforcement', () => {
  // Drive a fully-connected session (hello sent) at a given verified
  // role, returning a `sendOp` that pushes an op frame from it.
  function connect(room: DiagramRoom, id: string, role?: 'edit' | 'view') {
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

  // Presence ops are ephemeral (cursor / selection / tab-focus / laser) and
  // must relay from a view-role session too, otherwise a viewer is invisible
  // to peers — no cursor, no selection highlight, no "which tab they're on".
  for (const kind of ['cursor', 'select', 'tab-focus', 'laser'] as const) {
    it(`relays a '${kind}' presence op from a view-role session`, () => {
      const { room } = newRoom();
      const editor = connect(room, 'editor', 'edit');
      const viewer = connect(room, 'viewer', 'view');
      editor.ws.sent.length = 0;

      sendFrame(room, viewer.ws, { kind: 'op', op: { kind, tabId: 't', x: 1, y: 2 } });

      expect(opsReceived(editor.ws)).toHaveLength(1);
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

describe('DiagramRoom tab-focus presence echo', () => {
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
    // A's broadcast id is its server-assigned ephemeral id (spec/61 §6), not
    // the claimed 'p-a' — find its row by the stored id.
    const aId = storedPresence(a)?.id;
    const presenceFrames = b.sent.map((s) => JSON.parse(s)).filter((m) => m.kind === 'presence');
    const aRow = presenceFrames.at(-1)!.participants.find((p: { id: string }) => p.id === aId);
    expect(aRow?.tabId).toBe('tab-2');
  });
});

describe('DiagramRoom hibernation survival', () => {
  // The whole point of the hibernation migration: the runtime may evict
  // the DO between messages and re-construct it on the next frame. All
  // per-session state (ephemeral id, verified role, presence incl. the
  // remembered tab) must come back off the socket attachments; only the
  // rate window resets. Simulated here by building a SECOND DiagramRoom
  // over the same state + sockets — exactly what a wake-from-hibernation
  // does — and asserting behaviour is unchanged.
  it('keeps identity, role, and tab across a simulated eviction', () => {
    const state = makeState();
    const before = new DiagramRoom(state as unknown as DurableObjectState);
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
    const after = new DiagramRoom(state as unknown as DurableObjectState);
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
    const frame = JSON.parse(joiner.sent.at(-1)!) as { participants: ParticipantPresence[] };
    expect(frame.participants.find((p) => p.id === editorId)?.tabId).toBe('tab-9');
  });
});

describe('DiagramRoom op ordering + reconnect catch-up (spec/75, Level 1)', () => {
  // Drive an established edit-role session and expose helpers to push ops
  // and read the frames a peer receives.
  function editorAndPeer(room: DiagramRoom) {
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

  it('gets a fresh epoch on a simulated hibernation wake', () => {
    const state = makeState();
    const before = new DiagramRoom(state as unknown as DurableObjectState);
    const after = new DiagramRoom(state as unknown as DurableObjectState);
    expect(before.epoch).not.toBe(after.epoch);
    expect(after.seq).toBe(0);
    expect(after.opLog).toEqual([]);
  });
});

describe('DiagramRoom Yjs doc authority (spec/75, Level 2)', () => {
  function editorAndPeer(room: DiagramRoom) {
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
  const lastOp = (ws: FakeSocket) =>
    ws.sent
      .map((s) => JSON.parse(s))
      .filter((m) => m.kind === 'op')
      .at(-1);
  // A minimal element + a base64 Yjs update for a one-tab diagram carrying it.
  const sq = (id: string) =>
    ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 }) as never;
  function seedUpdate(elId: string) {
    const doc = newDiagramDoc();
    writeElements(doc, [{ id: 't1', name: 'T', elements: [sq(elId)] }]);
    return updateToBase64(encodeDiagramUpdate(doc));
  }

  it('replies to ydoc-sync with a null state when the room holds no doc', () => {
    const { room } = newRoom();
    const { editor } = editorAndPeer(room);

    sendFrame(room, editor, { kind: 'op', op: { kind: 'ydoc-sync' } });

    const reply = lastOp(editor);
    expect(reply.from).toBe('system');
    expect(reply.op).toEqual({ kind: 'ydoc-state', update: null });
  });

  it('applies a ydoc update to its doc and relays it, without a seq', () => {
    const { room } = newRoom();
    const { editor, peer } = editorAndPeer(room);

    sendFrame(room, editor, { kind: 'op', op: { kind: 'ydoc', update: seedUpdate('e1') } });

    // Relayed to the peer as-is...
    expect(lastOp(peer).op.kind).toBe('ydoc');
    // ...but Yjs converges on its own, so no seq/log is spent on it.
    expect(room.seq).toBe(0);
    expect(room.opLog).toEqual([]);
    // The room's authoritative doc now carries the tab's element.
    expect(readTabElements(room.ydoc!, 't1')!.map((e) => e.id)).toEqual(['e1']);
  });

  it('seeds a later joiner from the accumulated doc state', () => {
    const { room } = newRoom();
    const { editor } = editorAndPeer(room);
    sendFrame(room, editor, { kind: 'op', op: { kind: 'ydoc', update: seedUpdate('shared-el') } });

    // A fresh client asks for the shared doc.
    const joiner = makeSocket();
    room.acceptSession(asWs(joiner), 'edit');
    sendFrame(room, joiner, { kind: 'hello', participant: { id: 'j', name: 'J', color: '#222' } });
    joiner.sent.length = 0;
    sendFrame(room, joiner, { kind: 'op', op: { kind: 'ydoc-sync' } });

    const reply = lastOp(joiner);
    expect(reply.op.kind).toBe('ydoc-state');
    // Applying the seed to a fresh doc reproduces the room's element set.
    const doc = newDiagramDoc();
    applyDiagramUpdate(doc, base64ToUpdate(reply.op.update));
    expect(readTabElements(doc, 't1')!.map((e) => e.id)).toEqual(['shared-el']);
  });

  it('drops a ydoc mutation from a view-role session but still answers its sync', () => {
    const { room } = newRoom();
    const editor = makeSocket();
    const viewer = makeSocket();
    room.acceptSession(asWs(editor), 'edit');
    room.acceptSession(asWs(viewer), 'view');
    sendFrame(room, editor, { kind: 'hello', participant: { id: 'e', name: 'E', color: '#000' } });
    sendFrame(room, viewer, { kind: 'hello', participant: { id: 'v', name: 'V', color: '#111' } });
    editor.sent.length = 0;

    // A viewer can't write the doc...
    sendFrame(room, viewer, { kind: 'op', op: { kind: 'ydoc', update: seedUpdate('Nope') } });
    expect(editor.sent.map((s) => JSON.parse(s)).filter((m) => m.kind === 'op')).toHaveLength(0);
    expect(room.ydoc).toBeNull();

    // ...but a viewer CAN read (sync) so it can render the shared doc.
    viewer.sent.length = 0;
    sendFrame(room, viewer, { kind: 'op', op: { kind: 'ydoc-sync' } });
    expect(lastOp(viewer).op.kind).toBe('ydoc-state');
  });
});
