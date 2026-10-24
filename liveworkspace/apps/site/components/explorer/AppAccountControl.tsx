'use client';

// The header's account control for the Explorer shown on an app's own address (lib/explorer/page-app.ts): the app's
// session rather than liveworkspace.app's. Signed in, the same menu as everywhere on the site, its Settings the
// Explorer's panel in place on this address (`settings`, the bottom bar's) and its Sign out the app's (the page
// reloads as a guest); signed out, the same control as Guest, its Sign in and Create account the app's own, which
// come back here, and Settings, the guest's settings for this app kept in this browser (the same panel).

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccountMenu } from '@liveworkspace/account-menu';
import { ACCOUNT_MENU_KIT } from '@/components/account-menu-kit';
import type { SettingsControl } from '@/components/AccountControl';
import { appAccount, appSignInHref, appSignOut, appSignUpHref } from '@/lib/explorer/app-session';

const noChange = () => () => {};

export function AppAccountControl({ settings = null }: { settings?: SettingsControl | null }) {
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
        // Before the Explorer knows who is here, Settings is this address's Explorer with the panel open.
        {...(settings
          ? { onOpenSettings: settings.onOpen, onPrepareSettings: settings.onPrepare }
          : {})}
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
