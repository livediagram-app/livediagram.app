'use client';

import { HoverCard } from '@livediagram/ui';
import { useExplorer } from '../ExplorerContext';
import { SearchSidebarIcon, SidebarSectionLabel } from './SidebarRow';

// The sidebar's head: the greeting and the search field. The signed-in
// greeting opens Settings (docs/specs/014-identity/profile-and-email-notifications.md); guests have
// no profile, so theirs is plain text. Search closes the mobile drawer.
export function SidebarGreeting() {
  const { clerkDisplayName, clerkUserId, setSearchOpen, setSettingsOpen, setMobileNavOpen } =
    useExplorer();
  return (
    <>
      <SidebarSectionLabel first>
        {clerkUserId ? (
          <HoverCard
            title="Account"
            description="Your account, email notifications, and everything else, in Settings."
          >
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded transition hover:text-brand-700 hover:underline dark:hover:text-brand-300"
            >
              Hi {clerkDisplayName ?? 'there'}
            </button>
          </HoverCard>
        ) : (
          <>Hi {clerkDisplayName ?? 'there'}</>
        )}
      </SidebarSectionLabel>
      <button
        type="button"
        onClick={() => {
          setSearchOpen(true);
          setMobileNavOpen(false);
        }}
        className="mt-2 flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-2 text-left text-xs text-slate-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
      >
        <SearchSidebarIcon />
        <span className="flex-1 truncate">Search…</span>
      </button>
      <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" aria-hidden />
    </>
  );
}
