'use client';

import { useState, useSyncExternalStore } from 'react';
import { signInHref } from '@/lib/accounts';
import { initials } from '@/lib/initials';
import { signOut, useSession } from '@/lib/session';

const noChange = () => () => {};

// The header's account control (liveworkspace/docs/site.md "The header"): Sign in, or the signed-in
// person's avatar (their initials; accounts keep no pictures) and name, a link to their teams and API tokens, and Sign out. Until the page knows who is signed in (lib/session.ts), it holds its place
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
        <a
          href="/account/teams"
          aria-label={session.name}
          className={`${link} inline-flex max-w-48 items-center gap-2 font-medium text-slate-900 dark:text-white`}
        >
          <Avatar name={session.name} />
          <span className="truncate max-sm:hidden">{session.name}</span>
        </a>
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

// The signed-in person's initials in a disc, as the apps draw people.
function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-900 text-[11px] font-semibold text-white ring-2 ring-white dark:from-slate-300 dark:to-slate-500 dark:text-slate-950 dark:ring-slate-900"
    >
      <span className="text-optical-centre">{initials(name)}</span>
    </span>
  );
}
