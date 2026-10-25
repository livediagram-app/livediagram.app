'use client';

import { useEffect } from 'react';
import { claimLegacyGuest, hasLegacyGuest } from '@/lib/legacy-guest-claim';

// The claim of an old livediagram.app guest (docs/specs/014-identity/auth-and-guest-access.md "Returning guests
// from the old site"): once the page has an identity of its own (useSettledOwnerId), claim in the background.
// Nothing waits for it.
export function useLegacyGuestClaim(enabled: boolean, ownerId: string | null): void {
  useEffect(() => {
    if (!enabled || !ownerId || !hasLegacyGuest()) return;
    void claimLegacyGuest(ownerId);
  }, [enabled, ownerId]);
}
