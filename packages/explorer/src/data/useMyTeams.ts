'use client';

// The person's teams as accounts counts them (each team's member count, for its sidebar badge) and the invitations
// waiting for them: one request when the Explorer opens, signed in, with an accounts reader. Nothing for a guest.

import { useEffect, useState } from 'react';
import type { ExplorerAccounts, MyTeams } from './accounts';
import { isAbort } from './errors';

export function useMyTeams(accounts: ExplorerAccounts | null, signedIn: boolean): MyTeams | null {
  const [mine, setMine] = useState<MyTeams | null>(null);
  useEffect(() => {
    if (!accounts || !signedIn) {
      setMine(null);
      return;
    }
    const controller = new AbortController();
    accounts.myTeams(controller.signal).then(setMine, (e: unknown) => {
      // Without it the badges stay away; nothing else depends on it.
      if (!isAbort(e)) setMine(null);
    });
    return () => controller.abort();
  }, [accounts, signedIn]);
  return mine;
}
