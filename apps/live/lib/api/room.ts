// Realtime room (WebSocket) connection.
//
// Wire-format types for room messages (`RoomOp`, `RoomOutgoing`,
// `RoomIncoming`) live in `@livediagram/api-schema` so the editor and
// (eventually) any other client share one definition. `RoomHandlers`
// below is the client-side callback shape only — not on the wire —
// so it stays here next to the connect helper.
import {
  isMutationOpKind,
  type ParticipantPresence,
  type FacilitatorReason,
  type RoomIncoming,
  type RoomOp,
  type RoomOutgoing,
} from '@livediagram/api-schema';
import { opForTheWire } from '@livediagram/diagram';
import { getSessionSharePassword, wsUrl } from './core';

export type RoomHandlers = {
  onPresence: (participants: ParticipantPresence[]) => void;
  onOp: (from: string, op: RoomOp) => void;
  // Who holds the facilitator baton (spec/149), and the token when it is
  // ours. Arrives on every change and once on connect with reason 'state'.
  onFacilitator?: (msg: {
    holder: string | null;
    by?: string;
    reason: FacilitatorReason;
    token?: string;
  }) => void;
  // The facilitator has freed an element we were holding (spec/07 lock). Sent
  // to this socket alone, so being called IS the addressing — there is no id to
  // check against our own, which we do not know (spec/61 §6).
  onSelectionReleased?: (msg: { elementId: string; by: string }) => void;
  onClose?: () => void;
  // The room could not bridge our reconnect gap from its op log (spec/75,
  // Level 1): we're too far behind, or it restarted. The caller re-hydrates
  // from D1 (the same recovery the error boundary uses — a full reload).
  onResync?: () => void;
};

// Auth identifiers the connector rides on the room WebSocket URL.
type RoomAuthOptions = {
  shareCode?: string | null;
  ownerId?: string | null;
  // One-time room ticket (spec/11), minted over authenticated REST via
  // apiCreateRoomTicket. The only leg that can admit a team member —
  // the worker doesn't trust a bare `o` for team membership.
  ticket?: string | null;
};

// Build the room WebSocket auth query string. Browsers can't set custom
// headers on a WebSocket upgrade, so these ride on the query string; the
// api worker reads them, resolves role, and forwards an X-Verified-Role
// header to the Durable Object before the upgrade reaches it. Empty /
// missing values are stripped so the URL stays clean.
//   - `t` one-time room ticket (spec/11) — proof the connector passed
//     the authenticated REST access gates moments ago; required for
//     team diagrams, where a bare owner id is not trusted.
//   - `s` share code, `o` owner id (for diagrams the visitor owns)
//   - `p` share password (spec/24) for a protected diagram's room.
// (A `g` guest-signature param used to ride along for presence-identity
// binding; the DO switched to server-random ephemeral presence ids —
// spec/61 §6 — and the server-side read was removed, so the client
// stopped sending it.)
// Pure (sharePassword passed in) so the param mapping is unit-tested.
export function roomQueryString(options: RoomAuthOptions, sharePassword: string | null): string {
  const params = new URLSearchParams();
  if (options.ticket) params.set('t', options.ticket);
  if (options.shareCode) params.set('s', options.shareCode);
  if (options.ownerId) params.set('o', options.ownerId);
  if (sharePassword) params.set('p', sharePassword);
  return params.toString();
}

// Reconnect backoff: a dropped socket auto-reopens so a brief network blip
// doesn't silently end a collaborative session. Capped attempts + capped
// delay so a hard-rejected upgrade (revoked share, lost membership) stops
// retrying rather than hammering the worker forever.
const MAX_RECONNECT_ATTEMPTS = 6;

// Ops held while the socket is down (spec/152). A change made in that window
// used to be dropped on the floor: the save still carried it to D1, but no
// peer saw it until they reloaded, and a dot or an answer never reached the
// room's ledger at all. Only what changes the diagram or a poll is held: a
// cursor or a selection from a minute ago means nothing. Bounded, so a long
// outage can't grow it without end; past the bound, newer ops are dropped
// and the next save still carries the state to D1.
const OUTBOX_MAX = 500;
export function isOutboxOp(msg: RoomOutgoing): boolean {
  if (msg.kind !== 'op') return false;
  const kind = (msg.op as { kind?: unknown }).kind;
  return kind === 'poll-answer' || isMutationOpKind(kind);
}
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 15_000;

