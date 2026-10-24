'use client';

// The header's account control for the Explorer shown on an app's own address (lib/explorer/page-app.ts): the app's
// session rather than liveworkspace.app's. Signed in, the same menu as everywhere on the site, its account pages on
// liveworkspace.app and its Sign out the app's (the page reloads as a guest); signed out, the same control as Guest,
// its Sign in and Create account the app's own, which come back here, and Settings, the guest's settings for this
// app kept in this browser (`settings`, the bottom bar's).

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccountMenu } from '@liveworkspace/account-menu';
import { ACCOUNT_MENU_KIT } from '@/components/account-menu-kit';
import { appAccount, appSignInHref, appSignOut, appSignUpHref } from '@/lib/explorer/app-session';
import { workspaceHref } from '@/lib/explorer/page-app';

const noChange = () => () => {};

export type GuestSettingsControl = { onOpen: () => void; onPrepare: () => void };

export function AppAccountControl({ settings = null }: { settings?: GuestSettingsControl | null }) {
  const [state, setState] = useState<
    { name: string; fullName: string | null; colour: string | null } | 'out' | 'checking'
  >('checking');
  const here = useSyncExternalStore(
    noChange,
    () => window.location.pathname + window.location.search,
    () => '/explorer',
  );
  useEffect(() => {
    let live = true;
    void appAccount().then(
      (found) =>
        live &&
        setState(
          found ? { name: found.name, fullName: found.fullName, colour: found.colour } : 'out',
        ),
    );
    return () => {
      live = false;
    };
  }, []);

  if (typeof state === 'object')
    return (
      <AccountMenu
        name={state.name}
        fullName={state.fullName}
        colour={state.colour}
        kit={ACCOUNT_MENU_KIT}
        pageHref={workspaceHref}
        onSignOut={async () => {
          const left = await appSignOut();
          if (left) window.location.reload();
          return left;
        }}
      />
    );
  const checking = state === 'checking';
  return (
    <div aria-hidden={checking || undefined} className={checking ? 'invisible' : undefined}>
      <AccountMenu
        kit={ACCOUNT_MENU_KIT}
        guest={{
          signInHref: appSignInHref(here),
          signUpHref: appSignUpHref(here),
          ...(settings
            ? { onOpenSettings: settings.onOpen, onPrepareSettings: settings.onPrepare }
            : {}),
        }}
      />
    </div>
  );
}
