'use client';

import { useSyncExternalStore } from 'react';
import { getGuestSelfId, subscribeGuestSelfId } from '@/lib/local-identity';

// Who this page acts as once auth has settled: the signed-in account, else this browser's guest token's id; null
// before auth settles or while a guest has no token yet. Reads the guest id without asking for one (that is the
// page's own bootstrap's job, useGuestId), so a background task can follow it without starting a handoff.
export function useSettledOwnerId(
  authLoaded: boolean,
  accountUserId: string | null | undefined,
): string | null {
  const guestId = useSyncExternalStore(subscribeGuestSelfId, getGuestSelfId, () => null);
  if (!authLoaded) return null;
  return accountUserId ?? guestId;
}
