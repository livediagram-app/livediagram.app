import { describe, expect, it } from 'vitest';
import type { ParticipantPresence } from '@livediagram/api-schema';
import { DiagramRoom } from './diagram-room';

// The DiagramRoom Durable Object is the realtime hub for one diagram.
// Most of its surface is straightforward fan-out, but two pieces carry
// real security weight:
//
//   1. `handleSession` hello frames: the server-resolved role (set by
//      the api worker at the upgrade) MUST overwrite whatever role the
//      client typed into its own hello payload. A regression here lets
//      a view-role visitor display itself as Editor in peer presence,
//      and the live-app Viewer / Editor badges become spoofable.
//
//   2. `/broadcast` POST endpoint: the api worker calls this from the
//      share-revoke handler to push a `share-revoked` op into the
//      room so visitors with the revoked code disconnect. A regression
//      that silently drops the broadcast leaves revoked viewers
//      reading the diagram until their next refresh.
//
// Both go without alternative coverage today (no integration test
// exercises the DO and the route-level tests stub the room entirely).
// Pinned here with a fake-WebSocket shim because constructing real
// WebSocketPair in node-vitest isn't worth the setup; the class only
// touches send / accept / addEventListener / close on its sockets.

// Minimal stub the DO interacts with. Captures sent payloads + the
// listeners it registers so each test can simulate inbound frames and
// observe the resulting outbound traffic.
type FakeSocket = {
  send: (data: string) => void;
  accept: () => void;
  addEventListener: (type: string, listener: (event: { data?: string }) => void) => void;
  sent: string[];
  listeners: Record<string, ((event: { data?: string }) => void)[]>;
  // Toggle to make the next `send()` throw, mimicking a closed WS so
  // the DO's dead-session cleanup branch can be exercised.
  failSend?: boolean;
};

function makeSocket(): FakeSocket {
  const sent: string[] = [];
  const listeners: Record<string, ((event: { data?: string }) => void)[]> = {};
  const socket: FakeSocket = {
    sent,
    listeners,
    send: (data) => {
      if (socket.failSend) throw new Error('socket closed');
      sent.push(data);
    },
    accept: () => {},
    addEventListener: (type, listener) => {
      (listeners[type] ??= []).push(listener);
    },
  };
  return socket;
}

function newRoom(): DiagramRoom {
  // DurableObjectState isn't read anywhere in the class body (only
  // stored), so a bare cast suffices for unit coverage.
  return new DiagramRoom({} as never);
}

function presence(id: string, role?: 'edit' | 'view'): ParticipantPresence {
  return { id, name: `Name ${id}`, color: '#abc', role };
}

