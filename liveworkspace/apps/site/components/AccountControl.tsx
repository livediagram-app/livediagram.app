'use client';

import { lazy, Suspense, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { AccountMenu } from '@liveworkspace/account-menu';
import { ACCOUNT_MENU_KIT } from '@/components/account-menu-kit';
import { signInHref, signUpHref } from '@/lib/accounts';
import { signOut, useSession } from '@/lib/session';

const noChange = () => () => {};

// The Settings panel's code: fetched when the pointer or focus reaches Settings, or as it is pressed, never with the
// page.
const loadSettings = () => import('@/components/settings/SiteSettingsDialog');
const SiteSettingsDialog = lazy(loadSettings);

/** A surface's own Settings panel: opening it in place, and fetching its code ahead of the press. */
export type SettingsControl = { onOpen: () => void; onPrepare: () => void };

// The header's account control (liveworkspace/docs/site.md "The header"): AccountMenu from
// @liveworkspace/account-menu, the one every app's marketing header and the Explorer show too. Signed in, the person's
// avatar and name, opening the Explorer, Settings and Sign out; Settings opens the Settings panel over this page, in
// place: the Explorer's own panel there (`settings`), else this control's own, its code fetched only when Settings is
// approached. Signed out, the same control as Guest, opening Sign in and Create account, each back to this page. Until
// the page knows who is signed in (lib/session.ts), the Guest button holds the place, unseen, so nothing jumps.
export function AccountControl({ settings = null }: { settings?: SettingsControl | null }) {
  const session = useSession();
  // This page, to come back to after signing in.
  const here = useSyncExternalStore(
    noChange,
    () => window.location.pathname + window.location.search,
    () => '/',
  );
  const [open, setOpen] = useState(false);
  const own = useMemo<SettingsControl>(
    () => ({
      onOpen: () => setOpen(true),
      onPrepare: () => {
        void loadSettings();
        // Imported here, not at the top: the header is on every page, and the panel's code stays out of it.
        void import('@liveworkspace/settings-ui').then((ui) => ui.preloadSettingsPanel());
      },
    }),
    [],
  );
  const close = useCallback(() => setOpen(false), []);

  if (session.state === 'in') {
    const panel = settings ?? own;
    return (
      <>
        <AccountMenu
          name={session.name}
          fullName={session.fullName}
          colour={session.colour}
          kit={ACCOUNT_MENU_KIT}
          explorerHref="/explorer"
          onOpenSettings={panel.onOpen}
          onPrepareSettings={panel.onPrepare}
          onSignOut={signOut}
        />
        {open ? (
          <Suspense fallback={null}>
            <SiteSettingsDialog app={null} onClose={close} />
          </Suspense>
        ) : null}
      </>
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
