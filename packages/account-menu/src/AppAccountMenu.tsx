'use client';

import { AccountMenu, type AccountMenuKit } from './AccountMenu';
import { appSignOut, useAppAccount, workspacePageHref } from './app-account';
import { AccountMenuPlaceholder } from './placeholder';

// The account menu on an app's own pages (its marketing header): signed in, liveworkspace.app's menu, its account
// pages on liveworkspace.app and its Sign out the app's; signed out, nothing at all. `hint` is the app's readable
// `<prefix>signed_in` cookie, whose name cookie sits beside it.
export function AppAccountMenu({ hint, kit }: { hint: string; kit: AccountMenuKit }) {
  const account = useAppAccount(hint);
  if (account === 'out') return null;
  if (account === 'pending') return <AccountMenuPlaceholder />;
  return (
    <AccountMenu
      name={account.name}
      kit={kit}
      pageHref={workspacePageHref}
      onSignOut={() => appSignOut()}
    />
  );
}
