'use client';

// Where the accounts site's guest handoff comes back to (liveworkspace/docs/one-explorer-contracts.md "Guests"):
// `#guest_token=…&state=…`. The token is kept (lib/guest-token.ts) and the page goes straight back to where the
// handoff started, replacing this entry so Back never lands here again. The fragment never reaches a server.
import { useEffect } from 'react';
import { completeGuestHandoff } from '@/lib/guest-token';

export default function GuestHandoffPage() {
  useEffect(() => {
    const { returnTo } = completeGuestHandoff(window.location.hash);
    window.location.replace(returnTo);
  }, []);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-white text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
      <p role="status">Opening livedesign…</p>
    </main>
  );
}
