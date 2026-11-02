'use client';

// Who is signed in, for My Shares, mounted only once My Shares is chosen. The session is the app editor's: the api keeps the refresh token in an HttpOnly cookie on
// /api/auth, on this same origin, and POST /api/auth/token answers a short-lived access token for it
// (each product's docs/specs/014-identity/auth-and-guest-access.md). A browser without the app's readable signed-in
// hint is signed out and asks nothing. Nothing renders; the session is reported up.

import { useEffect } from 'react';
import { useCommunitySite } from '../../client';
import type { CommunitySession } from '../../lib/session';

type TokenAnswer = {
  signedIn?: boolean;
  accessToken?: string;
  expiresAt?: number;
  user?: { id?: string };
};

// Ask again this long before the access token expires, so a request never goes out with one that lapses in
// flight.
const EXPIRY_MARGIN_MS = 60_000;

async function requestToken(apiBase: string): Promise<TokenAnswer | null> {
  try {
    const res = await fetch(`${apiBase}/auth/token`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    return res.ok ? ((await res.json()) as TokenAnswer) : null;
  } catch {
    // Offline or the api unreachable: signed out this time.
    return null;
  }
}

// The session an answer from /api/auth/token amounts to. Its getToken reuses the access token until it is
// nearly spent, then asks for a fresh one.
export function sessionFrom(first: TokenAnswer | null, apiBase: string): CommunitySession {
  if (!first?.signedIn || !first.accessToken || !first.user?.id) {
    return { loaded: true, signedIn: false, userId: null, getToken: async () => null };
  }
  let token = first.accessToken;
  let expiresAt = first.expiresAt ?? 0;
  return {
    loaded: true,
    signedIn: true,
    userId: first.user.id,
    getToken: async () => {
      if (expiresAt - EXPIRY_MARGIN_MS > Date.now()) return token;
      const next = await requestToken(apiBase);
      if (!next?.signedIn || !next.accessToken) return null;
      token = next.accessToken;
      expiresAt = next.expiresAt ?? 0;
      return token;
    },
  };
}

export function AccountSession({ onSession }: { onSession: (session: CommunitySession) => void }) {
  const { apiBase, signedInHint } = useCommunitySite();
  useEffect(() => {
    let live = true;
    const hinted = signedInHint(document.cookie) === true;
    void (hinted ? requestToken(apiBase) : Promise.resolve(null)).then((answer) => {
      if (live) onSession(sessionFrom(answer, apiBase));
    });
    return () => {
      live = false;
    };
  }, [apiBase, onSession, signedInHint]);
  return null;
}
