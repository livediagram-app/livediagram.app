'use client';

import { useSyncExternalStore } from 'react';
import { AccountMenu } from '@liveworkspace/account-menu';
import { ACCOUNT_MENU_KIT } from '@/components/account-menu-kit';
import { signInHref, signUpHref } from '@/lib/accounts';
import { signOut, useSession } from '@/lib/session';

const noChange = () => () => {};

// The header's account control (liveworkspace/docs/site.md "The header"): AccountMenu from
// @liveworkspace/account-menu, the one every app's marketing header and the Explorer show too. Signed in, the person's
// avatar and name, opening their API tokens, Settings and Sign out; signed out, the same control as Guest, opening
// Sign in and Create account, each back to this page. Until the page knows who is signed in (lib/session.ts), the
// Guest button holds the place, unseen, so nothing jumps.
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
        colour={session.colour}
        kit={ACCOUNT_MENU_KIT}
        onSignOut={signOut}
      />
    );
  }

  const checking = session.state === 'checking';
  return (
    <div aria-hidden={checking || undefined} className={checking ? 'invisible' : undefined}>
      <AccountMenu
        kit={ACCOUNT_MENU_KIT}
        guest={{ signInHref: signInHref(here), signUpHref: signUpHref(here) }}
      />
    </div>
  );
}