describe('DiagramRoom /broadcast endpoint', () => {
  it('fans the op out to every connected session with from: "system"', async () => {
    const room = newRoom();
    const a = makeSocket();
    const b = makeSocket();
    room.sessions.set(a as unknown as WebSocket, presence('p-a', 'edit'));
    room.sessions.set(b as unknown as WebSocket, presence('p-b', 'view'));

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
    const room = newRoom();
    const res = await room.fetch(
      new Request('https://room/broadcast', { method: 'POST', body: 'not json at all' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when the body parses but is missing the op field', async () => {
    const room = newRoom();
    const res = await room.fetch(
      new Request('https://room/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ somethingElse: true }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('drops dead sessions on broadcast when their send throws', () => {
    const room = newRoom();
    const live = makeSocket();
    const dead = makeSocket();
    dead.failSend = true;
    room.sessions.set(live as unknown as WebSocket, presence('p-live'));
    room.sessions.set(dead as unknown as WebSocket, presence('p-dead'));

    room.broadcastSystemOp({ kind: 'share-revoked', code: 'X' });

    expect(live.sent).toHaveLength(1);
    expect(room.sessions.has(live as unknown as WebSocket)).toBe(true);
    // The dead session is reaped so a second broadcast doesn't re-throw.
    expect(room.sessions.has(dead as unknown as WebSocket)).toBe(false);
  });
});

describe('DiagramRoom non-WebSocket upgrades', () => {
  it('rejects plain HTTP requests on the WS path with 426', async () => {
    const room = newRoom();
    const res = await room.fetch(new Request('https://room/ws'));
    expect(res.status).toBe(426);
  });
});

describe('DiagramRoom hello frame role forcing', () => {
  it('overrides whatever role the client claims with the server-resolved role', () => {
    const room = newRoom();
    const ws = makeSocket();
    // The api worker forwards X-Verified-Role='view' when the visitor
    // joined with a view-only share code; the DO reads it and stamps
    // it onto presence regardless of what the client claims below.
    room.handleSession(ws as unknown as WebSocket, 'view');

    // Client tries to claim 'edit' (the spoof attempt that justified
    // the role-forcing in the first place).
    const handler = ws.listeners['message']?.[0];
    expect(handler).toBeDefined();
    handler!({
      data: JSON.stringify({
        kind: 'hello',
        participant: { id: 'lying-peer', name: 'L', color: '#000', role: 'edit' },
      }),
    });

    const stored = room.sessions.get(ws as unknown as WebSocket);
    expect(stored?.role).toBe('view');
    // The client-claimed id is replaced by a server-assigned ephemeral id
    // (spec/61 §6), so the spoofed value never reaches presence.
    expect(stored?.id).not.toBe('lying-peer');
    expect(stored?.id).toBeTruthy();
  });

  it('replaces the client participant id with a server-assigned ephemeral id', () => {
    const room = newRoom();
    const ws = makeSocket();
    // The DO assigns each session a fresh ephemeral presence id (spec/61 §6):
    // the real owner id is never broadcast, and a client can't impersonate
    // another peer because its claimed id is discarded.
    room.handleSession(ws as unknown as WebSocket, 'edit');

    ws.listeners['message']?.[0]?.({
      data: JSON.stringify({
        kind: 'hello',
        participant: { id: 'victim-peer-id', name: 'L', color: '#000' },
      }),
    });

    const stored = room.sessions.get(ws as unknown as WebSocket);
    expect(stored?.id).not.toBe('victim-peer-id');
    expect(stored?.id).toBeTruthy();
  });

  it('leaves role undefined when the upgrade carried no X-Verified-Role', () => {
    const room = newRoom();
    const ws = makeSocket();
    room.handleSession(ws as unknown as WebSocket);

    ws.listeners['message']?.[0]?.({
      data: JSON.stringify({
        kind: 'hello',
        participant: { id: 'p', name: 'P', color: '#fff', role: 'edit' },
      }),
    });

    const stored = room.sessions.get(ws as unknown as WebSocket);
    // Owner sessions (no share code, just X-Owner-Id match) intentionally
    // arrive with no verified role; the editor surfaces no peer badge
    // for them rather than defaulting to 'edit', so this null case
    // matters and is the reason `role` is optional on presence.
    expect(stored?.role).toBeUndefined();
  });

  it('forwards op messages to peers but never echoes back to the sender', () => {
    const room = newRoom();
    const sender = makeSocket();
    const peer = makeSocket();
    room.handleSession(sender as unknown as WebSocket, 'edit');
    room.handleSession(peer as unknown as WebSocket, 'view');

    // Sender introduces itself; the peer must be in the session map
    // already (handleSession seeds it as null) so the op handler can
    // find a recipient. The hello also registers `sender` properly so
    // the op handler can derive a non-null `from`.
    sender.listeners['message']?.[0]?.({
      data: JSON.stringify({
        kind: 'hello',
        participant: { id: 'sender', name: 'S', color: '#abc' },
      }),
    });
    peer.listeners['message']?.[0]?.({
      data: JSON.stringify({
        kind: 'hello',
        participant: { id: 'peer', name: 'P', color: '#def' },
      }),
    });

    // Reset captured frames AFTER the hello presence broadcasts so the
    // op assertions below don't conflate the two payload kinds.
    sender.sent.length = 0;
    peer.sent.length = 0;

    sender.listeners['message']?.[0]?.({
      data: JSON.stringify({ kind: 'op', op: { kind: 'cursor', tabId: 't', x: 1, y: 2 } }),
    });

    // Sender must not see its own op (echo would re-render its cursor
    // for itself, and worse, fight with whatever local-first state the
    // editor already applied optimistically).
    expect(sender.sent).toHaveLength(0);
    expect(peer.sent).toHaveLength(1);
    const payload = JSON.parse(peer.sent[0]!);
    expect(payload.kind).toBe('op');
    // `from` is the sender's server-assigned ephemeral id (not the claimed
    // 'sender'), so peers still get a stable per-session attribution key.
    const senderId = room.sessions.get(sender as unknown as WebSocket)?.id;
    expect(payload.from).toBe(senderId);
    expect(payload.from).not.toBe('sender');
  });

  it('ignores op messages from a session that never sent hello', () => {
    const room = newRoom();
    const ws = makeSocket();
    const peer = makeSocket();
    room.handleSession(ws as unknown as WebSocket, 'edit');
    room.handleSession(peer as unknown as WebSocket, 'edit');

    ws.listeners['message']?.[0]?.({
      data: JSON.stringify({ kind: 'op', op: { kind: 'cursor', tabId: 't', x: 0, y: 0 } }),
    });

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
    room.handleSession(ws as unknown as WebSocket, role);
    const handler = ws.listeners['message']![0]!;
    handler({
      data: JSON.stringify({ kind: 'hello', participant: { id, name: id, color: '#000' } }),
    });
    return {
      ws,
      sendOp: () =>
        handler({ data: JSON.stringify({ kind: 'op', op: { kind: 'move', id, x: 1 } }) }),
    };
  }

  function opsReceived(ws: FakeSocket): unknown[] {
    return ws.sent.map((s) => JSON.parse(s)).filter((m) => m.kind === 'op');
  }

  it('relays an op from an edit-role session to peers', () => {
    const room = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const viewer = connect(room, 'viewer', 'view');
    editor.ws.sent.length = 0;
    viewer.ws.sent.length = 0;

    editor.sendOp();

    expect(opsReceived(viewer.ws)).toHaveLength(1);
  });

  it('drops an op from a view-role session so it never reaches peers', () => {
    const room = newRoom();
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
    const room = newRoom();
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
      const room = newRoom();
      const editor = connect(room, 'editor', 'edit');
      const viewer = connect(room, 'viewer', 'view');
      editor.ws.sent.length = 0;

      viewer.ws.listeners['message']![0]!({
        data: JSON.stringify({ kind: 'op', op: { kind, tabId: 't', x: 1, y: 2 } }),
      });

      expect(opsReceived(editor.ws)).toHaveLength(1);
    });
  }

  it('still drops a mutation op from a view-role session', () => {
    const room = newRoom();
    const editor = connect(room, 'editor', 'edit');
    const viewer = connect(room, 'viewer', 'view');
    editor.ws.sent.length = 0;

    // A view-only visitor must not inject canvas edits into peers.
    viewer.ws.listeners['message']![0]!({
      data: JSON.stringify({ kind: 'op', op: { kind: 'tab', tabId: 't', tab: {} } }),
    });

    expect(opsReceived(editor.ws)).toHaveLength(0);
  });
});

describe('DiagramRoom tab-focus presence echo', () => {
  // A late joiner only gets the presence list, never the tab-focus ops
  // that fired before they connected. So the room must remember each
  // session's current tab and echo it in presence, or joiners default
  // existing peers to the first tab until they next switch (the bug).
  it("remembers a session's tab-focus and echoes it in later presence frames", () => {
    const room = newRoom();
    const a = makeSocket();
    room.handleSession(a as unknown as WebSocket, 'edit');
    const aHandler = a.listeners['message']![0]!;
    aHandler({
      data: JSON.stringify({ kind: 'hello', participant: { id: 'p-a', name: 'A', color: '#abc' } }),
    });
    aHandler({ data: JSON.stringify({ kind: 'op', op: { kind: 'tab-focus', tabId: 'tab-2' } }) });

    // Stored on the session presence so future broadcasts carry it.
    expect(room.sessions.get(a as unknown as WebSocket)?.tabId).toBe('tab-2');

    // A second peer joining triggers a presence broadcast; the frame it
    // receives must report A on tab-2, not the first-tab default.
    const b = makeSocket();
    room.handleSession(b as unknown as WebSocket, 'edit');
    b.listeners['message']![0]!({
      data: JSON.stringify({ kind: 'hello', participant: { id: 'p-b', name: 'B', color: '#def' } }),
    });
    // A's broadcast id is its server-assigned ephemeral id (spec/61 §6), not
    // the claimed 'p-a' — find its row by the stored id.
    const aId = room.sessions.get(a as unknown as WebSocket)?.id;
    const presenceFrames = b.sent.map((s) => JSON.parse(s)).filter((m) => m.kind === 'presence');
    const aRow = presenceFrames.at(-1)!.participants.find((p: { id: string }) => p.id === aId);
    expect(aRow?.tabId).toBe('tab-2');
  });
});
