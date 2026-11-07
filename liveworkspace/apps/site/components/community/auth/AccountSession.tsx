'use client';

// Who is signed in, for My Shares, mounted only once My Shares is chosen. My Shares is one app's, on its own address,
// so the session is the app's: the same one the page's header and the Explorer read (@/lib/explorer/app-session
// appAccount), which asks the app's `POST /api/auth/token` only when its readable signed-in hint says there is a
// session, and shares one request and one answer with every asker on the page. A second request of its own would
// rotate the refresh token under the header's feet. Nothing renders; the session is reported up.

import { useEffect } from 'react';
import { appAccount, type AppAccount } from '@/lib/explorer/app-session';
import type { CommunitySession } from '../lib/session';

const SIGNED_OUT: CommunitySession = {
  loaded: true,
  signedIn: false,
  userId: null,
  getToken: async () => null,
};

// The session an account amounts to. Its getToken asks appAccount each time, which keeps the access token until it
// is nearly spent and then asks the app for a fresh one.
export function sessionFrom(
  account: AppAccount | null,
  ask: () => Promise<AppAccount | null> = appAccount,
): CommunitySession {
  if (!account?.sub) return SIGNED_OUT;
  return {
    loaded: true,
    signedIn: true,
    userId: account.sub,
    getToken: async () => (await ask())?.token ?? null,
  };
}

export function AccountSession({
  onSession,
  ask = appAccount,
}: {
  onSession: (session: CommunitySession) => void;
  // Tests stand in for the app's session.
  ask?: () => Promise<AppAccount | null>;
}) {
  useEffect(() => {
    let live = true;
    void ask().then((account) => {
      if (live) onSession(sessionFrom(account, ask));
    });
    return () => {
      live = false;
    };
  }, [ask, onSession]);
  return null;
}
