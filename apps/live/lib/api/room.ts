// Realtime room (WebSocket) connection.
//
// Wire-format types for room messages (`RoomOp`, `RoomOutgoing`,
// `RoomIncoming`) live in `@livediagram/api-schema` so the editor and
// (eventually) any other client share one definition. `RoomHandlers`
// below is the client-side callback shape only — not on the wire —
// so it stays here next to the connect helper.
import {
  ACCESS_CHANGED_CLOSE,
  DOCUMENT_TRASHED_CLOSE,
  isMutationOpKind,
  WORKBENCH_ENDED_CLOSE,
  type AgentPresence,
  type ParticipantPresence,
  type FacilitatorReason,
  type RoomIncoming,
  type RoomOp,
  type RoomOutgoing,
} from '@livediagram/api-schema';
import { opForTheWire } from '@livediagram/document';
import { splitPresenceFrame } from '../agent-presence-rows';
import { noteServerBuild, noteServerDocumentFormat } from '../server-release';
import { getGuestSelfSig } from '../local-identity';
import { getSessionSharePassword, wsUrl } from './core';

export type RoomHandlers = {
  // The room's agents arrive apart from the sessions (docs/specs/024-agents/agent-presence.md "In the editor").
  onPresence: (participants: ParticipantPresence[], agents: AgentPresence[]) => void;
  onOp: (from: string, op: RoomOp) => void;
  // Who holds the facilitator baton (docs/specs/012-collaboration/facilitator.md), and the token when it is
  // ours. Arrives on every change and once on connect with reason 'state'.
  onFacilitator?: (msg: {
    holder: string | null;
    by?: string;
    reason: FacilitatorReason;
    token?: string;
  }) => void;
  // The facilitator has freed an element we were holding (docs/specs/007-editor/live-app.md lock). Sent
  // to this socket alone, so being called IS the addressing — there is no id to
  // check against our own, which we do not know (docs/specs/015-api/public-api-and-tokens.md §6).
  onSelectionReleased?: (msg: { elementId: string; by: string }) => void;
  onClose?: () => void;
  // The document went to the Trash (docs/specs/013-workspace/trash.md): the room
  // closed this socket with DOCUMENT_TRASHED_CLOSE and will refuse every
  // reconnect, so the connector stops and says so, once.
  onDocumentTrashed?: () => void;
  // An access change ended this session (docs/specs/015-api/api.md "Access changes end the sessions
  // they affect"): a share password was set, or the member left the document's team. The room
  // closed it with ACCESS_CHANGED_CLOSE; the connector stops, and the caller reloads into the
  // ordinary access path (a password prompt, a refusal page, or the editor again).
  onAccessChanged?: () => void;
  // A workbench session's pairing or token ended (docs/specs/013-workspace/workbench-embeds.md): the
  // room closed it with WORKBENCH_ENDED_CLOSE; the connector stops and the page turns read-only.
  onWorkbenchEnded?: () => void;
  // The room refused to open this connection (it closed before ever opening): the join was turned away
  // at the upgrade, which the browser reports only as an abnormal close. The caller finds out why over
  // REST, which names a trashed document (docs/specs/013-workspace/trash.md). Retrying carries on as usual.
  onRefused?: () => void;
  // The room could not bridge our reconnect gap from its op log (docs/specs/012-collaboration/realtime-conflict-resolution.md,
  // Level 1): we're too far behind, or it restarted. The caller re-hydrates
  // from D1 (the same recovery the error boundary uses — a full reload).
  onResync?: () => void;
};

// Auth identifiers the connector rides on the room WebSocket URL.
type RoomAuthOptions = {
  shareCode?: string | null;
  ownerId?: string | null;
  // The guest signature for `ownerId` (X-Owner-Sig over REST); filled in by
  // connectRoom from the stored self signature, never by callers.
  ownerSig?: string | null;
  // One-time room ticket (docs/specs/015-api/api.md), minted over authenticated REST via
  // apiCreateRoomTicket. The only leg that can admit a team member —
  // the worker doesn't trust a bare `o` for team membership.
  ticket?: string | null;
};

// Build the room WebSocket auth query string. Browsers can't set custom
// headers on a WebSocket upgrade, so these ride on the query string; the
// api worker reads them, resolves role, and forwards an X-Verified-Role
// header to the Durable Object before the upgrade reaches it. Empty /
// missing values are stripped so the URL stays clean.
//   - `t` one-time room ticket (docs/specs/015-api/api.md) — proof the connector passed
//     the authenticated REST access gates moments ago; required for
//     team documents, where a bare owner id is not trusted.
//   - `s` share code, `o` owner id (for documents the visitor owns)
//   - `p` share password (docs/specs/013-workspace/share-password.md) for a protected document's room.
// (A `g` guest-signature param used to ride along for presence-identity
// binding; the DO switched to server-random ephemeral presence ids —
// docs/specs/015-api/public-api-and-tokens.md §6 — and the server-side read was removed, so the client
// stopped sending it.)
// Pure (sharePassword passed in) so the param mapping is unit-tested.
export function roomQueryString(options: RoomAuthOptions, sharePassword: string | null): string {
  const params = new URLSearchParams();
  if (options.ticket) params.set('t', options.ticket);
  if (options.shareCode) params.set('s', options.shareCode);
  if (options.ownerId) {
    params.set('o', options.ownerId);
    // Proof of possession for `o`, the same signature REST sends as
    // X-Owner-Sig: once the guest signature gate is armed the worker refuses
    // a bare owner id here. Absent for legacy unsigned guests and self-hosts.
    if (options.ownerSig) params.set('os', options.ownerSig);
  }
  if (sharePassword) params.set('p', sharePassword);
  return params.toString();
}

