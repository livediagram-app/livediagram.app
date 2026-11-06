'use client';

import { SiteSwitcher } from '@livediagram/ui';
import { appOfAnyOrigin } from '@liveworkspace/sites';
import { lazy, Suspense, useSyncExternalStore, type ReactNode } from 'react';

// The header's logo. The account pages are also served under each app's own address (liveworkspace/docs/specs/003-accounts/accounts.md
// "Signing in on the app's own address"), and there they wear that app's logo, linking to its home, so the person
// stays in the app they came from. Elsewhere, and on the server's render, it is liveworkspace's (`children`, drawn by
// the server's Header so its code stays out of this module). The app's logo loads on demand (HeaderAppBrand),
// showing liveworkspace's until it arrives.
const HeaderAppBrand = lazy(() => import('./HeaderAppBrand'));
const subscribe = () => () => {};
const appHere = () => appOfAnyOrigin(window.location.origin);
const noApp = () => null;

export function HeaderLogo({
  appAware = false,
  children,
}: {
  appAware?: boolean;
  children: ReactNode;
}) {
  const app = useSyncExternalStore(subscribe, appAware ? appHere : noApp, noApp);
  return (
    <SiteSwitcher current={app ?? 'liveworkspace.app'}>
      {app ? (
        <Suspense fallback={children}>
          <HeaderAppBrand app={app} />
        </Suspense>
      ) : (
        children
      )}
    </SiteSwitcher>
  );
}
