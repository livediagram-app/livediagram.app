// Why a project just left your screen (docs/specs/013-workspace/share-roles.md "Share links"): a revoked pass sends
// its sessions to the Explorer, and an access change (a team removal, a share password) reloads them into the access
// check, which may now refuse. Either used to land without a word: an empty Explorer, or "doesn't exist or isn't
// yours" for a project that was open a second ago. The editor notes why just before it goes; the page it lands on
// takes the note once and explains.

export type AccessEnded = 'revoked' | 'changed';

const KEY = 'liveplanner:access-ended:v1';
// Only the landing that follows the eject explains it; a stale note never reaches a later visit.
export const ACCESS_NOTICE_TTL_MS = 60_000;

export function noteAccessEnded(projectId: string | null, reason: AccessEnded): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ projectId, reason, at: Date.now() }));
  } catch {
    // No storage: the landing simply says nothing, as before.
  }
}

/** The reason, once, when a fresh note exists (for `projectId`, when one is named); null otherwise. */
export function takeAccessEnded(projectId?: string, now: number = Date.now()): AccessEnded | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(KEY);
    if (raw !== null) sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const note = JSON.parse(raw) as { projectId?: string | null; reason?: string; at?: number };
    if (typeof note.at !== 'number' || now - note.at > ACCESS_NOTICE_TTL_MS || note.at > now)
      return null;
    if (projectId !== undefined && note.projectId !== projectId) return null;
    return note.reason === 'revoked' || note.reason === 'changed' ? note.reason : null;
  } catch {
    return null;
  }
}
