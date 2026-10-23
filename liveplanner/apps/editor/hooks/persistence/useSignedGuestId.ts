'use client';

import { useEffect, useState } from 'react';
import { ensureGuestIdentity } from '@/lib/guest-identity';

// A guest's id, from liveworkspace's guest token (liveworkspace/docs/one-explorer-contracts.md "Guests"):
// every entry path waits for it before its first owner-scoped call, so the guest's Bearer is there even
// for a first-time visitor. Null until auth has settled and the identity resolved, and always null
// for a signed-in user, whose id is the account's. An existing signed id resolves with no network.
export function useSignedGuestId(
  authLoaded: boolean,
  accountUserId: string | null | undefined,
): string | null {
  const [guestId, setGuestId] = useState<string | null>(null);
  useEffect(() => {
    if (!authLoaded || accountUserId) return;
    let cancelled = false;
    void ensureGuestIdentity().then((identity) => {
      if (!cancelled) setGuestId(identity.id);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoaded, accountUserId]);
  return accountUserId ? null : guestId;
}
