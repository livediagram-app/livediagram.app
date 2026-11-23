'use client';

import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AccountMenu } from '@liveworkspace/account-menu';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import { signInHref, signUpHref } from '@/lib/accounts';
import { signOut, useSession } from '@/lib/session';

const noChange = () => () => {};

// The Settings panel's code: fetched when the pointer or focus reaches Settings, or as it is pressed, never with the
// page.
const loadSettings = () => import('@/components/settings/SiteSettingsDialog');
const SiteSettingsDialog = lazy(loadSettings);

// This site's read of the person's subscription (SiteSubscription), around the signed-in menu: the provider, its
// hooks and how this site reaches the service. Fetched once someone is known to be signed in, and only where Pro is
// on in the build: a visitor's page carries none of it (liveworkspace/docs/specs/010-site/blueprints/site.md
// "Performance and limits"). Not fetched (offline), the menu is drawn without it, as on a page with no provider.
const Unwrapped = ({ children }: { children: ReactNode }) => <>{children}</>;
const SignedInSubscription = lazy(() =>
  import('@/components/subscription/SiteSubscription').then(
    (m) => ({ default: m.SiteSubscription }),
    () => ({ default: Unwrapped }),
  ),
);

/** A surface's own Settings panel: opening it in place, and fetching its code ahead of the press. */
export type SettingsControl = { onOpen: () => void; onPrepare: () => void };

// The header's account control (liveworkspace/docs/specs/010-site/site.md "The header"): AccountMenu from
// @liveworkspace/account-menu, the one every app's marketing header and the Explorer show too. Signed in, the person's
// avatar and name, opening the Explorer, Settings and Sign out; Settings opens the Settings panel over this page, in
// place: the Explorer's own panel there (`settings`), else this control's own, its code fetched only when Settings is
// approached. Signed out, the same control as Guest, opening Sign in and Create account, each back to this page. Until
// the page knows who is signed in (lib/session.ts), the Guest button holds the place, unseen, so nothing jumps; with
// Pro on it holds it a moment longer for someone signed in, until the subscription provider's code is in.
// `subscribed`: the page already has SiteSubscription around this control (the Explorer), so it adds none.
export function AccountControl({
  settings = null,
  subscribed = false,
}: {
  settings?: SettingsControl | null;
  subscribed?: boolean;
}) {
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

  // The Guest button: the control for a visitor, and unseen, the control's place while it is not yet known who is
  // here.
  const guest = (unseen: boolean) => (
    <div aria-hidden={unseen || undefined} className={unseen ? 'invisible' : undefined}>
      <AccountMenu guest={{ signInHref: signInHref(here), signUpHref: signUpHref(here) }} />
    </div>
  );

  if (session.state === 'in') {
    const panel = settings ?? own;
    const menu = (
      <>
        <AccountMenu
          name={session.name}
          fullName={session.fullName}
          colour={session.colour}
          picture={session.picture}
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
    if (subscribed || !proOn()) return menu;
    return (
      // The menu's Pro badge and Upgrade to Pro, and the Settings panel's Subscription, share one read of the
      // person's subscription.
      <Suspense fallback={guest(true)}>
        <SignedInSubscription account="in">{menu}</SignedInSubscription>
      </Suspense>
    );
  }

  return guest(session.state === 'checking');
}
