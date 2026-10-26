'use client';

// The Explorer's header on liveworkspace.app (liveworkspace/docs/specs/010-site/site.md "The Explorer"): the liveworkspace logo,
// then, for a person who came from an app, a hairline and that app's logo, which leads back to it (on a phone, the
// app's logo alone). The search field
// sits in the middle (on Home the hero holds it instead) and the account control on the right, as the site's own
// header has them: the same height, border and frosted bar. Search, Settings and Appearance are on the bottom bar
// (ExplorerBottomBar.tsx).
//
// On an app's own address (lib/explorer/page-app.ts) the page is the app's: the liveworkspace logo leads to
// liveworkspace.app, the app's logo to the app's home on this address, and the account control is the app's session.
// Either way the account menu's Settings opens the Explorer's own Settings panel in place (`settings`).
//
// The logo's site switcher keeps the person on the Explorer: each site's row opens that site's Explorer at the same
// view (liveworkspace/docs/specs/010-site/site-switcher.md "On an Explorer page"), worked out from this page's address. It marks the
// app whose address this is, else liveworkspace.

import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { SiteSwitcher } from '@livediagram/ui';
import { explorerSwitchHref, siteOfApp, type AppName } from '@liveworkspace/sites';
import { AccountControl, type SettingsControl } from '@/components/AccountControl';
import { AppAccountControl } from '@/components/explorer/AppAccountControl';
import { pageApp, workspaceOrigin } from '@/lib/explorer/page-app';
import { Wordmark } from '@/components/Wordmark';
import { AppLogo } from '@/components/landing/AppLogo';
import { listedApps } from '@/lib/apps';

const noChange = () => () => {};

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
  // Null while prerendered and on liveworkspace.app.
  const host = useSyncExternalStore(noChange, pageApp, () => null);
  const listed = app ? listedApps().find((a) => a.id === siteOfApp(app).id) : undefined;
  // Each site's row: its Explorer at this view, recomputed only when the view moves.
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const hrefFor = useMemo(() => explorerSwitchHref(pathname, query), [pathname, query]);
  return (
    <header
      data-explorer-header=""
      className="sticky top-0 z-40 h-16 shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80"
    >
      <div className="mx-auto flex h-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 shrink-0 items-center">
          {/* On a phone, with an app's logo beside it, only the app's shows: there is little room. */}
          <SiteSwitcher
            current={host ? siteOfApp(host).id : 'liveworkspace.app'}
            hrefFor={hrefFor}
            className={listed ? 'max-sm:hidden' : ''}
          >
            <a
              href={host ? `${workspaceOrigin()}/` : '/'}
              aria-label="liveworkspace home"
              className="relative touch-target-y"
            >
              <Wordmark className="max-sm:[&_[data-logotype]]:hidden" />
            </a>
          </SiteSwitcher>
          {listed ? (
            <>
              {/* The switcher's chevron (hidden until hover) holds 22px after the wordmark, so the hairline's
                  right margin is that much wider than its left: the gaps either side of it look equal. */}
              <span
                aria-hidden
                className="ml-1 mr-[26px] h-6 w-px rotate-12 bg-slate-300 max-sm:hidden dark:bg-slate-700"
              />
              <a
                href={host === app ? '/' : listed.url}
                data-explorer-from={app}
                aria-label={`Back to ${listed.name}`}
                className="relative touch-target-y inline-flex items-center rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
              >
                <AppLogo app={listed} size="md" />
              </a>
            </>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          {search ? <div className="w-full max-w-md">{search}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {host ? (
            <AppAccountControl settings={settings} />
          ) : (
            <AccountControl settings={settings} />
          )}
        </div>
      </div>
    </header>
  );
}
