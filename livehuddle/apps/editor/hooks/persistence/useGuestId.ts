'use client';

import { useEffect, useState } from 'react';
import { ensureGuestIdentity } from '@/lib/guest-identity';

// A guest's id, liveworkspace's guest token (lib/guest-token.ts, docs/specs/014-identity/auth-and-guest-access.md):
// every entry path waits for it before its first owner-scoped call, so the Bearer is there even for a first-time
// visitor. Null until auth has settled and the identity resolved, and always null for a signed-in person, whose id
// is the account's. A guest who already holds a token resolves with no network.
export function useGuestId(
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
