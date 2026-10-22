'use client';

import { useEffect, useState } from 'react';
import { ensureSignedGuestIdentity } from '@/lib/guest-identity';

// A guest's id, resolved through the signed mint (docs/specs/014-identity/auth-and-guest-access.md
// "Signed guest ids"): every entry path waits for it before its first owner-scoped call, so the
// `X-Owner-Sig` the api may require (docs/specs/015-api/public-api-and-tokens.md §4) is there even
// for a first-time visitor. Null until auth has settled and the identity resolved, and always null
// for a signed-in user, whose id is the Clerk one. An existing signed id resolves with no network.
export function useSignedGuestId(
  authLoaded: boolean,
  clerkUserId: string | null | undefined,
): string | null {
  const [guestId, setGuestId] = useState<string | null>(null);
  useEffect(() => {
    if (!authLoaded || clerkUserId) return;
    let cancelled = false;
    void ensureSignedGuestIdentity().then((identity) => {
      if (!cancelled) setGuestId(identity.id);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoaded, clerkUserId]);
  return clerkUserId ? null : guestId;
}
