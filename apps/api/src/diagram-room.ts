import type { ClientMessage, ParticipantPresence, ServerMessage } from './types';

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
// Max ops a single session may broadcast per 1s window. Far above any
// legit client (cursor / laser broadcasts are throttled to a few dozen
// per second), so this only ever bites a flood.
const OP_RATE_CAP = 240;

// Max size (chars) of a single inbound WebSocket frame. A cursor / select /
// op frame is well under this; the cap stops a socket from broadcasting a
// huge payload to every peer in the room.
const MAX_MESSAGE_CHARS = 256 * 1024;

export class DiagramRoom implements DurableObject {
  state: DurableObjectState;
  // `sessions` is keyed by WebSocket; the value is the most recent
  // ParticipantPresence the client identified itself with via `hello`.
  // Null means "connected but hasn't said hello yet" — those clients
  // receive presence but aren't included in the presence list.
  sessions: Map<WebSocket, ParticipantPresence | null> = new Map();
  // Per-session op-rate window (sliding 1s) so one connected peer can't
  // flood the room. Legit cursor / laser / edit ops are client-throttled
  // well under the cap; over-cap ops are silently dropped, not a
  // disconnect, so a brief burst just thins rather than kicking the peer.
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
    // never directly. Stashed per-session so the hello-handler can
    // re-stamp role onto the broadcast presence, defeating a crafted
    // client that lies in its own hello payload.
    const headerRole = request.headers.get('X-Verified-Role');
    const verifiedRole: 'edit' | 'view' | undefined =
      headerRole === 'edit' || headerRole === 'view' ? headerRole : undefined;
    this.handleSession(server, verifiedRole);
    return new Response(null, { status: 101, webSocket: client });
  }

  // Fan an op out to every connected client without a sender. Used
  // for server-originated events (share-link revoked, owner-side
  // forced disconnects). Senders aren't excluded because the
  // originator is the worker itself, not any of the connected peers.
  // Serialize once and send to every connected session (optionally excluding
  // one, e.g. the op's originator). A send that throws means a dead socket, so
  // drop it from the map. The single place that reaps failed sockets.
  broadcast(payload: ServerMessage, except?: WebSocket): void {
    const serialized = JSON.stringify(payload);
    for (const ws of this.sessions.keys()) {
      if (ws === except) continue;
      try {
        ws.send(serialized);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }

  broadcastSystemOp(op: unknown): void {
    // System ops broadcast to ALL peers: the originator is the worker itself,
    // not any connected session, so nobody is excluded.
    this.broadcast({ kind: 'op', from: 'system', op });
  }

  handleSession(ws: WebSocket, verifiedRole?: 'edit' | 'view'): void {
    ws.accept();
    this.sessions.set(ws, null);
    // Per-session ephemeral presence id (spec/61 §6): the broadcast presence /
    // cursor id is a fresh server-assigned random, NOT the connector's real
    // owner id — so a co-present collaborator (incl. a view-only share
    // visitor) never reads an owner id off a presence frame. Being
    // server-random it ALSO defeats presence impersonation: a joiner can't
    // claim another peer's id because it never sees or sets one.
    const presenceId = crypto.randomUUID();

    ws.addEventListener('message', (event) => {
      // Drop an oversized frame before parsing / broadcasting it: ops are
      // re-broadcast opaquely to every peer, so without a cap one socket
      // could fan a multi-MB payload out to the whole room. Far above any
      // real cursor / select / op frame.
      const raw = typeof event.data === 'string' ? event.data : '';
      if (raw.length > MAX_MESSAGE_CHARS) return;
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw) as ClientMessage;
      } catch {
        return;
      }
      if (msg.kind === 'hello') {
        // Force the server-resolved role AND the server-assigned ephemeral id
        // onto the stored presence: the hello frame's own `role` / `id` are
        // not trusted. The id override hides the real owner id (spec/61 §6)
        // and stops a joiner impersonating another peer; the role override is
        // the Viewer / Editor lie-defence.
        this.sessions.set(ws, {
          ...msg.participant,
          id: presenceId,
          role: verifiedRole,
        });
        this.broadcastPresence();
        return;
      }
      if (msg.kind === 'op') {
        const sender = this.sessions.get(ws);
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
        const isPresenceOp =
          opKind === 'cursor' ||
          opKind === 'select' ||
          opKind === 'laser' ||
          opKind === 'tab-focus';
        if (sender.role !== 'edit' && !isPresenceOp) return;
        // Per-session op-rate cap (sliding 1s window) — drop over-cap ops.
        const now = Date.now();
        const rate = this.opRates.get(ws);
        if (!rate || now - rate.windowStart >= 1000) {
          this.opRates.set(ws, { count: 1, windowStart: now });
        } else if (rate.count >= OP_RATE_CAP) {
          return;
        } else {
          rate.count++;
        }
        // Remember the sender's current tab so a future joiner learns it
        // from the presence list (tab-focus ops only fire on a switch, so
        // they're invisible to anyone who joins afterwards). Stored on the
        // session presence; the live relay below still drives real-time
        // updates for peers already connected.
        if (opKind === 'tab-focus') {
          const tabId = (msg.op as { tabId?: unknown }).tabId;
          if (typeof tabId === 'string') sender.tabId = tabId;
        }
        // Relay to every OTHER peer (exclude the sender — they already have it).
        this.broadcast({ kind: 'op', from: sender.id, op: msg.op }, ws);
      }
    });

    const close = () => {
      this.sessions.delete(ws);
      this.opRates.delete(ws);
      this.broadcastPresence();
    };
    ws.addEventListener('close', close);
    ws.addEventListener('error', close);
  }

  broadcastPresence(): void {
    const participants: ParticipantPresence[] = [];
    for (const p of this.sessions.values()) {
      if (p) participants.push(p);
    }
    this.broadcast({ kind: 'presence', participants });
  }
}
