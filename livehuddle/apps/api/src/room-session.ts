// One session's state in the room (docs/specs/015-api/api.md, Realtime model): what the room pins on each
// socket's serialized attachment at the upgrade, read from the headers only the api worker can set.
import { cutParticipantName, isAccessLevel, type AccessLevel } from '@livehuddle/api-schema';
import { ADDER_KEY_LENGTH } from '@livehuddle/document';
import {
  COLLAB_KEY_HEADER,
  REACTION_PERSON_HEADER,
  sessionCollabKey,
  sessionReactionPerson,
} from '@liveworkspace/api-kit/collab-key';
import { isCollabKey } from '@liveworkspace/api-schema/collab-key';
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
  //   - `collabKey`: the session's collab key (docs/specs/013-workspace/share-roles.md "The collab key"), from
  //     X-Verified-Collab-Key, or minted here for a session with no identity: what the roster's `key` is, and the
  //     only key its answers and reactions may name. Absent on an attachment from before it existed.
  collabKey?: string;
  //   - `keyMinted`: the collab key was minted here, the upgrade naming none (a session with no identity). Its first
  //     hello's `visitor` secret then gives it its browser's key instead (visitor-key.ts), and this is cleared.
  keyMinted?: boolean;
  //   - `verifiedName`: the person's presence name (docs/specs/014-identity/auth-and-guest-access.md "Presence
  //     names"), their profile's name as the api read it at the upgrade (X-Verified-Name), moved on by a rename the
  //     api relays (`/presence-name`). The hello's name is never read. Absent with no identity, or no profile.
  verifiedName?: string;
  //   - `reactionPerson`: the person's public id the room stamps on each reaction this session leaves
  //     (docs/specs/012-collaboration/comment-reactions.md), from X-Verified-Reaction-Person. Absent with no identity.
  reactionPerson?: string;
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
  //   - `personTag`: the verified account's per-document person tag, from X-Verified-Person
  //     (docs/specs/024-agents/agent-changesets.md "Held elements", CS39): how the room tells an
  //     agent's owner's own sessions apart without holding an owner id. 64 hex characters.
  personTag?: string | null;
  //   - `account`: a verified account (not a guest, a link visitor or an API token) holds this session, from
  //     X-Verified-Account (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): only such a session may put a
  //     Google picture on the roster, and only such a session is sent the pictures on it.
  account?: boolean;
  //   - `following`: the presence id this session follows (docs/specs/012-collaboration/follow-me-viewport.md
  //     "Who follows whom"), from its `follow` op; absent when it follows nobody.
  following?: string;
  //   - `adderKey`: a Participant's adder key, from X-Verified-Adder (docs/specs/013-workspace/share-roles.md
  //     "Integrity"): what the room stamps on the stickies and text it adds. 32 hex characters.
  //   - `documentId`: the document this room serves, from X-Verified-Document, so a Participant's write knows its
  //     row. The room is named after it, so every session carries the same value.
  adderKey?: string | null;
  documentId?: string | null;
  //   - `grantExp`: when the session's grant lapses (epoch ms), from X-Verified-Grant-Exp
  //     (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"), moved on by each fresh grant the session sends. The
  //     room asks for a fresh one ROOM_GRANT_ASK_BEFORE_MS before (`renewAsked`) and drops the socket after.
  grantExp?: number | null;
  renewAsked?: boolean;
  //   - `batches`: the session's editor takes a busy room's coalesced `batch` frames, from its `hello`
  //     (docs/specs/015-api/api.md "A busy room bounds its presence fan-out").
  batches?: boolean;
  //   - `leanAvatars`: the session's editor reads lean avatar packets, from its `hello` (the same section).
  leanAvatars?: boolean;
  //   - `callSession`: the Realtime session this connection's call proved with its `call-session` op
  //     (docs/specs/012-collaboration/proximity-audio.md "The wire"), so the mint route can ask the room who it is.
  callSession?: string | null;
};

// A person tag is a SHA-256 hex digest; the clamp keeps a forged header from bloating the attachment.
const MAX_PERSON_TAG_LEN = 64;
// A document id is usually a UUID, but an API or MCP client may choose a longer one, up to the documents route's
// bound: the clamp keeps a forged header from bloating the attachment and never cuts an id the api accepts, since a
// cut id fails every later check against the real one (a grant's renewal, a call's session token).
const MAX_DOCUMENT_ID_LEN = 200;

/** The server-verified facts an upgrade carries, as the api worker set them (empty header = none). */
type VerifiedSession = {
  verifiedRole?: AccessLevel;
  isOwner: boolean;
  tabScope: string | null;
  shareCode: string | null;
  personTag: string | null;
  collabKey?: string | null;
  reactionPerson?: string | null;
  name?: string | null;
  account?: boolean;
  adderKey: string | null;
  documentId: string | null;
  grantExp?: number | null;
  // The canvas's owner and team as the grant names them (null owner: a grant that names none). Not pinned to the
  // session: the room takes them as its own copy (document-room.ts takeHead).
  head?: { owner: string | null; team: string | null };
};

/** The upgrade header carrying the person's presence name, URI-encoded (a header holds no character past Latin-1). */
export const PRESENCE_NAME_HEADER = 'X-Verified-Name';

/** A presence name as the header carries it, cut to the participant name's length; null for none or a bad encoding. */
export function presenceNameHeader(name: string | null | undefined): string {
  return name ? encodeURIComponent(cutParticipantName(name)) : '';
}

function presenceNameOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return cutParticipantName(decodeURIComponent(value).trim()) || null;
  } catch {
    return null;
  }
}

// The grant's `exp` (epoch seconds) as epoch ms, or null.
function grantExpOf(value: string | null): number | null {
  const seconds = Number(value);
  return value && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

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
    personTag: header('X-Verified-Person'),
    collabKey: header(COLLAB_KEY_HEADER),
    reactionPerson: header(REACTION_PERSON_HEADER),
    name: presenceNameOf(request.headers.get(PRESENCE_NAME_HEADER)),
    account: request.headers.get('X-Verified-Account') === '1',
    adderKey: header('X-Verified-Adder'),
    documentId: header('X-Verified-Document'),
    grantExp: grantExpOf(request.headers.get('X-Verified-Grant-Exp')),
    head: { owner: header('X-Verified-Item-Owner'), team: header('X-Verified-Item-Team') },
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
  const reactionPerson = sessionReactionPerson(v.reactionPerson);
  return {
    presenceId,
    verifiedRole: v.verifiedRole,
    presence: null,
    collabKey: sessionCollabKey(v.collabKey),
    ...(isCollabKey(v.collabKey) ? {} : { keyMinted: true }),
    ...(reactionPerson ? { reactionPerson } : {}),
    ...(v.name ? { verifiedName: cutParticipantName(v.name) } : {}),
    isOwner: v.isOwner,
    tabScope: v.tabScope,
    shareCode: v.shareCode,
    personTag: v.personTag?.slice(0, MAX_PERSON_TAG_LEN) ?? null,
    account: v.account === true,
    adderKey: v.adderKey?.slice(0, ADDER_KEY_LENGTH) ?? null,
    documentId: v.documentId?.slice(0, MAX_DOCUMENT_ID_LEN) ?? null,
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
