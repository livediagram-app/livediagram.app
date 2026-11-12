// The realtime room's wire pieces every product's room shares (each product's room-messages.ts re-exports them):
// the op `ref` echo, the format frame, grant renewal, the room's own close codes, the index grant header and the
// keepalive. The frames themselves (ServerMessage, ClientMessage, RoomOp) stay each product's.

// `ref`: the `ref` the sender put on the op this frame answers, echoed so the sender knows that op is
// sequenced (docs/specs/012-collaboration/collab-race-hardening.md phase 6). Absent on hello.
export type CursorMessage = { kind: 'cursor'; epoch: string; seq: number; ref?: number };

// A `ref` the room echoes: a positive safe integer, nothing else.
export function isRoomOpRef(ref: unknown): ref is number {
  return typeof ref === 'number' && Number.isSafeInteger(ref) && ref > 0;
}

// The server's format number (docs/specs/016-platform/new-version-prompt.md), sent to each socket on `hello`: a
// deploy restarts the room, so every open editor hears it on reconnect.
// `build`: the live build id when the deploy set one (docs/specs/016-platform/stale-builds.md).
export type FormatMessage = { kind: 'format'; format: number; build?: string };

// The session's grant is about to lapse (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"): the
// room asks for a fresh one ROOM_GRANT_ASK_BEFORE_MS before it does, and drops the socket (GRANT_LAPSED_CLOSE) when
// none came by then. `expiresAt`: when the session's grant runs out, epoch ms.
export type GrantRenewMessage = { kind: 'grant-renew'; expiresAt: number };

// A fresh grant for this session, the index's ES256 JWT (or the api's room ticket, for a client that has no
// grant of its own). The room checks it as it checked the first, and keeps the session to what it now allows.
export type GrantMessage = { kind: 'grant'; grant: string };

// How long before a session's grant lapses the room asks for a new one. The editor renews on its own a minute
// before expiry, so the ask is the fallback; 30 s leaves a slow renewal room to land.
export const ROOM_GRANT_ASK_BEFORE_MS = 30_000;

// The WebSocket close code the realtime room ends a session with when an access change narrows who may be in it
// without revoking a link (docs/specs/015-api/api.md "Access changes end the sessions they affect"): a share
// password set, or a member leaving their team. Beside 4003 (a share link changed) and 4004 (the file was
// trashed). The editor reloads into the ordinary access path.
export const ACCESS_CHANGED_CLOSE = 4005;

// The close code for a workbench session whose pairing or token ended (docs/specs/013-workspace/workbench-embeds.md):
// the page turns read-only and does not reconnect.
export const WORKBENCH_ENDED_CLOSE = 4006;

// The close code for a session whose grant lapsed without a fresh one (GrantRenewMessage): the editor fetches a
// new grant and reconnects.
export const GRANT_LAPSED_CLOSE = 4007;

// A request about one file carries the index's grant for it here
// (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"), so `Authorization` keeps the person's own
// token. The api checks it offline against the index's keys. A caller with no grant (an API token, a workbench
// session) has one fetched for it by the api.
export const INDEX_GRANT_HEADER = 'X-Index-Grant';

// The room's keepalive (docs/specs/012-collaboration/realtime-conflict-resolution.md "Keepalive"): the client sends
// the bare text ROOM_PING on an idle socket and the room answers ROOM_PONG without waking from hibernation
// (setWebSocketAutoResponse). Plain text, never JSON, so neither side's message handler ever sees them as ops.
export const ROOM_PING = 'ping';
export const ROOM_PONG = 'pong';
