'use client';

// The Explorer's bottom bar (liveworkspace/docs/specs/010-site/site.md "The Explorer", The bottom bar): stuck to the foot of the
// page, as the apps' own Explorers had it, its controls on the right: Search, Settings (a guest's too, on an app's
// address) and Appearance, each with its name beside its icon on a wide screen, icons alone on a narrow one. Its
// hints are portalled and open upward.
// The toasts and a guest's sign-in banner stand on it (`--explorer-floor`, EXPLORER_FLOOR).

import { SearchIcon, SettingsIcon, SiteAppearanceToggle } from '@livediagram/ui';
import { HoverCard } from '@liveworkspace/ui';

/** The bar's height, which the page hands the Explorer as `--explorer-floor`. */
export const EXPLORER_FLOOR = '3rem';

// The apps' bottom-bar controls (livediagram's chrome-button CHROME_BTN), widened for their names on a wide screen.
const BTN =
  'relative touch-target ml-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center gap-1.5 rounded-md md:px-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

// The control's name, beside its icon from `md` up; the icon alone (and its aria-label) below.
const LABEL = 'text-xs font-medium max-md:hidden';

export function ExplorerBottomBar({
  appName,
  onOpenSearch,
  onPrepareSearch,
  settingsHref,
  onOpenSettings,
  onPrepareSettings,
  settingsKept = 'account',
}: {
  // The app's name, for Settings' hover card; null for none.
  appName: string | null;
  onOpenSearch: () => void;
  // Pointed at: the panel's code is fetched ahead of the press.
  onPrepareSearch: () => void;
  // The account's settings page, for a person signed in: the button's way there before the panel's code loads.
  settingsHref: string | null;
  // The Settings panel, opened over the page (as the apps' Explorers did) rather than followed.
  onOpenSettings?: () => void;
  // Pointed at: the panel's code and the app's catalogue are fetched ahead of the press.
  onPrepareSettings?: () => void;
  // Where the settings are kept: the account's, or (a guest on an app's address) this browser.
  settingsKept?: 'account' | 'browser';
}) {
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
          <span className={LABEL}>Search</span>
        </button>
      </HoverCard>
      {onOpenSettings || settingsHref ? (
        <HoverCard
          title={settingsLabel}
          description={
            appName
              ? `Your ${appName} settings, kept ${settingsKept === 'browser' ? 'in this browser' : 'for your account'}.`
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
              <span className={LABEL}>Settings</span>
            </button>
          ) : (
            <a
              href={settingsHref ?? undefined}
              aria-label={settingsLabel}
              data-explorer-settings=""
              className={BTN}
            >
              <SettingsIcon size={16} />
              <span className={LABEL}>Settings</span>
            </a>
          )}
        </HoverCard>
      ) : null}
      <SiteAppearanceToggle look="rail" labelFrom="md" />
    </div>
  );
}
