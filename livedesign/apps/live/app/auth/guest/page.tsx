'use client';

// Where the accounts site's guest handoff comes back to (liveworkspace/docs/one-explorer-contracts.md "Guests"):
// `#guest_token=…&state=…`. The token is kept (lib/guest-token.ts) and the page goes straight back to where the
// handoff started, replacing this entry so Back never lands here again. The fragment never reaches a server.
import { useEffect, useRef } from 'react';
import { completeGuestHandoff } from '@/lib/guest-token';

export default function GuestHandoffPage() {
  // Taken once: the handoff's state is used up by the first read, so a second run of the effect (React's
  // development double run) goes where the first was told, not to the fallback.
  const returnTo = useRef<string | null>(null);
  useEffect(() => {
    returnTo.current ??= completeGuestHandoff(window.location.hash).returnTo;
    window.location.replace(returnTo.current);
  }, []);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-white text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
      <p role="status">Opening livedesign…</p>
    </main>
  );
}
