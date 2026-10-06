// Which realtime sessions an access change ends (docs/specs/015-api/api.md "Access changes end
// the sessions they affect"). Pure, so every rule is tested without a socket; the room applies it
// to each session when the api calls its internal `POST /close-sessions`.
//
// The room holds no account id, so it matches only on what a session already carries:
//   - `share-code`: every session a share code admitted, with the code itself or with a ticket a
//     share-code visitor minted. A share password was set, so each must meet the gate again.
//     The owner and team members carry no code and stay.
//   - `person`: the sessions carrying one per-document person tag (person-tag.ts). A member left
//     or was removed from the document's team.

export type AccessCloseMatch = { match: 'share-code' } | { match: 'person'; personTag: string };

type SessionAccess = { shareCode?: string | null; personTag?: string | null };

// A person tag is a SHA-256 hex digest (person-tag.ts).
const PERSON_TAG = /^[0-9a-f]{64}$/;

// The match a request body names, or null when it names none the room knows.
export function parseAccessCloseMatch(body: unknown): AccessCloseMatch | null {
  if (!body || typeof body !== 'object') return null;
  const { match, personTag } = body as { match?: unknown; personTag?: unknown };
  if (match === 'share-code') return { match };
  if (match === 'person' && typeof personTag === 'string' && PERSON_TAG.test(personTag)) {
    return { match, personTag };
  }
  return null;
}

export function sessionMatchesAccessClose(
  session: SessionAccess | null,
  close: AccessCloseMatch,
): boolean {
  if (!session) return false;
  if (close.match === 'share-code') return !!session.shareCode;
  return !!session.personTag && session.personTag === close.personTag;
}
