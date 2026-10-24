// Why a document just left your screen (docs/specs/013-workspace/share-roles.md "Share links"): an access change (a
// team removal, a share password) reloads its sessions into the access check, which may now refuse. That used to land
// on "doesn't exist or isn't yours" for a document that was open a second ago. The editor notes why just before it
// reloads; the page it lands on takes the note once and explains. (A revoked pass sends its sessions to the Explorer
// with `?ended=revoked` in the address instead: the Explorer is on another origin.)

export type AccessEnded = 'changed';

const KEY = 'livedocuments:access-ended:v1';
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
    return note.reason === 'changed' ? note.reason : null;
  } catch {
    return null;
  }
}

