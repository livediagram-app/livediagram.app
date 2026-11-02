// Why a document just left your screen (docs/specs/013-workspace/share-roles.md "Share links"): a revoked pass sends
// its sessions to the Explorer, and an access change (a team removal, a share password) reloads them into the access
// check, which may now refuse. Either used to land without a word: an empty Explorer, or "doesn't exist or isn't
// yours" for a document that was open a second ago. The editor notes why just before it goes; the page it lands on
// takes the note once and explains.

export type AccessEnded = 'revoked' | 'changed';

const KEY = 'livehuddle:access-ended:v1';
// Only the landing that follows the eject explains it; a stale note never reaches a later visit.
export const ACCESS_NOTICE_TTL_MS = 60_000;

export function noteAccessEnded(documentId: string | null, reason: AccessEnded): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ documentId, reason, at: Date.now() }));
  } catch {
    // No storage: the landing simply says nothing, as before.
  }
}

/** The reason, once, when a fresh note exists (for `documentId`, when one is named); null otherwise. */
export function takeAccessEnded(documentId?: string, now: number = Date.now()): AccessEnded | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(KEY);
    if (raw !== null) sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const note = JSON.parse(raw) as { documentId?: string | null; reason?: string; at?: number };
    if (typeof note.at !== 'number' || now - note.at > ACCESS_NOTICE_TTL_MS || note.at > now)
      return null;
    if (documentId !== undefined && note.documentId !== documentId) return null;
    return note.reason === 'revoked' || note.reason === 'changed' ? note.reason : null;
  } catch {
    return null;
  }
}

/** What the Explorer says when a revoked pass sent you there. */
export const ACCESS_REVOKED_MESSAGE =
  'The link you opened that canvas with was revoked, so it is no longer open to you.';
