// The room connector's contract (room.ts, which re-exports what callers use): the callbacks it calls, the options it
// takes, the query string that admits a socket, and the bounds and timings it runs to.
import {
  ROOM_FULL_MESSAGE,
  isMutationOpKind,
  type AgentPresence,
  type ParticipantPresence,
  type FacilitatorReason,
  type RoomOp,
  type RoomOutgoing,
} from '@livehuddle/api-schema';

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
  // The facilitator has freed an element we were holding (docs/specs/007-editor/editor-app.md lock). Sent
  // to this socket alone, so being called IS the addressing: there is no id to
  // check against our own, which we do not know (docs/specs/015-api/public-api-and-tokens.md §6).
  onSelectionReleased?: (msg: { elementId: string; by: string }) => void;
  // Who follows us (docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"), by presence id. Sent to
  // this socket alone, on every change; emptied when a new socket opens, since nobody follows its new id yet.
  onFollowers?: (ids: string[]) => void;
  // The collab key the room pinned on this session (docs/specs/013-workspace/share-roles.md "The collab key"),
  // sent to this socket alone after each hello: our answers and reactions are recorded under it.
  onCollabKey?: (key: string) => void;
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
  // The room is full (docs/specs/015-api/api.md "A room holds at most 100 connections"): it closed this socket with
  // ROOM_FULL_CLOSE. Called once per streak of refusals; the connector tries again every ROOM_FULL_RETRY_MS and
  // whenever the tab is shown again, and a join that gets in ends the streak.
  onRoomFull?: () => void;
  // The room refused to open this connection (it closed before ever opening): the join was turned away
  // at the upgrade, which the browser reports only as an abnormal close. The caller finds out why over
  // REST, which names a trashed document (docs/specs/013-workspace/trash.md). Retrying carries on as usual.
  onRefused?: () => void;
  // The room could not bridge our reconnect gap from its op log (docs/specs/012-collaboration/realtime-conflict-resolution.md,
  // Level 1): we're too far behind, or it restarted. The caller re-hydrates
  // from D1 (the same recovery the error boundary uses: a full reload).
  onResync?: () => void;
};

// connectRoom's options: the ticket that admits the socket, and how to mint a fresh one for a reconnect.
export type RoomConnectOptions = {
  // One-time room ticket (docs/specs/015-api/api.md "Realtime model"), minted over authenticated REST via
  // apiCreateRoomTicket: the REST gates (the guest signature, the share code and its password, team
  // membership) all ran there, so the upgrade URL carries nothing but this. Null when the mint failed; the
  // upgrade is then refused and the reconnect mints again.
  ticket?: string | null;
  // A ticket is spent by the upgrade it admits (ws-tickets.ts deletes it), so a reconnect that sent the
  // first one again was refused, and the session lost the room for good. Called before every reconnect.
  // Null when the api refused the mint (that upgrade is then refused, and the refusal path runs); throws when the
  // mint never got an answer, which opens no socket and waits out the backoff.
  mintTicket?: () => Promise<string | null>;
  // Who we follow, read at every (re)connect: the room keeps a follow on the socket, so a new socket says it again.
  readFollowing?: () => string | null;
  // A fresh grant for the room when it asks (GrantRenewMessage, liveworkspace/docs/specs/004-index/one-explorer-contracts.md
  // "Carrying a grant to the app"): without one before the old lapses, the room drops the socket
  // (GRANT_LAPSED_CLOSE) and the reconnect mints anew.
  renewGrant?: () => Promise<string | null>;
};

// The room WebSocket's query string. Browsers can't set headers on a WebSocket upgrade, so whatever
// admits the socket rides the URL, and a URL is logged (edge logs, Logpush, tail). Only the ticket rides
// it: single-use, document-scoped and a minute long, so a logged one is already spent. The share code,
// the owner id, its signature and the share password used to ride here as `s`, `o`, `os` and `p`; they
// now go to the ticket mint as headers (docs/specs/015-api/api.md "Realtime model").
export function roomQueryString(ticket: string | null): string {
  return ticket ? new URLSearchParams({ t: ticket }).toString() : '';
}

// Reconnect backoff: a dropped socket auto-reopens so a brief network blip
// doesn't silently end a collaborative session. Capped attempts + capped
// delay so a hard-rejected upgrade (revoked share, lost membership) stops
// retrying rather than hammering the worker forever. Out of attempts, the
// connector waits for a sign the cause may have passed (the browser back
// online, the tab shown again: a laptop waking, wifi returning after the
// ~30 s the attempts span) and starts a fresh round then, so a longer outage
// no longer ends live collaboration for the rest of the session.
export const MAX_RECONNECT_ATTEMPTS = 6;

// What the editor says when a full room turns it away (docs/specs/015-api/api.md "A room holds at most 100
// connections"): the room's own words, and that nothing is lost.
export const ROOM_FULL_NOTICE = `${ROOM_FULL_MESSAGE}. Your changes still save, and you'll join live when there's space.`;

// Ops held while the socket is down (docs/specs/012-collaboration/collab-race-hardening.md). A change made in that window
// used to be dropped on the floor: the save still carried it to D1, but no
// peer saw it until they reloaded, and a dot or an answer never reached the
// room's ledger at all. Only what changes the document or a poll is held: a
// cursor or a selection from a minute ago means nothing. Bounded, so a long
// outage can't grow it without end; past the bound, newer ops are dropped
// and the next save still carries the state to the canvas.
export const OUTBOX_MAX = 500;
export function isOutboxOp(msg: RoomOutgoing): boolean {
  if (msg.kind !== 'op') return false;
  const kind = (msg.op as { kind?: unknown }).kind;
  return kind === 'poll-answer' || isMutationOpKind(kind);
}
// How long a save waits for the room to say it sequenced a delta (docs/specs/012-collaboration/collab-race-hardening.md
// phase 6). A healthy room answers in one socket round trip, tens of milliseconds; past this the save
// goes ahead unconfirmed rather than hold the person's work back. Safe range: 500 ms to 10 s.
export const ROOM_SEQUENCE_ACK_TIMEOUT_MS = 2_000;
export const RECONNECT_BASE_MS = 500;
// The keepalive (docs/specs/012-collaboration/realtime-conflict-resolution.md "Keepalive"). A socket can die
// without a close event (a laptop asleep, a NAT or proxy that dropped an idle connection): it reads OPEN while
// nothing arrives, so collaborators' changes silently stop until a reload. After ROOM_KEEPALIVE_IDLE_MS with
// nothing heard the client sends ROOM_PING, which the room's runtime answers without waking; a ping with no
// answer at all within ROOM_KEEPALIVE_TIMEOUT_MS ends the socket as a drop, and the reconnect takes over. Only an
// unanswered ping counts, never silence alone, so a background tab whose timers the browser slows to once a minute
// is never dropped for being quiet. Safe ranges: idle 10 s to 60 s, timeout 5 s to 30 s.
export const ROOM_KEEPALIVE_IDLE_MS = 20_000;
export const ROOM_KEEPALIVE_TIMEOUT_MS = 10_000;
export const ROOM_KEEPALIVE_TICK_MS = 5_000;
export const RECONNECT_MAX_MS = 15_000;

/** Who this client says it is to the room: the room overrides `id` (see connectRoom). */
export type RoomSelf = { id: string; key?: string; name: string; color: string };
