import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';

// "Not Now" on the move prompt after signing in (docs/specs/014-identity/auth-and-guest-access.md "Moving
// Local only documents after signing in"), remembered per account in this browser with the count of
// Local only documents at the time. The prompt comes back only when that count grows, so a deliberate
// Local only document is never asked about twice.

const PREFIX = 'livediagram:v2:local-move-dismissed:';

function dismissedCount(userId: string): number {
  const raw = readLocalStorageSafe(PREFIX + userId);
  const n = raw === null ? 0 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function shouldOfferLocalMove(userId: string, localCount: number): boolean {
  return localCount > 0 && localCount > dismissedCount(userId);
}

export function dismissLocalMove(userId: string, localCount: number): void {
  writeLocalStorageSafe(PREFIX + userId, String(localCount));
}