export function connectRoom(
  diagramId: string,
  // `key` is the document-write id (spec/122), relayed to peers verbatim so
  // an answer saved on the diagram can be joined back to the person in the
  // roster. The room OVERRIDES `id` with its own per-socket presence id
  // (spec/61 §6), which is why the two are separate fields.
  participant: { id: string; key?: string; name: string; color: string },
  handlers: RoomHandlers,
  options: RoomAuthOptions = {},
  // Read at every (re)connect rather than captured once: the baton can be
  // taken while this socket is open, and the token we present has to be the
  // one we hold NOW (spec/149).
  readFacilitatorToken?: () => string | null,
): {
  send: (msg: RoomOutgoing) => void;
  close: () => void;
  cursor: () => { epoch: string; seq: number } | null;
} {
  // Auth identifiers ride on the query string (see roomQueryString). The
  // share password is read from the same session state apiHeaders uses, so
  // the editor doesn't have to thread it through; owners never have it set.
  const qs = roomQueryString(options, getSessionSharePassword());
  const url = wsUrl(`/diagrams/${diagramId}/ws${qs ? `?${qs}` : ''}`);

  let ws: WebSocket;
  let closed = false; // the caller called close() — never reconnect after that
  let opened = false; // we've had at least one successful session (→ reconnects sync)
  let attempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Ordering cursor for reconnect catch-up (spec/75, Level 1): the last
  // epoch + seq we applied off an ordered op. On reopen we hand these to the
  // room, which replays what we missed or tells us to re-hydrate.
  let lastEpoch: string | null = null;
  let lastSeq = 0;
  // See OUTBOX_MAX. Flushed, in order, once a (re)opened socket has said
  // hello and asked for what it missed.
  let outbox: RoomOutgoing[] = [];

  const applyOp = (from: string, op: RoomOp, seq?: number, epoch?: string) => {
    if (typeof seq === 'number') lastSeq = seq;
    if (typeof epoch === 'string') lastEpoch = epoch;
    handlers.onOp(from, op);
  };

  const open = () => {
    ws = new WebSocket(url);
    ws.addEventListener('open', () => {
      attempts = 0;
      // The baton coming home (spec/149): on a reconnect this is what tells
      // the room we are the same facilitator it granted before the refresh.
      const facilitatorToken = readFacilitatorToken?.();
      ws.send(
        JSON.stringify({
          kind: 'hello',
          participant,
          ...(facilitatorToken ? { facilitatorToken } : {}),
        } satisfies RoomOutgoing),
      );
      // A reconnect (not the first open): ask the room for the ops we missed
      // while we were gone before resuming live traffic.
      if (opened) {
        ws.send(JSON.stringify({ kind: 'sync', epoch: lastEpoch, lastSeq } satisfies RoomOutgoing));
      }
      opened = true;
      const held = outbox;
      outbox = [];
      for (const msg of held) ws.send(JSON.stringify(msg));
    });
    ws.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data) as RoomIncoming;
        if (msg.kind === 'presence') handlers.onPresence(msg.participants);
        else if (msg.kind === 'facilitator') handlers.onFacilitator?.(msg);
        else if (msg.kind === 'selection-released') handlers.onSelectionReleased?.(msg);
        else if (msg.kind === 'op') applyOp(msg.from, msg.op, msg.seq, msg.epoch);
        else if (msg.kind === 'cursor') {
          // Our own op's seq, or where the stream stood when we joined. A
          // different epoch is a restarted room: leave the cursor for the
          // sync / catchup exchange to reconcile.
          if (lastEpoch === null || lastEpoch === msg.epoch) {
            lastEpoch = msg.epoch;
            if (msg.seq > lastSeq) lastSeq = msg.seq;
          }
        } else if (msg.kind === 'catchup') {
          if (msg.resync) {
            // Adopt the room's cursor first so we don't loop on the same
            // gap, then hand off to the caller's full re-hydrate.
            lastEpoch = msg.epoch;
            lastSeq = msg.seq;
            handlers.onResync?.();
          } else {
            for (const o of msg.ops) applyOp(o.from, o.op, o.seq, msg.epoch);
            lastEpoch = msg.epoch;
            if (msg.seq > lastSeq) lastSeq = msg.seq;
          }
        }
      } catch {
        // Malformed frame — ignore. Production would log here.
      }
    });
    ws.addEventListener('close', () => {
      handlers.onClose?.();
      if (closed) return;
      if (attempts >= MAX_RECONNECT_ATTEMPTS) return;
      const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempts);
      attempts++;
      reconnectTimer = setTimeout(open, delay);
    });
  };
  open();

  return {
    send: (raw) => {
      // No comment author id leaves this browser: it is its author's owner
      // id, a guest's credential, and the room hands every op to every socket
      // (spec/152). One choke point for every send path.
      const msg: RoomOutgoing =
        raw.kind === 'op' ? { ...raw, op: opForTheWire(raw.op) as RoomOp } : raw;
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      else if (!closed && isOutboxOp(msg) && outbox.length < OUTBOX_MAX) outbox.push(msg);
    },
    // Where this client stands in the room's ordered stream, for a save to
    // tell the api what it has seen (spec/152 phase 3). Null while the socket
    // is down: a save made then is not merged with the room's ledger, because
    // what the client changed offline must not be overruled by the room.
    cursor: (): { epoch: string; seq: number } | null =>
      ws.readyState === WebSocket.OPEN && lastEpoch !== null
        ? { epoch: lastEpoch, seq: lastSeq }
        : null,
    close: () => {
      closed = true;
      outbox = [];
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      ws.close();
    },
  };
}
