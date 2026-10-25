import { lazy, Suspense, useSyncExternalStore, type ComponentType } from 'react';
import { AccountMenuPlaceholder, DeferredAccountMenu, type DeferredMenuProps } from './placeholder';

// A product's site header account menu (`/site-account`; docs/specs/019-marketing/marketing-site.md "Header" in
// each product), at the bar's right end: liveworkspace.app's account menu for someone signed in, and the same
// control as Guest for a visitor. The product's hint cookie decides, read after hydration; until then the
// avatar's disc holds the place for everyone. The menu's code is its own chunk (the product's SiteAccountMenu,
// bound to its hint cookie): loaded at once when the hint says signed in, and for a visitor only when the
// pointer or focus reaches the Guest button (DeferredAccountMenu), so a visitor's page carries none of it and
// makes no request. Each product binds it once (its SiteAccount).

const noSubscription = () => () => {};
const hydratedNow = () => true;
const notHydrated = () => false;

export function createSiteAccount({
  load,
  useSignedInHint,
}: {
  // The product's menu chunk: `() => import('./SiteAccountMenu')`.
  load: () => Promise<{ default: ComponentType<DeferredMenuProps> }>;
  // Whether the product's hint cookie says someone is signed in (false until hydrated).
  useSignedInHint: () => boolean;
}) {
  const SiteAccountMenu = lazy(load);

  return function SiteAccount() {
    const hydrated = useSyncExternalStore(noSubscription, hydratedNow, notHydrated);
    const signedIn = useSignedInHint();
    if (!hydrated) return <AccountMenuPlaceholder />;
    if (!signedIn) return <DeferredAccountMenu load={load} />;
    return (
      <Suspense fallback={<AccountMenuPlaceholder />}>
        <SiteAccountMenu />
      </Suspense>
    );
  };
}
