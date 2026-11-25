// When each share link last changed (revoked or rescoped), as a room saw it (every product's tab-scoped-share-links.md).
//
// A link's change reaches the sockets open at that moment: the room sends the op and closes them. A socket still
// joining (its upgrade on its way, or the room awaiting a read before it accepts) misses both and would join with what
// its grant, signed before the change, says the link opens. So the room notes the change here, and a joining socket
// whose grant is older than its link's last change is closed as it joins (ACCESS_CHANGED_CLOSE): its editor reloads
// into what the link opens now. In memory: the race is a moment long, and an evicted room holds no joining socket.

import { ACCESS_CHANGED_CLOSE } from '@liveworkspace/api-schema/room-wire';

// The header the api stamps on a room upgrade with when the grant was signed (epoch ms). Unconditional, like every
// X-Verified-* header: the room believes what arrives under this name.
export const GRANT_ISSUED_HEADER = 'X-Verified-Grant-Issued';

// A grant's signing moment in epoch ms: its `iatMs`, or `iat` in seconds for a grant signed before the index added it
// (which orders only to the second, so a change in that same second counts as after it: one more reload at worst).
export function grantIssuedMs(claims: { iat: number; iatMs?: number }): number {
  return typeof claims.iatMs === 'number' && Number.isFinite(claims.iatMs)
    ? claims.iatMs
    : claims.iat * 1000;
}

// The grant's signing moment from an upgrade's header; null when absent or not a positive number.
export function grantIssuedOf(request: Request): number | null {
  const raw = request.headers.get(GRANT_ISSUED_HEADER);
  if (!raw) return null;
  const at = Number(raw);
  return Number.isFinite(at) && at > 0 ? at : null;
}

// Longer than any grant lives (the index's GRANT_LIFETIME_S is ten minutes): an older change can't predate a grant
// that still admits.
const KEEP_MS = 60 * 60 * 1000;
// A bound on the codes kept: a room seldom sees more than a few links change.
const MAX_CODES = 256;

export class LinkChanges {
  private readonly at = new Map<string, number>();

  // A link changed now. Re-noting moves it to the newest end, so the oldest are shed first.
  note(code: string, now: number = Date.now()): void {
    this.at.delete(code);
    this.at.set(code, now);
    for (const [each, when] of this.at) {
      if (this.at.size <= MAX_CODES && now - when <= KEEP_MS) break;
      this.at.delete(each);
    }
  }

  // Whether a socket admitted by `code` on a grant signed at `issuedMs` joins with what the link no longer opens. A
  // socket with no code, or an unknown signing moment, joins as before.
  changedSince(code: string | null | undefined, issuedMs: number | null | undefined): boolean {
    if (!code || typeof issuedMs !== 'number') return false;
    const when = this.at.get(code);
    return when !== undefined && when >= issuedMs;
  }

  get size(): number {
    return this.at.size;
  }
}

// Turn away a joining socket its link's change left behind: accepted and closed at once, as a full room does, since
// the close code is all a browser can read of a refused upgrade. True when it was turned away; the caller then
// answers the upgrade with its client side and admits nothing.
export function turnAwayStaleLinkJoin(
  changes: LinkChanges,
  shareCode: string | null | undefined,
  request: Request,
  server: WebSocket,
): boolean {
  if (!changes.changedSince(shareCode, grantIssuedOf(request))) return false;
  server.accept();
  server.close(ACCESS_CHANGED_CLOSE, 'access-changed');
  console.info('[room] link.changed_join_refused');
  return true;
}
