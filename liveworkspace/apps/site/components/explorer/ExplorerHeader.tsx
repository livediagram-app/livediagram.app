'use client';

// The Explorer's header on liveworkspace.app (liveworkspace/docs/specs/010-site/site.md "The Explorer"): the shared
// `liveworkspace | app` header (AppPageHeader.tsx), with the search field in the middle (on Home the hero holds it
// instead). Search, Settings and Appearance are on the bottom bar (ExplorerBottomBar.tsx). Either way the account
// menu's Settings opens the Explorer's own Settings panel in place (`settings`).
//
// The logo's site switcher keeps the person on the Explorer: each site's row opens that site's Explorer at the same
// view (liveworkspace/docs/specs/010-site/site-switcher.md "On an Explorer page"), worked out from this page's address.

import { useMemo, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { explorerSwitchHref, type AppName } from '@liveworkspace/sites';
import type { SettingsControl } from '@/components/AccountControl';
import { AppPageHeader } from '@/components/AppPageHeader';

export function ExplorerHeader({
  app,
  search,
  settings = null,
}: {
  app: AppName | null;
  search: ReactNode;
  // The Explorer's Settings panel, for whoever has settings here (null: a guest on liveworkspace.app has none).
  settings?: SettingsControl | null;
}) {
  // Each site's row: its Explorer at this view, recomputed only when the view moves.
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const hrefFor = useMemo(() => explorerSwitchHref(pathname, query), [pathname, query]);
  return (
    <AppPageHeader
      app={app}
      center={search}
      hrefFor={hrefFor}
      settings={settings}
      marker="explorer"
    />
  );
}
