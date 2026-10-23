// One session's state in the room (docs/specs/015-api/api.md, Realtime model): what the room pins on each
// socket's serialized attachment at the upgrade, read from the headers only the api worker can set.
import { isAccessLevel, type AccessLevel } from '@livediagram/api-schema';
import { ADDER_KEY_LENGTH } from '@livediagram/document';
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
  //   - `isOwner`: whether the api resolved this upgrade as the document's
  //     OWNER (docs/specs/012-collaboration/facilitator.md). A boolean, never an id: it is the one thing the
  //     facilitator baton needs that role alone cannot answer ("the owner can
  //     always take it back"), and carrying it as a bit keeps docs/specs/015-api/public-api-and-tokens.md §6's
  //     promise that no real identity reaches the room.
  isOwner?: boolean;
  //   - `multiplayer`: this session belongs to a multiplayer session the
  //     room has already counted (Document·Used·Multiplayer, docs/specs/017-telemetry/telemetry.md). See
  //     room-multiplayer.ts for why the mark lives here.
  multiplayer?: boolean;
  //   - `tabScope`: the one tab this session is confined to
  //     (docs/specs/013-workspace/tab-scoped-share-links.md), from X-Verified-Tab-Scope. Null / absent = every tab.
  //   - `shareCode`: the share code that admitted it, from X-Verified-Share-Code,
  //     so revoking or rescoping that code can close exactly its sockets.
  tabScope?: string | null;
  shareCode?: string | null;
  //   - `account`: a verified account holds this session, from X-Verified-Account
  //     (docs/specs/014-identity/profile-picture.md §6). Only such a session may put a picture on the
  //     roster, and only such a session receives the pictures on it.
  account?: boolean;
  //   - `personTag`: the verified account's per-document person tag, from X-Verified-Person
  //     (docs/specs/024-agents/agent-changesets.md "Held elements", CS39): how the room tells an
  //     agent's owner's own sessions apart without holding an owner id. 64 hex characters.
  personTag?: string | null;
  //   - `networkTag`: the caller's network, hashed with the document id, from X-Verified-Network
  //     (docs/specs/012-collaboration/vote-integrity.md): what caps one network's poll answers. 32 hex characters.
  networkTag?: string | null;
  //   - `following`: the presence id this session follows (docs/specs/012-collaboration/follow-me-viewport.md
  //     "Who follows whom"), from its `follow` op; absent when it follows nobody.
  following?: string;
  //   - `pollAnsweredAs`: the key this session answered the running poll under, so a socket cannot become a
  //     second person in the same poll (docs/specs/012-collaboration/vote-integrity.md).
  pollAnsweredAs?: { pollId: string; key: string } | null;
  //   - `workbenchPairing`: the workbench pairing that opened this session (docs/specs/013-workspace/workbench-embeds.md),
  //     from X-Verified-Workbench-Pairing, so unpairing or revoking its token closes exactly its sockets.
  workbenchPairing?: string | null;
  //   - `adderKey`: a Participant's adder key, from X-Verified-Adder (docs/specs/013-workspace/share-roles.md
  //     "Integrity"): what the room stamps on the stickies and text it adds. 32 hex characters.
  //   - `documentId`: the document this room serves, from X-Verified-Document, so a Participant's write knows its
  //     row. The room is named after it, so every session carries the same value.
  adderKey?: string | null;
  documentId?: string | null;
};

// A person tag is a SHA-256 hex digest; the clamp keeps a forged header from bloating the attachment.
const MAX_PERSON_TAG_LEN = 64;
// A workbench pairing id is a UUID.
const MAX_PAIRING_ID_LEN = 36;
// A document id is a UUID; the clamp keeps a forged header from bloating the attachment.
const MAX_DOCUMENT_ID_LEN = 64;
// A network tag is a 32-hex digest; the clamp keeps a forged header from bloating the attachment.
const MAX_NETWORK_TAG_LEN = 32;

/** The server-verified facts an upgrade carries, as the api worker set them (empty header = none). */
type VerifiedSession = {
  verifiedRole?: AccessLevel;
  isOwner: boolean;
  tabScope: string | null;
  shareCode: string | null;
  account: boolean;
  personTag: string | null;
  networkTag: string | null;
  workbenchPairing: string | null;
  adderKey: string | null;
  documentId: string | null;
};

/**
 * Read the upgrade's verified headers. The room trusts them because only the worker can set them:
 * clients reach the DO via env.DOCUMENT_ROOM.get(...).fetch, never directly. The role is pinned into
 * the attachment so the hello handler can re-stamp it onto the broadcast presence even after a
 * hibernation cycle, defeating a crafted client that lies in its own hello payload.
 */
export function verifiedSessionOf(request: Request): VerifiedSession {
  const header = (name: string) => request.headers.get(name) || null;
  const role = request.headers.get('X-Verified-Role');
  return {
    verifiedRole: isAccessLevel(role) ? role : undefined,
    isOwner: request.headers.get('X-Verified-Owner') === '1',
    tabScope: header('X-Verified-Tab-Scope'),
    shareCode: header('X-Verified-Share-Code'),
    account: request.headers.get('X-Verified-Account') === '1',
    personTag: header('X-Verified-Person'),
    networkTag: header('X-Verified-Network'),
    workbenchPairing: header('X-Verified-Workbench-Pairing'),
    adderKey: header('X-Verified-Adder'),
    documentId: header('X-Verified-Document'),
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
    isOwner: v.isOwner,
    tabScope: v.tabScope,
    shareCode: v.shareCode,
    account: v.account,
    personTag: v.personTag?.slice(0, MAX_PERSON_TAG_LEN) ?? null,
    networkTag: v.networkTag?.slice(0, MAX_NETWORK_TAG_LEN) ?? null,
    pollAnsweredAs: null,
    workbenchPairing: v.workbenchPairing?.slice(0, MAX_PAIRING_ID_LEN) ?? null,
    adderKey: v.adderKey?.slice(0, ADDER_KEY_LENGTH) ?? null,
    documentId: v.documentId?.slice(0, MAX_DOCUMENT_ID_LEN) ?? null,
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
