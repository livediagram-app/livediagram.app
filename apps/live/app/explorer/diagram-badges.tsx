'use client';

// The marks a diagram carries in the Explorer's list rows and cards, and
// in its actions menu's header: the visibility badge, the favourite star
// and the folder chip. Split from diagram-row-shared (the menu) so each
// file holds one concern.

import { SharedDotIcon } from '@/components/chrome/share-state-icons';
import { FolderOutlineIcon, StarIcon } from '@/components/primitives/explorer-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import type { PaneDiagram } from './views';

const badgeBase =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1';

// The star a favourited diagram carries wherever it's listed (spec/95),
// so you can tell a starred diagram from an unstarred one without opening
// its menu. Amber rather than the brand colour: it's a personal mark on
// someone else's palette of status badges, and reads as "mine" next to
// them.
//
// Unlike hidden-from-Recent (spec/93), which stays menu-only, this IS
// worth a marker: hiding is a set-and-forget negative you rarely revisit,
// where a favourite is a positive you actively scan for.
export function FavouriteMarker() {
  return (
    <Tooltip
      title="Favourite"
      description="Starred by you. Find it under Favourites in Quick find."
    >
      <span className="inline-flex shrink-0 items-center text-amber-500 dark:text-amber-400">
        <StarIcon filled />
      </span>
    </Tooltip>
  );
}

// Where a diagram lives, shown on Recent rows (spec/94). Recent spans every
// folder, so without this you can't tell a "Q3 plan" in Design from one in
// Archive without opening it.
//
// Deliberately NOT the badgeBase treatment: those badges are uppercase,
// ring-outlined statements about the diagram (Offline / Shared / Team /
// Private). This is a quiet, lower-case location that happens to be
// clickable, so it reads as a link rather than competing with them.
//
// Only the IMMEDIATE parent is shown. Folders nest arbitrarily deep, and a
// full path would be unbounded on a row that has to stay compact; the
// containing folder is the identifying bit in practice.
export function FolderChip({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <Tooltip title={label} description="Go to this folder.">
      <button
        type="button"
        onClick={(e) => {
          // The whole row is a link to the diagram; this jumps to the
          // folder instead, so it must not bubble into that.
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }}
        className="inline-flex max-w-[10rem] items-center gap-1 rounded px-1 py-0.5 text-[11px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <span className="shrink-0 [&_svg]:h-3 [&_svg]:w-3">
          <FolderOutlineIcon />
        </span>
        <span className="truncate">{label}</span>
      </button>
    </Tooltip>
  );
}

// The visibility badge: Offline (saved only in this browser, spec/76), Shared
// (a shared-with-me row / a share-link owned row), Team, or Private. Each
// carries a concise hover tooltip explaining what the state means. Offline
// wins first: an offline diagram is never shared or in a team.
export function VisibilityBadge({ diagram }: { diagram: PaneDiagram }) {
  if (diagram.ownerId === OFFLINE_OWNER_ID) {
    return (
      <Tooltip title="Offline" description="Saved only in this browser. Not synced or backed up.">
        <span
          className={`${badgeBase} bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30`}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2.4 6.6h3.4a1.4 1.4 0 0 0 .2-2.8 1.9 1.9 0 0 0-3.3-.5A1.35 1.35 0 0 0 2.4 6.6Z" />
            <path d="M1.4 1.4l6.2 6.2" />
          </svg>
          Offline
        </span>
      </Tooltip>
    );
  }
  if (diagram.shared || diagram.shareCode) {
    return (
      <Tooltip title="Shared" description="Anyone with the link can open it.">
        <span
          className={`${badgeBase} bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30`}
        >
          <SharedDotIcon />
          Shared
        </span>
      </Tooltip>
    );
  }
  if (diagram.team) {
    return (
      <Tooltip
        title="Team"
        description="In a team library, so every member of the team can open it."
      >
        <span
          className={`${badgeBase} bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30`}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="3.2" cy="3.2" r="1.4" />
            <path d="M1.2 7.8c.3-1.4 1-2.1 2-2.1s1.7.7 2 2.1" />
            <circle cx="6.6" cy="3.6" r="1.1" />
            <path d="M6.3 5.7c.9.1 1.5.7 1.7 1.8" />
          </svg>
          Team
        </span>
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Private" description="Only visible to you.">
      <span
        className={`${badgeBase} bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700`}
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 9 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="1.6" y="4" width="5.8" height="3.6" rx="0.9" />
          <path d="M3 4V2.9a1.5 1.5 0 0 1 3 0V4" />
        </svg>
        Private
      </span>
    </Tooltip>
  );
}
