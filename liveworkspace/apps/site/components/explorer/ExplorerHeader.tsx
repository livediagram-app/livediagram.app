'use client';

// The Explorer's header on liveworkspace.app (liveworkspace/docs/site.md "The Explorer"): the liveworkspace logo,
// then, for a person who came from an app, a hairline and that app's logo, which leads back to it. The search field
// sits in the middle (on Home the hero holds it instead) and the account control on the right, as the site's own
// header has them: the same height, border and frosted bar.

import type { ReactNode } from 'react';
import { SiteSwitcher } from '@livediagram/ui';
import { siteOfApp, type AppName } from '@liveworkspace/sites';
import { AccountControl } from '@/components/AccountControl';
import { Wordmark } from '@/components/Wordmark';
import { AppLogo } from '@/components/landing/AppLogo';
import { listedApps } from '@/lib/apps';

export function ExplorerHeader({ app, search }: { app: AppName | null; search: ReactNode }) {
  const listed = app ? listedApps().find((a) => a.id === siteOfApp(app).id) : undefined;
  return (
    <header
      data-explorer-header=""
      className="sticky top-0 z-40 h-16 shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80"
    >
      <div className="mx-auto flex h-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          <SiteSwitcher current="liveworkspace.app">
            <a href="/" aria-label="liveworkspace home" className="relative touch-target-y">
              <Wordmark className="max-sm:[&_[data-logotype]]:hidden" />
            </a>
          </SiteSwitcher>
          {listed ? (
            <>
              <span aria-hidden className="h-6 w-px rotate-12 bg-slate-300 dark:bg-slate-700" />
              <a
                href={listed.url}
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
        <div className="flex shrink-0 items-center">
          <AccountControl />
        </div>
      </div>
    </header>
  );
}
