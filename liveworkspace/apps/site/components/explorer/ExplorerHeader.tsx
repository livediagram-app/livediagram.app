'use client';

// The Explorer's header on liveworkspace.app (liveworkspace/docs/site.md "The Explorer"): the liveworkspace logo,
// then, for a person who came from an app, a hairline and that app's logo, which leads back to it (on a phone, the
// app's logo alone). The search field
// sits in the middle (on Home the hero holds it instead) and the account control on the right, as the site's own
// header has them: the same height, border and frosted bar. The Explorer runs the page's full width, so the rail the
// site's other pages keep Appearance on (SiteRail) would sit over it; its Light / Dark / System control is here,
// beside the account, at every width.
//
// On an app's own address (lib/explorer/page-app.ts) the page is the app's: the liveworkspace logo leads to
// liveworkspace.app, the app's logo to the app's home on this address, and the account control is the app's session.
// Signed in there, a Settings button beside Appearance opens the app's own settings on liveworkspace.app, where they
// are kept for the account (`settingsHref`), as the app's own Explorer had them on its bottom bar.

import { useSyncExternalStore, type ReactNode } from 'react';
import { lucideGlyph, SiteAppearanceToggle, SiteSwitcher, Tooltip } from '@livediagram/ui';
import { lucideSettings } from '@livediagram/icons/lucide';
import { siteOfApp, type AppName } from '@liveworkspace/sites';
import { AccountControl } from '@/components/AccountControl';
import { AppAccountControl } from '@/components/explorer/AppAccountControl';
import { pageApp, workspaceOrigin } from '@/lib/explorer/page-app';
import { Wordmark } from '@/components/Wordmark';
import { AppLogo } from '@/components/landing/AppLogo';
import { listedApps } from '@/lib/apps';

const noChange = () => () => {};
const SettingsIcon = lucideGlyph(lucideSettings, 18);

export function ExplorerHeader({
  app,
  search,
  settingsHref = null,
}: {
  app: AppName | null;
  search: ReactNode;
  // The app's settings, on an app's address for a person signed in; none elsewhere.
  settingsHref?: string | null;
}) {
  // Null while prerendered and on liveworkspace.app.
  const host = useSyncExternalStore(noChange, pageApp, () => null);
  const listed = app ? listedApps().find((a) => a.id === siteOfApp(app).id) : undefined;
  return (
    <header
      data-explorer-header=""
      className="sticky top-0 z-40 h-16 shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80"
    >
      <div className="mx-auto flex h-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 shrink-0 items-center">
          {/* On a phone, with an app's logo beside it, only the app's shows: there is little room. */}
          <SiteSwitcher current="liveworkspace.app" className={listed ? 'max-sm:hidden' : ''}>
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
          {settingsHref ? (
            <Tooltip label={`${listed?.name ?? 'App'} Settings`}>
              <a
                href={settingsHref}
                aria-label={`${listed?.name ?? 'App'} Settings`}
                data-explorer-settings=""
                className="relative touch-target inline-flex size-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <SettingsIcon />
              </a>
            </Tooltip>
          ) : null}
          <SiteAppearanceToggle />
          {host ? <AppAccountControl /> : <AccountControl />}
        </div>
      </div>
    </header>
  );
}
