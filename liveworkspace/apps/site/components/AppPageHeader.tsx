'use client';

// The header of a liveworkspace page shown for an app (liveworkspace/docs/specs/010-site/site.md "The Explorer", The
// header; "The Community", The header): the liveworkspace logo with the site switcher, then, for a page shown for an
// app, a slanted hairline and that app's logo, which leads back to it (on a phone, the app's logo alone). A middle slot
// (the Explorer's search field) and the account control on the right, as the site's own header has them: the same
// height, border and frosted bar. The Explorer and the Community page both wear it, so `liveworkspace | app` reads the
// same on each.
//
// On an app's own address (lib/explorer/page-app.ts) the page is the app's: the liveworkspace logo leads to
// liveworkspace.app, the app's logo to the app's home on this address, and the account control is the app's session.
// The switcher marks the app whose address this is, else liveworkspace, and each site's row leads where the page says
// (`hrefFor`: the same page on that site), else to that site's home.

import { useSyncExternalStore, type ReactNode } from 'react';
import { SiteSwitcher } from '@livediagram/ui';
import { siteOfApp, type AppName, type Site } from '@liveworkspace/sites';
import { AccountControl, type SettingsControl } from '@/components/AccountControl';
import { AppAccountControl } from '@/components/explorer/AppAccountControl';
import { pageApp, workspaceOrigin } from '@/lib/explorer/page-app';
import { Wordmark } from '@/components/Wordmark';
import { AppLogo } from '@/components/landing/AppLogo';
import { listedApps } from '@/lib/apps';

const noChange = () => () => {};

export function AppPageHeader({
  app,
  center = null,
  hrefFor = null,
  settings = null,
  marker,
}: {
  // The app the page is shown for, whose logo follows the hairline; null for none.
  app: AppName | null;
  // What sits in the middle (the Explorer's search field), if anything.
  center?: ReactNode;
  // Each site's row in the switcher: this page on that site. Null leads each to its home.
  hrefFor?: ((site: Site) => string) | null;
  // The page's own Settings panel, for whoever has settings here (null: the control's own, or none).
  settings?: SettingsControl | null;
  // Names the header for its page's styles and tests (`data-explorer-header`, `data-community-header`).
  marker: 'explorer' | 'community';
}) {
  // Null while prerendered and on liveworkspace.app.
  const host = useSyncExternalStore(noChange, pageApp, () => null);
  const listed = app ? listedApps().find((a) => a.id === siteOfApp(app).id) : undefined;
  return (
    <header
      {...{ [`data-${marker}-header`]: '' }}
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
                {...{ [`data-${marker}-from`]: app }}
                aria-label={`Back to ${listed.name}`}
                className="relative touch-target-y inline-flex items-center rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
              >
                <AppLogo app={listed} size="md" />
              </a>
            </>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          {center ? <div className="w-full max-w-md">{center}</div> : null}
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
