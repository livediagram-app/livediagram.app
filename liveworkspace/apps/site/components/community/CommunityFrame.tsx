'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { AppPageHeader } from '@/components/AppPageHeader';
import { Footer } from '@/components/Footer';
import { SiteRail } from '@/components/SiteRail';
import { communitySwitchHref } from '@/lib/community/switch-href';
import { pageApp, workspaceOrigin } from '@/lib/explorer/page-app';

const noChange = () => () => {};
const none = () => null;
// The served HTML is one file for every address, so it names liveworkspace.app in full: a bare `/compare` 404s on an
// app's address until hydration swaps the base (`base` below).
const serverBase = () => PLATFORM_SITE.url;

// The Community page's frame (liveworkspace/docs/specs/010-site/site.md "The Community"): the `liveworkspace | app`
// header the Explorer wears (AppPageHeader.tsx), the page in the colours of the app whose address it is on
// (`data-community-app`, app/app-colours.css; liveworkspace's slate on liveworkspace.app), the rail with the
// Appearance card, and the site's footer. On an app's address the footer's links are liveworkspace.app's pages, so
// they lead there in full.
export function CommunityFrame({ children }: { children: ReactNode }) {
  const host = useSyncExternalStore(noChange, pageApp, none);
  const base = useSyncExternalStore(
    noChange,
    () => (pageApp() ? workspaceOrigin() : ''),
    serverBase,
  );
  return (
    <div data-community-app={host ?? ''} className="flex min-h-dvh flex-col">
      <AppPageHeader app={host} hrefFor={communitySwitchHref} marker="community" />
      <SiteRail />
      <main className="flex-1 pb-20">{children}</main>
      <Footer base={base} />
    </div>
  );
}
