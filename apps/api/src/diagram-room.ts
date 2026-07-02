import type { ClientMessage, ParticipantPresence, ServerMessage } from './types';
import { MAX_COLOR_LEN, MAX_PARTICIPANT_NAME_LEN } from './limits';

// One Durable Object instance per diagram id. Holds the set of currently
// connected WebSockets plus their participant identity, and broadcasts
// presence + op messages so every client sees what every other client is
// doing in real time.
//
// Conflict model: last-writer-wins. Ops are not persisted here; they're
// shaped opaquely (`op: unknown`) so the editor can evolve its
// vocabulary without changing the room. Persistence happens through the
// REST endpoints separately — clients save the full diagram snapshot
// after their local mutation lands. The room is only responsible for
// propagation.
//
// WebSocket HIBERNATION (why this shape): sockets are accepted via
// `state.acceptWebSocket()` and events arrive through the class-level
// `webSocketMessage` / `webSocketClose` / `webSocketError` handlers
// instead of per-socket `addEventListener`. That lets the runtime evict
// the DO from memory between messages while keeping every client's
// WebSocket open — an idle room (people connected, nobody moving a
// cursor) stops accruing duration billing instead of pinning the DO
// for the life of the longest session. The trade-offs this forces:
//
//   - Per-session state must survive eviction, so it lives in each
//     socket's serialized attachment (see SessionAttachment below),
//     not in an in-memory Map keyed by socket.
//   - Anything left in memory silently resets when the DO hibernates
//     and wakes (the constructor re-runs). Only `opRates` lives there,
//     and that reset is deliberately acceptable — see its comment.
//   - No `setWebSocketAutoResponse` ping/pong is configured: the room's
//     wire protocol (room-messages.ts) has no keepalive frame and the
//     live client doesn't send one, so there's nothing to auto-answer.

// Max ops a single session may broadcast per 1s window. Far above any
// legit client (cursor / laser broadcasts are throttled to a few dozen
// per second), so this only ever bites a flood.
const OP_RATE_CAP = 240;

// Max size (chars) of a single inbound WebSocket frame. A cursor / select /
// op frame is well under this; the cap stops a socket from broadcasting a
// huge payload to every peer in the room.
const MAX_MESSAGE_CHARS = 256 * 1024;

// Length clamp on the tab id we persist into the attachment from hello /
// tab-focus frames. Real tab ids are UUIDs (36 chars); the clamp only
// exists so a hostile frame can't balloon the attachment (see the size
// note on SessionAttachment).
const MAX_TAB_ID_LEN = 128;

// Everything the room knows about one session, persisted in the socket's
// serialized attachment so it SURVIVES HIBERNATION (an in-memory Map
// would silently lose it on eviction, wiping roles and presence for
// every connected peer):
//
//   - `presenceId`: the server-assigned ephemeral presence id
//     (spec/61 §6), minted once at upgrade time.
//   - `verifiedRole`: the server-resolved role from X-Verified-Role —
//     the trust boundary. It must never be re-derivable from anything
//     the client sends, so it's captured at the upgrade and pinned here.
//   - `presence`: the participant identity published via `hello` (with
//     id / role force-stamped from the two fields above), including the
//     `tabId` updated on every tab-focus op. `null` means "connected
//     but hasn't said hello yet" — those clients receive presence but
//     aren't included in the presence list.
//
// Size: serializeAttachment enforces a small per-socket limit (2 KB
// historically). Worst case here is presenceId (36) + role (4) + a
// name clamped to MAX_PARTICIPANT_NAME_LEN (120) + a color clamped to
// MAX_COLOR_LEN (64) + a tabId clamped to MAX_TAB_ID_LEN (128) — a few
// hundred bytes, comfortably under the limit. The clamps are what make
// that bound hold: hello payloads arrive straight off the wire, so
// without them a hostile frame could make serializeAttachment throw.
type SessionAttachment = {
  presenceId: string;
  verifiedRole?: 'edit' | 'view';
  presence: ParticipantPresence | null;
};