// Reconnect backoff: a dropped socket auto-reopens so a brief network blip
// doesn't silently end a collaborative session. Capped attempts + capped
// delay so a hard-rejected upgrade (revoked share, lost membership) stops
// retrying rather than hammering the worker forever.
const MAX_RECONNECT_ATTEMPTS = 6;

// Ops held while the socket is down (docs/specs/012-collaboration/collab-race-hardening.md). A change made in that window
// used to be dropped on the floor: the save still carried it to D1, but no
// peer saw it until they reloaded, and a dot or an answer never reached the
// room's ledger at all. Only what changes the document or a poll is held: a
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

/** Who this client says it is to the room: the room overrides `id` (see connectRoom). */
export type RoomSelf = { id: string; key?: string; name: string; color: string; picture?: string };

export function connectRoom(
  documentId: string,
  // `key` is the document-write id (docs/specs/012-collaboration/participant-responses.md), relayed to peers verbatim so
  // an answer saved on the document can be joined back to the person in the
  // roster. The room OVERRIDES `id` with its own per-socket presence id
  // (docs/specs/015-api/public-api-and-tokens.md §6), which is why the two are separate fields.
  //
  // `picture` is the published profile picture (docs/specs/014-identity/profile-picture.md §6); the
  // room keeps it only for an account session.
  initialParticipant: RoomSelf,
  handlers: RoomHandlers,
  options: RoomAuthOptions = {},
  // Read at every (re)connect rather than captured once: the baton can be
  // taken while this socket is open, and the token we present has to be the
  // one we hold NOW (docs/specs/012-collaboration/facilitator.md).
  readFacilitatorToken?: () => string | null,
): {
  send: (msg: RoomOutgoing) => void;
  close: () => void;
  cursor: () => { epoch: string; seq: number } | null;
  updateSelf: (participant: RoomSelf) => void;
} {
  // Read at every (re)connect, and replaced by updateSelf, so a reconnect says hello as we are now.
  let participant = initialParticipant;
  // Auth identifiers ride on the query string (see roomQueryString). The
  // share password is read from the same session state apiHeaders uses, so
  // the editor doesn't have to thread it through; owners never have it set.
  const qs = roomQueryString(
    { ...options, ownerSig: options.ownerId ? getGuestSelfSig() : null },
    getSessionSharePassword(),
  );
  const url = wsUrl(`/documents/${documentId}/ws${qs ? `?${qs}` : ''}`);

  let ws: WebSocket;
  let closed = false; // the caller called close() — never reconnect after that
  let opened = false; // we've had at least one successful session (→ reconnects sync)
  let attempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Ordering cursor for reconnect catch-up (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1): the last
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
    // This socket, as opposed to `opened` (any session so far).
    let socketOpened = false;
    ws.addEventListener('open', () => {
      socketOpened = true;
      attempts = 0;
      // The baton coming home (docs/specs/012-collaboration/facilitator.md): on a reconnect this is what tells
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
        if (msg.kind === 'presence') {
          const frame = splitPresenceFrame(msg);
          handlers.onPresence(frame.participants, frame.agents);
        } else if (msg.kind === 'facilitator') handlers.onFacilitator?.(msg);
        else if (msg.kind === 'selection-released') handlers.onSelectionReleased?.(msg);
        // The server release signal (docs/specs/016-platform/new-version-prompt.md, stale-builds.md).
        else if (msg.kind === 'format') {
          noteServerDocumentFormat(msg.format);
          noteServerBuild(msg.build);
        } else if (msg.kind === 'op') applyOp(msg.from, msg.op, msg.seq, msg.epoch);
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
    ws.addEventListener('close', (event: CloseEvent) => {
      handlers.onClose?.();
      if (closed) return;
      if (event?.code === DOCUMENT_TRASHED_CLOSE) {
        closed = true;
        handlers.onDocumentTrashed?.();
        return;
      }
      if (event?.code === ACCESS_CHANGED_CLOSE) {
        closed = true;
        handlers.onAccessChanged?.();
        return;
      }
      if (event?.code === WORKBENCH_ENDED_CLOSE) {
        closed = true;
        handlers.onWorkbenchEnded?.();
        return;
      }
      if (!socketOpened) handlers.onRefused?.();
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
      // (docs/specs/012-collaboration/collab-race-hardening.md). One choke point for every send path.
      const msg: RoomOutgoing =
        raw.kind === 'op' ? { ...raw, op: opForTheWire(raw.op) as RoomOp } : raw;
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      else if (!closed && isOutboxOp(msg) && outbox.length < OUTBOX_MAX) outbox.push(msg);
    },
    // Where this client stands in the room's ordered stream, for a save to
    // tell the api what it has seen (docs/specs/012-collaboration/collab-race-hardening.md phase 3). Null while the socket
    // is down: a save made then is not merged with the room's ledger, because
    // what the client changed offline must not be overruled by the room.
    cursor: (): { epoch: string; seq: number } | null =>
      ws.readyState === WebSocket.OPEN && lastEpoch !== null
        ? { epoch: lastEpoch, seq: lastSeq }
        : null,
    // An identity change over the open socket (docs/specs/014-identity/profile-picture.md §4): the
    // room updates the roster in place. A closed socket just remembers it for the next hello.
    updateSelf: (next) => {
      participant = next;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ kind: 'identity', participant } satisfies RoomOutgoing));
      }
    },
    close: () => {
      closed = true;
      outbox = [];
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      ws.close();
    },
  };
}
