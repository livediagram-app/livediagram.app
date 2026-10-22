'use client';

import { useState, useSyncExternalStore } from 'react';
import { signInHref } from '@/lib/accounts';
import { signOut, useSession } from '@/lib/session';

const noChange = () => () => {};

// The header's account control (liveworkspace/docs/site.md "The header"): Sign in, or the signed-in
// name and Sign out. Until the page knows who is signed in (lib/session.ts), it holds its place
// without showing either, so nothing jumps.
export function AccountControl() {
  const session = useSession();
  const [leaving, setLeaving] = useState(false);
  // This page, to come back to after signing in.
  const here = useSyncExternalStore(
    noChange,
    () => window.location.pathname + window.location.search,
    () => '/',
  );

  async function leave() {
    setLeaving(true);
    await signOut();
    setLeaving(false);
  }

  const link =
    'relative touch-target-y rounded-md px-2.5 py-1.5 whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

  if (session.state === 'in') {
    return (
      <span className="flex items-center gap-1">
        <span className="max-w-32 truncate px-1 text-slate-900 max-sm:hidden dark:text-white">
          {session.name}
        </span>
        <button
          type="button"
          onClick={() => void leave()}
          disabled={leaving}
          className={`${link} cursor-pointer`}
        >
          Sign out
        </button>
      </span>
    );
  }

  return (
    <a
      href={signInHref(here)}
      aria-hidden={session.state === 'checking' || undefined}
      tabIndex={session.state === 'checking' ? -1 : undefined}
      className={`${link} rounded-md border border-slate-200 dark:border-slate-700 ${
        session.state === 'checking' ? 'invisible' : ''
      }`}
    >
      Sign in
    </a>
  );
}