export class DiagramRoom implements DurableObject {
  state: DurableObjectState;
  // Per-session op-rate window (sliding 1s) so one connected peer can't
  // flood the room. Legit cursor / laser / edit ops are client-throttled
  // well under the cap; over-cap ops are silently dropped, not a
  // disconnect, so a brief burst just thins rather than kicking the peer.
  //
  // Deliberately in-memory (NOT in the attachment): hibernation resets it,
  // which merely re-opens a fresh 1s window on wake — the cap is a flood
  // gate, not an accounting ledger, and a flood keeps the DO awake anyway
  // so the window never resets mid-flood. Persisting it would add an
  // attachment write per frame for nothing. Entries are cleaned on
  // close / error / dead-send so the map can't leak across a long-lived
  // in-memory period.
  opRates: Map<WebSocket, { count: number; windowStart: number }> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // Internal fan-out endpoint, called by the api worker after a
    // privileged action that every connected client should learn
    // about immediately (e.g. share-link revocation). Not exposed
    // publicly: the worker stubs the DO via `env.DIAGRAM_ROOM.get(...)
    // .fetch(...)`, which never traverses Cloudflare's edge, so the
    // path is implicitly internal. Body is `{ op: RoomOp }` and the
    // op gets broadcast with a synthetic `from: 'system'` so the
    // frontend handler can distinguish it from a peer's op.
    if (request.method === 'POST' && url.pathname === '/broadcast') {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response('bad json', { status: 400 });
      }
      const op = (body as { op?: unknown }).op;
      if (!op) return new Response('missing op', { status: 400 });
      this.broadcastSystemOp(op);
      return new Response(null, { status: 204 });
    }
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    // WebSocketPair is a 2-property record keyed `0`/`1`. The "client"
    // side is returned to the connecting peer; the "server" side is
    // owned by this Durable Object.
    const client = pair[0]!;
    const server = pair[1]!;
    // Server-resolved role (set by the api worker before forwarding the
    // upgrade). The DO trusts this header because only the worker can
    // set it: clients reach the DO via env.DIAGRAM_ROOM.get(...).fetch,
    // never directly. Persisted into the session attachment so the
    // hello-handler can re-stamp role onto the broadcast presence even
    // after a hibernation cycle, defeating a crafted client that lies
    // in its own hello payload.
    const headerRole = request.headers.get('X-Verified-Role');
    const verifiedRole: 'edit' | 'view' | undefined =
      headerRole === 'edit' || headerRole === 'view' ? headerRole : undefined;
    this.acceptSession(server, verifiedRole);
    return new Response(null, { status: 101, webSocket: client });
  }

  // Admit one server-side socket into the room: pin its hibernation-proof
  // session state (attachment) and hand it to the runtime. Split out of
  // fetch so tests can drive sessions without constructing WebSocketPair.
  acceptSession(ws: WebSocket, verifiedRole?: 'edit' | 'view'): void {
    // Per-session ephemeral presence id (spec/61 §6): the broadcast presence /
    // cursor id is a fresh server-assigned random, NOT the connector's real
    // owner id — so a co-present collaborator (incl. a view-only share
    // visitor) never reads an owner id off a presence frame. Being
    // server-random it ALSO defeats presence impersonation: a joiner can't
    // claim another peer's id because it never sees or sets one.
    ws.serializeAttachment({
      presenceId: crypto.randomUUID(),
      verifiedRole,
      presence: null,
    } satisfies SessionAttachment);
    // Hibernation-aware accept: the runtime owns the socket's event
    // delivery (webSocketMessage / webSocketClose / webSocketError) and
    // may evict this DO between events. NOT ws.accept(), which would pin
    // the DO in memory for the socket's whole life.
    this.state.acceptWebSocket(ws);
  }

  // Read a socket's session attachment. Null means "not a session we
  // admitted" (or a corrupt attachment) — frames from it are dropped.
  private readSession(ws: WebSocket): SessionAttachment | null {
    try {
      return (ws.deserializeAttachment() as SessionAttachment | null) ?? null;
    } catch {
      return null;
    }
  }

  // Fan an op out to every connected client without a sender. Used
  // for server-originated events (share-link revoked, owner-side
  // forced disconnects). Senders aren't excluded because the
  // originator is the worker itself, not any of the connected peers.
  // Serialize once and send to every connected session (optionally excluding
  // one, e.g. the op's originator). The connected set is the runtime's
  // hibernation-managed list (`state.getWebSockets()`), which drops closed
  // sockets on its own; a send that still throws means a socket that died
  // without the runtime noticing yet, so we just shed its rate entry — the
  // runtime reaps the socket itself.
  broadcast(payload: ServerMessage, except?: WebSocket): void {
    const serialized = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(serialized);
      } catch {
        this.opRates.delete(ws);
      }
    }
  }

  broadcastSystemOp(op: unknown): void {
    // System ops broadcast to ALL peers: the originator is the worker itself,
    // not any connected session, so nobody is excluded.
    this.broadcast({ kind: 'op', from: 'system', op });
  }

  // Hibernation event handler: one inbound frame from one socket. The DO
  // may have just been re-materialized from cold — everything this needs
  // beyond flood control comes from the socket's attachment.
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    // Drop an oversized frame before parsing / broadcasting it: ops are
    // re-broadcast opaquely to every peer, so without a cap one socket
    // could fan a multi-MB payload out to the whole room. Far above any
    // real cursor / select / op frame. Binary frames aren't part of the
    // protocol and parse to nothing.
    const raw = typeof message === 'string' ? message : '';
    if (raw.length > MAX_MESSAGE_CHARS) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    // Per-session frame-rate cap (sliding 1s window) — applied to EVERY
    // parsed frame, not just ops: a legitimate client sends one `hello`
    // per connection, but each `hello` re-runs the O(N²) presence
    // fanout, so an uncapped `hello` loop was a flood path through the
    // exact door the cap was built to close.
    const now = Date.now();
    const rate = this.opRates.get(ws);
    if (!rate || now - rate.windowStart >= 1000) {
      this.opRates.set(ws, { count: 1, windowStart: now });
    } else if (rate.count >= OP_RATE_CAP) {
      return;
    } else {
      rate.count++;
    }
    const session = this.readSession(ws);
    if (!session) return;
    if (msg.kind === 'hello') {
      // Force the server-resolved role AND the server-assigned ephemeral id
      // onto the stored presence: the hello frame's own `role` / `id` are
      // not trusted. The id override hides the real owner id (spec/61 §6)
      // and stops a joiner impersonating another peer; the role override is
      // the Viewer / Editor lie-defence. Both come from the attachment, the
      // only per-session store that survives hibernation. Fields are built
      // explicitly (not spread) and length-clamped so a hostile hello can't
      // smuggle arbitrary keys or oversize strings into the attachment —
      // see the size note on SessionAttachment.
      const claimed = msg.participant ?? ({} as ParticipantPresence);
      const presence: ParticipantPresence = {
        id: session.presenceId,
        name:
          typeof claimed.name === 'string' ? claimed.name.slice(0, MAX_PARTICIPANT_NAME_LEN) : '',
        color: typeof claimed.color === 'string' ? claimed.color.slice(0, MAX_COLOR_LEN) : '',
        role: session.verifiedRole,
      };
      if (typeof claimed.tabId === 'string')
        presence.tabId = claimed.tabId.slice(0, MAX_TAB_ID_LEN);
      ws.serializeAttachment({ ...session, presence } satisfies SessionAttachment);
      this.broadcastPresence();
      return;
    }
    if (msg.kind === 'op') {
      const sender = session.presence;
      if (!sender) return;
      // Presence ops (cursor / select / laser / tab-focus) are ephemeral
      // and mutate nothing, so they relay from ANY connected session —
      // that's how a view-only visitor still shows their cursor, current
      // selection, and which tab they're on to everyone else. Mutation
      // ops (tab content, diagram-meta, change-log) stay edit-role-only:
      // a viewer must not be able to inject edits into peers' canvases.
      // The role is the server-verified one (X-Verified-Role, re-stamped
      // in hello), not anything the client claims.
      const opKind = (msg.op as { kind?: unknown } | null | undefined)?.kind;
      // System-only ops never relay from a client socket: they're
      // emitted exclusively by the worker via /broadcast (stamped
      // `from: 'system'`). Without this drop, any edit-role peer
      // could forge `share-revoked` with the code from their own URL
      // and force-redirect every collaborator out of the session.
      if (opKind === 'share-revoked') return;
      const isPresenceOp =
        opKind === 'cursor' || opKind === 'select' || opKind === 'laser' || opKind === 'tab-focus';
      if (sender.role !== 'edit' && !isPresenceOp) return;
      // Remember the sender's current tab so a future joiner learns it
      // from the presence list (tab-focus ops only fire on a switch, so
      // they're invisible to anyone who joins afterwards). Persisted to
      // the attachment — in-memory-only would forget everyone's tab on
      // the next hibernation and mis-place peers for every later joiner.
      // The live relay below still drives real-time updates for peers
      // already connected.
      if (opKind === 'tab-focus') {
        const tabId = (msg.op as { tabId?: unknown }).tabId;
        if (typeof tabId === 'string') {
          sender.tabId = tabId.slice(0, MAX_TAB_ID_LEN);
          ws.serializeAttachment({ ...session, presence: sender } satisfies SessionAttachment);
        }
      }
      // Relay to every OTHER peer (exclude the sender — they already have it).
      this.broadcast({ kind: 'op', from: sender.id, op: msg.op }, ws);
    }
  }

  // Hibernation event handlers for a session ending. The runtime removes
  // the socket from getWebSockets() itself; our job is only to shed the
  // rate window (so the map can't leak) and re-announce the roster.
  webSocketClose(ws: WebSocket): void {
    this.dropSession(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.dropSession(ws);
  }

  private dropSession(ws: WebSocket): void {
    this.opRates.delete(ws);
    // Exclude the departing socket explicitly: depending on when the
    // runtime prunes it from getWebSockets(), it could otherwise still
    // appear in the roster of this very broadcast.
    this.broadcastPresence(ws);
  }

  broadcastPresence(except?: WebSocket): void {
    // Send each client the roster MINUS its own entry. The broadcast presence
    // id is a fresh server-random per session (spec/61 §6), so a client can't
    // recognise its own entry by id to filter it out — including it makes the
    // user show up as a participant twice (once from this list, once from the
    // local self entry the editor always renders). The room is the only place
    // that knows which presence belongs to which socket, so it excludes it here.
    // Presence comes off each socket's attachment (deserialized once per
    // socket, then reused for every recipient's roster).
    const entries: [WebSocket, ParticipantPresence | null][] = [];
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      entries.push([ws, this.readSession(ws)?.presence ?? null]);
    }
    for (const [ws] of entries) {
      const others: ParticipantPresence[] = [];
      for (const [peer, presence] of entries) {
        if (peer !== ws && presence) others.push(presence);
      }
      try {
        ws.send(JSON.stringify({ kind: 'presence', participants: others } satisfies ServerMessage));
      } catch {
        // Dead socket: the runtime reaps it from getWebSockets(); we only
        // shed the in-memory rate entry so the map can't leak.
        this.opRates.delete(ws);
      }
    }
  }
}
