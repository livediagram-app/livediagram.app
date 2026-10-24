'use client';

// The Explorer's bottom bar (liveworkspace/docs/site.md "The Explorer", The bottom bar): stuck to the foot of the
// page, as the apps' own Explorers had it, its controls on the right: Search, GitHub (hidden on a phone, the one
// control that leaves), Settings (signed in) and Appearance. Its hints are portalled and open upward, above the bar.
// The toasts and a guest's sign-in banner stand on it (`--explorer-floor`, EXPLORER_FLOOR).

import {
  Glyph,
  HoverCard,
  REPO_URL,
  SearchIcon,
  SettingsIcon,
  SiteAppearanceToggle,
} from '@livediagram/ui';
import type { AppName } from '@liveworkspace/sites';

/** The bar's height, which the page hands the Explorer as `--explorer-floor`. */
export const EXPLORER_FLOOR = '3rem';

// Each app's open-source code; livediagram's, where the platform's own came from, for the others.
const REPOS: Partial<Record<AppName, string>> = {
  livedocuments: 'https://github.com/livedocuments-app/livedocuments.app',
  livedesign: 'https://github.com/livedesign-app/livedesign.app',
};

// The apps' bottom-bar controls (livediagram's chrome-button CHROME_BTN).
const BTN =
  'relative touch-target ml-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

function GithubIcon() {
  return (
    <Glyph size={16} units={16} filled>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </Glyph>
  );
}

export function ExplorerBottomBar({
  app,
  appName,
  onOpenSearch,
  onPrepareSearch,
  settingsHref,
  onOpenSettings,
  onPrepareSettings,
}: {
  app: AppName | null;
  // The app's name, for Settings' hover card; null for none.
  appName: string | null;
  onOpenSearch: () => void;
  // Pointed at: the panel's code is fetched ahead of the press.
  onPrepareSearch: () => void;
  // The account's settings, for a person signed in; null hides Settings.
  settingsHref: string | null;
  // The Settings panel, opened over the page (as the apps' Explorers did) rather than followed.
  onOpenSettings?: () => void;
  // Pointed at: the panel's code and the app's catalogue are fetched ahead of the press.
  onPrepareSettings?: () => void;
}) {
  const repo = (app && REPOS[app]) ?? REPO_URL;
  const settingsLabel = appName ? `${appName} Settings` : 'Settings';
  return (
    <div
      data-explorer-bottom-bar=""
      className="sticky bottom-0 z-30 flex h-12 shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <HoverCard title="Search" description="Find items, folders, teams, help and settings.">
        <button
          type="button"
          onClick={onOpenSearch}
          onPointerEnter={onPrepareSearch}
          onFocus={onPrepareSearch}
          aria-label="Search"
          aria-keyshortcuts="Meta+K Control+K"
          className={BTN}
        >
          <SearchIcon size={14} />
        </button>
      </HoverCard>
      {/* A wrapper, not the HoverCard's className: its own inline-flex outranks a `hidden` beside it. */}
      <span className="hidden sm:contents">
        <HoverCard title="Source on GitHub" description="View the open-source code on GitHub.">
          <a
            href={repo}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Source on GitHub"
            className={BTN}
          >
            <GithubIcon />
          </a>
        </HoverCard>
      </span>
      {settingsHref ? (
        <HoverCard
          title={settingsLabel}
          description={
            appName
              ? `Your ${appName} settings, kept for your account.`
              : 'Your account’s settings, for every app.'
          }
        >
          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              onPointerEnter={onPrepareSettings}
              onFocus={onPrepareSettings}
              aria-label={settingsLabel}
              aria-haspopup="dialog"
              data-explorer-settings=""
              className={BTN}
            >
              <SettingsIcon size={16} />
            </button>
          ) : (
            <a
              href={settingsHref}
              aria-label={settingsLabel}
              data-explorer-settings=""
              className={BTN}
            >
              <SettingsIcon size={16} />
            </a>
          )}
        </HoverCard>
      ) : null}
      <SiteAppearanceToggle look="rail" />
    </div>
  );
}
