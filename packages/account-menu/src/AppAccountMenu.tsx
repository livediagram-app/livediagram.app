'use client';

import { useSyncExternalStore } from 'react';
import { AccountMenu, type AccountMenuKit } from './AccountMenu';
import {
  appSignInHref,
  appSignOut,
  appSignUpHref,
  pageHere,
  useAppAccount,
  workspacePageHref,
} from './app-account';
import { AccountMenuPlaceholder, type DeferredMenuProps } from './placeholder';

const noSubscription = () => () => {};
const hydratedNow = () => true;
const notHydrated = () => false;

// The account menu on an app's own pages (its marketing header): signed in, liveworkspace.app's menu, its account
// pages on liveworkspace.app and its Sign out the app's; signed out, the Guest menu, whose Sign in and Create account
// are the app's own and come back to this page. `hint` is the app's readable `<prefix>signed_in` cookie, whose name
// cookie sits beside it. `openOnMount` and `focusOnMount` carry on from the Guest stand-in it replaces.
export function AppAccountMenu({
  hint,
  kit,
  ...arrival
}: { hint: string; kit: AccountMenuKit } & DeferredMenuProps) {
  const account = useAppAccount(hint);
  // The static HTML can't know who is here: it holds the avatar's place for everyone.
  const hydrated = useSyncExternalStore(noSubscription, hydratedNow, notHydrated);
  if (!hydrated || account === 'pending') return <AccountMenuPlaceholder />;
  if (account === 'out') {
    const here = pageHere();
    return (
      <AccountMenu
        kit={kit}
        guest={{ signInHref: appSignInHref(here), signUpHref: appSignUpHref(here) }}
        {...arrival}
      />
    );
  }
  return (
    <AccountMenu
      name={account.name}
      fullName={account.fullName}
      colour={account.colour}
      kit={kit}
      pageHref={workspacePageHref}
      onSignOut={() => appSignOut()}
      {...arrival}
    />
  );
}
