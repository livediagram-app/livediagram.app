import { workbench } from '../../bindings';
import { readLocalStorageSafe, writeLocalStorageSafe } from '../local-storage-safe';

// "Not Now" on the move prompt after signing in (docs/specs/014-identity/auth-and-guest-access.md "Moving
// documents in This Browser after signing in"), remembered per account in this browser with the count of
// documents in This Browser at the time. The prompt comes back only when that count grows, so a deliberate
// document in This Browser is never asked about twice.

// Under the product's prefix (the `localMoveDismissedPrefix` binding).
function dismissedCount(userId: string): number {
  const raw = readLocalStorageSafe(workbench.localMoveDismissedPrefix + userId);
  const n = raw === null ? 0 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function shouldOfferLocalMove(userId: string, localCount: number): boolean {
  return localCount > 0 && localCount > dismissedCount(userId);
}

export function dismissLocalMove(userId: string, localCount: number): void {
  writeLocalStorageSafe(workbench.localMoveDismissedPrefix + userId, String(localCount));
}
