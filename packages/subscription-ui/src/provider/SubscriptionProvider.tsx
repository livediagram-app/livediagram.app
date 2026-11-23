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
import { proOn } from '../flag';
import { SUBSCRIPTION_LOADING, SUBSCRIPTION_SIGNED_OUT } from '../state';
import {
  noRefresh,
  pricingHrefOn,
  SubscriptionContext,
  SUBSCRIPTION_STALE_MS,
  type AccountKnown,
  type SubscriptionHost,
  type UpgradeTarget,
} from './context';

// Everything that asks the service or draws a dialog is the driver's, in its own chunk: a page carries only this
// shell, which is a context and a few lines of state.
const loadDriver = () => import('./SubscriptionDriver');
const SubscriptionDriver = lazy(() =>
  loadDriver().then((m) => ({ default: m.SubscriptionDriver })),
);

/** Fetches the provider's working half and its dialogs ahead of time (a test warming its imports, a pointer
 *  reaching Upgrade). */
export async function preloadUpgradeDialog(): Promise<void> {
  const driver = await loadDriver();
  await driver.loadUpgradeDialogs();
}

export { SUBSCRIPTION_STALE_MS };

export type SubscriptionProviderProps = {
  /** The account's access token, or null when nobody is signed in (an editor's `useDeferredAuth().getToken`). */
  getToken: () => Promise<string | null>;
  /** The subscription service's origin, without a trailing slash: liveworkspace.app's from an app's page. Leave it
   *  out on liveworkspace.app itself. */
  origin?: string;
  /** Whether the page knows who is signed in. `checking` and `out` ask the service nothing. Default `in`: ask, and
   *  let the token say. */
  account?: AccountKnown;
  /** Where signing in goes, coming back to the given address, for a guest who chooses to upgrade. */
  signInHref?: (returnTo: string) => string;
  /** The address the checkout and the portal come back to. This page's own when not given. */
  returnTo?: () => string;
  /** For tests and unusual hosts: how the browser is sent to the checkout or the portal. */
  navigate?: (url: string) => void;
  fetch?: typeof fetch;
  children: ReactNode;
};

const noChange = () => () => {};
const inBrowser = () => true;
const onServer = () => false;
const EMPTY = {};
const notYet = () => Promise.reject(new Error('The subscription service is still loading.'));
const nothing = () => {};

/**
 * Shares the signed-in person's subscription with everything under it (subscription.md "What people see"): read once
 * per page, again when they come back from the checkout or the billing portal, and whenever `refresh` is called. It
 * also mounts the one upgrade dialog, which any LimitNotice or ProNote under it opens.
 *
 * It is two halves so that a page pays almost nothing for it at first load. This one is the context and the dialogs'
 * open state; the half that asks the service and draws (SubscriptionDriver) is fetched once the page is interactive.
 * Until it lands the hooks answer `loading`, and an upgrade asked for meanwhile opens as soon as it does.
 *
 * With Pro off in the build it renders its children and nothing else: no request, no dialog, no extra code, and
 * every hook answers its `off` state.
 */
export function SubscriptionProvider({ children, ...props }: SubscriptionProviderProps) {
  if (!proOn()) return <>{children}</>;
  return <Shell {...props}>{children}</Shell>;
}

function Shell({ children, ...props }: SubscriptionProviderProps) {
  const { account = 'in', origin = '', signInHref } = props;
  const [live, setLive] = useState<SubscriptionHost | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeTarget | null>(null);
  const [askAdmin, setAskAdmin] = useState<UpgradeTarget | null>(null);
  const openUpgrade = useCallback((target: UpgradeTarget = {}) => setUpgrade(target), []);
  const openAskAdmin = useCallback((target: UpgradeTarget = {}) => setAskAdmin(target), []);
  const closeUpgrade = useCallback(() => setUpgrade(null), []);
  const closeAskAdmin = useCallback(() => setAskAdmin(null), []);
  // The driver is the browser's alone: the server's markup and the first render carry none of it.
  const interactive = useSyncExternalStore(noChange, inBrowser, onServer);

  // What the hooks read until the driver hands over its own: still loading (or signed out, where the page knows).
  const pending = useMemo<SubscriptionHost>(
    () => ({
      account,
      load: account === 'out' ? SUBSCRIPTION_SIGNED_OUT : SUBSCRIPTION_LOADING,
      refresh: noRefresh,
      ownerViews: EMPTY,
      askOwnerView: nothing,
      prices: null,
      askPrices: nothing,
      openUpgrade,
      openAskAdmin,
      checkout: notYet,
      portal: notYet,
      askTeam: notYet,
      dismissEnded: nothing,
      pricingHref: pricingHrefOn(origin),
      signInHref: signInHref ?? null,
    }),
    [account, origin, signInHref, openUpgrade, openAskAdmin],
  );
  const dialogs = useMemo(
    () => ({ upgrade, askAdmin, openUpgrade, openAskAdmin, closeUpgrade, closeAskAdmin }),
    [upgrade, askAdmin, openUpgrade, openAskAdmin, closeUpgrade, closeAskAdmin],
  );

  return (
    <SubscriptionContext value={live ?? pending}>
      {children}
      {interactive ? (
        <Suspense fallback={null}>
          <SubscriptionDriver {...props} dialogs={dialogs} onHost={setLive} />
        </Suspense>
      ) : null}
    </SubscriptionContext>
  );
}
