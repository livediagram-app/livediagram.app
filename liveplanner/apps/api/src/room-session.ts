// One session's state in the room (docs/specs/015-api/api.md, Realtime model): what the room pins on each
// socket's serialized attachment at the upgrade, read from the headers only the api worker can set.
import { isAccessLevel, type AccessLevel } from '@liveplanner/api-schema';
import { ADDER_KEY_LENGTH } from '@liveplanner/project';
import type { ParticipantPresence } from './types';

// Everything the room knows about one session, persisted in the socket's
// serialized attachment so it SURVIVES HIBERNATION (an in-memory Map
// would silently lose it on eviction, wiping roles and presence for
// every connected peer):
//
//   - `presenceId`: the server-assigned ephemeral presence id
//     (docs/specs/015-api/public-api-and-tokens.md §6), minted once at upgrade time.
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
export type SessionAttachment = {
  presenceId: string;
  verifiedRole?: AccessLevel;
  presence: ParticipantPresence | null;
  //   - `multiplayer`: this session belongs to a multiplayer session the
  //     room has already counted (Project·Used·Multiplayer, docs/specs/017-telemetry/telemetry.md). See
  //     room-multiplayer.ts for why the mark lives here.
  multiplayer?: boolean;
  //   - `tabScope`: the one tab this session is confined to
  //     (docs/specs/013-workspace/tab-scoped-share-links.md), from X-Verified-Tab-Scope. Null / absent = every tab.
  //   - `shareCode`: the share code that admitted it, from X-Verified-Share-Code,
  //     so revoking or rescoping that code can close exactly its sockets.
  tabScope?: string | null;
  shareCode?: string | null;
  //   - `personTag`: the verified account's per-project person tag, from X-Verified-Person
  //     (docs/specs/024-agents/agent-changesets.md "Held elements", CS39): how the room tells an
  //     agent's owner's own sessions apart without holding an owner id. 64 hex characters.
  personTag?: string | null;
  //   - `workbenchPairing`: the workbench pairing that opened this session (docs/specs/013-workspace/workbench-embeds.md),
  //     from X-Verified-Workbench-Pairing, so unpairing or revoking its token closes exactly its sockets.
  workbenchPairing?: string | null;
  //   - `adderKey`: a Participant's adder key, from X-Verified-Adder (docs/specs/013-workspace/share-roles.md
  //     "Integrity"): what the room stamps on the stickies and text it adds. 32 hex characters.
  //   - `projectId`: the project this room serves, from X-Verified-Project, so a Participant's write knows its
  //     row. The room is named after it, so every session carries the same value.
  adderKey?: string | null;
  projectId?: string | null;
  //   - `grantExp`: when the index's grant this session holds lapses (epoch ms), from X-Verified-Grant-Exp; the
  //     room asks for a fresh one ROOM_GRANT_ASK_BEFORE_MS before (`renewAsked`) and drops the socket after.
  //     Absent for a session admitted without one (tests).
  grantExp?: number | null;
  renewAsked?: boolean;
};

// A person tag is a SHA-256 hex digest; the clamp keeps a forged header from bloating the attachment.
const MAX_PERSON_TAG_LEN = 64;
// A workbench pairing id is a UUID.
const MAX_PAIRING_ID_LEN = 36;
// A project id is a UUID; the clamp keeps a forged header from bloating the attachment.
const MAX_PROJECT_ID_LEN = 64;

/** The server-verified facts an upgrade carries, as the api worker set them (empty header = none). */
type VerifiedSession = {
  verifiedRole?: AccessLevel;
  tabScope: string | null;
  shareCode: string | null;
  personTag: string | null;
  workbenchPairing: string | null;
  adderKey: string | null;
  projectId: string | null;
  grantExp?: number | null;
};

// The grant's `exp` (epoch seconds) as epoch ms, or null.
function grantExpOf(header: string | null): number | null {
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

/**
 * Read the upgrade's verified headers. The room trusts them because only the worker can set them:
 * clients reach the DO via env.PLAN_ROOM.get(...).fetch, never directly. The role is pinned into
 * the attachment so the hello handler can re-stamp it onto the broadcast presence even after a
 * hibernation cycle, defeating a crafted client that lies in its own hello payload.
 */
export function verifiedSessionOf(request: Request): VerifiedSession {
  const header = (name: string) => request.headers.get(name) || null;
  const role = request.headers.get('X-Verified-Role');
  return {
    verifiedRole: isAccessLevel(role) ? role : undefined,
    tabScope: header('X-Verified-Tab-Scope'),
    shareCode: header('X-Verified-Share-Code'),
    personTag: header('X-Verified-Person'),
    workbenchPairing: header('X-Verified-Workbench-Pairing'),
    adderKey: header('X-Verified-Adder'),
    projectId: header('X-Verified-Project'),
    grantExp: grantExpOf(request.headers.get('X-Verified-Grant-Exp')),
  };
}

/**
 * A new session's attachment: a fresh presence id, no hello yet, and every verified fact clamped so
 * a forged header can't bloat the attachment past serializeAttachment's limit.
 *
 * The presence id (docs/specs/015-api/public-api-and-tokens.md §6) is a fresh server-assigned random,
 * NOT the connector's real owner id, so a co-present collaborator (incl. a view-only share visitor)
 * never reads an owner id off a presence frame. Being server-random it ALSO defeats presence
 * impersonation: a joiner can't claim another peer's id because it never sees or sets one.
 */
export function newSessionAttachment(v: VerifiedSession, presenceId: string): SessionAttachment {
  return {
    presenceId,
    verifiedRole: v.verifiedRole,
    presence: null,
    tabScope: v.tabScope,
    shareCode: v.shareCode,
    personTag: v.personTag?.slice(0, MAX_PERSON_TAG_LEN) ?? null,
    workbenchPairing: v.workbenchPairing?.slice(0, MAX_PAIRING_ID_LEN) ?? null,
    adderKey: v.adderKey?.slice(0, ADDER_KEY_LENGTH) ?? null,
    projectId: v.projectId?.slice(0, MAX_PROJECT_ID_LEN) ?? null,
    grantExp: v.grantExp ?? null,
  };
}

/** A socket's session attachment. Null means "not a session we admitted" (or a corrupt attachment). */
export function readSessionAttachment(ws: WebSocket): SessionAttachment | null {
  try {
    return (ws.deserializeAttachment() as SessionAttachment | null) ?? null;
  } catch {
    return null;
  }
}
