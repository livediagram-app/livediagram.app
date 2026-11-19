// Which realtime sessions an access change ends, in every product's room (each product's docs/specs/015-api/api.md
// "Access changes end the sessions they affect"). Pure, so every rule is tested without a socket; the room applies it
// to each session when the api calls its internal `POST /close-sessions`.
//
// The room holds no account id, so it matches only on what a session already carries:
//   - `share-code`: every session a share code admitted, with the code itself or with a ticket a
//     share-code visitor minted. A share password was set, so each must meet the gate again.
//     The owner and team members carry no code and stay.
//   - `person`: the sessions carrying one per-document person tag (each api's person-tag.ts). A member left
//     or was removed from the document's team.
//   - `workbench`: the sockets one workbench pairing opened (each product's docs/specs/013-workspace/workbench-embeds.md). The
//     pairing was removed or its token revoked; they close with WORKBENCH_ENDED_CLOSE.
//   - `token`: the sockets one API token's room tickets opened (an MCP server's live view, a CLI), which carry the
//     token's id (each product's docs/specs/015-api/public-api-and-tokens.md "Revoking a token"). The token was
//     revoked; they close with ACCESS_CHANGED_CLOSE.
//   - `archived`: every socket in the room, whoever opened it. The item was archived from anywhere (liveworkspace/
//     docs/specs/004-index/one-explorer.md "Archived from elsewhere while open"); they close with ITEM_ARCHIVED_CLOSE.
//
// Which close code a match ends its sessions with is `accessCloseCode`'s, so the five rooms can't drift on it.

import {
  ACCESS_CHANGED_CLOSE,
  ITEM_ARCHIVED_CLOSE,
  ITEM_ARCHIVED_REASON,
  WORKBENCH_ENDED_CLOSE,
} from '@liveworkspace/api-schema/room-wire';

export type AccessCloseMatch =
  | { match: 'share-code' }
  | { match: 'person'; personTag: string }
  | { match: 'workbench'; pairingId: string }
  | { match: 'token'; tokenId: string }
  | { match: 'archived' };

type SessionAccess = {
  shareCode?: string | null;
  personTag?: string | null;
  workbenchPairing?: string | null;
  apiToken?: string | null;
};

// A person tag is a SHA-256 hex digest (person-tag.ts).
const PERSON_TAG = /^[0-9a-f]{64}$/;
// A workbench pairing id, and an API token id, is a UUID (crypto.randomUUID).
const PAIRING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_ID = PAIRING_ID;

// The match a request body names, or null when it names none the room knows.
export function parseAccessCloseMatch(body: unknown): AccessCloseMatch | null {
  if (!body || typeof body !== 'object') return null;
  const { match, personTag, pairingId, tokenId } = body as {
    match?: unknown;
    personTag?: unknown;
    pairingId?: unknown;
    tokenId?: unknown;
  };
  if (match === 'share-code' || match === 'archived') return { match };
  if (match === 'person' && typeof personTag === 'string' && PERSON_TAG.test(personTag)) {
    return { match, personTag };
  }
  if (match === 'workbench' && typeof pairingId === 'string' && PAIRING_ID.test(pairingId)) {
    return { match, pairingId };
  }
  if (match === 'token' && typeof tokenId === 'string' && TOKEN_ID.test(tokenId)) {
    return { match, tokenId };
  }
  return null;
}

export function sessionMatchesAccessClose(
  session: SessionAccess | null,
  close: AccessCloseMatch,
): boolean {
  // Archived ends every socket, one whose session can't be read included: nobody keeps an archived item open.
  if (close.match === 'archived') return true;
  if (!session) return false;
  if (close.match === 'share-code') return !!session.shareCode;
  if (close.match === 'workbench')
    return !!session.workbenchPairing && session.workbenchPairing === close.pairingId;
  if (close.match === 'token') return !!session.apiToken && session.apiToken === close.tokenId;
  return !!session.personTag && session.personTag === close.personTag;
}

/** The close code and reason a match's sockets end with: a workbench pairing's 4006, an archive's 4010, and 4005 for
 *  every other access change. */
export function accessCloseCode(close: AccessCloseMatch): [code: number, reason: string] {
  if (close.match === 'workbench') return [WORKBENCH_ENDED_CLOSE, 'workbench-ended'];
  if (close.match === 'archived') return [ITEM_ARCHIVED_CLOSE, ITEM_ARCHIVED_REASON];
  return [ACCESS_CHANGED_CLOSE, 'access-changed'];
}
