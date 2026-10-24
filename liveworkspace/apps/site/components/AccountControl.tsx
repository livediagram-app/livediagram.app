'use client';

import { useSyncExternalStore } from 'react';
import { AccountMenu } from '@liveworkspace/account-menu';
import { ACCOUNT_MENU_KIT } from '@/components/account-menu-kit';
import { signInHref } from '@/lib/accounts';
import { signOut, useSession } from '@/lib/session';

const noChange = () => () => {};

// The header's account control (liveworkspace/docs/site.md "The header"): Sign in, or the signed-in person's menu
// (AccountMenu from @liveworkspace/account-menu, the one every app's marketing header and the Explorer show too):
// their avatar and name, opening their API tokens, Settings and Sign out. Until the page knows who is signed
// in (lib/session.ts), it holds its place without showing either, so nothing jumps.
export function AccountControl() {
  const session = useSession();
  // This page, to come back to after signing in.
  const here = useSyncExternalStore(
    noChange,
    () => window.location.pathname + window.location.search,
    () => '/',
  );

  if (session.state === 'in') {
    return (
      <AccountMenu
        name={session.name}
        fullName={session.fullName}
        kit={ACCOUNT_MENU_KIT}
        onSignOut={signOut}
      />
    );
  }

  return (
    <a
      href={signInHref(here)}
      aria-hidden={session.state === 'checking' || undefined}
      tabIndex={session.state === 'checking' ? -1 : undefined}
      className={`relative touch-target-y rounded-md border border-slate-200 px-2.5 py-1.5 whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${
        session.state === 'checking' ? 'invisible' : ''
      }`}
    >
      Sign in
    </a>
  );
}
