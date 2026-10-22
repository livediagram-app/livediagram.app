'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { call, displayName, signInHref } from '@/lib/accounts';

type Session = { state: 'checking' } | { state: 'out' } | { state: 'in'; name: string };

const noChange = () => () => {};

// The header's account control (liveworkspace/docs/site.md "The header"): Sign in, or the signed-in
// name and Sign out. The site is static, so it asks the accounts API on this origin once the page
// is up; until it hears, it holds its place without showing either, so nothing jumps.
export function AccountControl() {
  const [session, setSession] = useState<Session>({ state: 'checking' });
  const [leaving, setLeaving] = useState(false);
  // This page, to come back to after signing in.
  const here = useSyncExternalStore(
    noChange,
    () => window.location.pathname + window.location.search,
    () => '/',
  );

  useEffect(() => {
    let cancelled = false;
    void call('/get-session').then((result) => {
      if (cancelled) return;
      const user = result.ok ? result.data.user : null;
      setSession(
        user && typeof user === 'object'
          ? { state: 'in', name: displayName(user as Record<string, unknown>) }
          : { state: 'out' },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    setLeaving(true);
    const result = await call('/sign-out', {});
    setLeaving(false);
    if (result.ok) setSession({ state: 'out' });
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
          onClick={() => void signOut()}
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
