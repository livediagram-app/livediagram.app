'use client';

// Offline in the Explorer: the host app's items kept only in this browser (this-browser.ts), where the host can
// read them (the Explorer served on the app's own address). They show as liveplanner's own Explorer showed them: a
// sidebar row with their count, a view of their own (`/explorer/offline`), an offline group in the Trash, and
// among Recent in Home's Most Used and Recent. The editor's Explorer panel has the same view (panel/PanelThisBrowser.tsx). Each
// opens in its app's editor, which does the rest (rename, restore): the index never sees them, so the Explorer only
// lists them. Where the app moves them into the account, each live row also has Sync: in place in the editor's panel
// (`sync`), or, on the Explorer page, a hand-over to the app's editor (this-browser.ts `thisBrowserConvertHref`).
// Most Used and Recent's card of one has Offline's menu (ThisBrowserItemMenu: Open, Sync, Delete where the host can)
// and drags to the Trash or a place (drag.tsx), each through these same verbs.

import { useMemo, useState, type ReactNode } from 'react';
import {
  BROWSER_STORAGE_COPY,
  THIS_BROWSER_COPY,
  type ThisBrowserConversion,
  type ThisBrowserItem,
} from '../this-browser';
import { DAY_MONTH } from '@liveworkspace/ui/date-format';
import { LIST_CARD, MUTED } from '../ui/classes';
import { ArchiveIcon, FolderOutlineIcon, TrashIcon } from '../ui/icons';
import { useExplorer } from './context';
import { BrowserIcon, useHostExtras } from './host';
import { PaneIconButton } from '../panel/pane-parts';
import { LocalPreview } from './LocalPreview';
import { useThisBrowserDrag } from '../drag/drag';
import { useSyncLocal } from './this-browser-space/space';
import { daysLeftLabel, TrashGroupHeader } from './TrashPane';
import { useArchiveLocal, ThisBrowserPill } from './ThisBrowserItemMenu';
export { useThisBrowserList, useThisBrowserFolders } from './this-browser-store';
export {
  thenReload,
  useArchiveLocal,
  openThisBrowserItem,
  ThisBrowserPill,
  ChangedAgo,
  ThisBrowserItemMenu,
} from './ThisBrowserItemMenu';

/** What a host hands the Explorer for Offline. */
export type ThisBrowserHost = {
  // Newest change first, live and trashed alike.
  items: readonly ThisBrowserItem[];
  // Where the app opens one.
  itemHref: (item: ThisBrowserItem) => string;
  // The app's help on keeping items in this browser; the pill links there.
  helpHref?: string;
  // Where the app moves one into the person's account (Sync), when it can for this person (signed in). None: no Sync.
  syncHref?: (item: ThisBrowserItem) => string;
  // The editor's panel, which runs the app's own code: opens one in the editor (default: a page load of `itemHref`),
  // moves one into the account in place (Sync, signed in), and deletes one for good (nothing else holds it).
  // Sync's promise settles once the item has moved, and the lists load again then.
  open?: (item: ThisBrowserItem) => void;
  sync?: (item: ThisBrowserItem) => Promise<unknown> | void;
  remove?: (item: ThisBrowserItem) => void;
  // The Explorer page: where the app runs a Take Offline or Sync handed over at `/explorer/offline?convert=…&item=…`
  // (an older `/offline` link, redirected): the item's own address in its editor, which asks first.
  handOverHref?: (conversion: ThisBrowserConversion, id: string) => string;
};

export { BROWSER_STORAGE_COPY, THIS_BROWSER_COPY };

/** What Offline says with nothing kept, on the page and in the panel. */
export const THIS_BROWSER_EMPTY = 'Nothing is kept Offline.';
export { LocalPreview };

// Live: out of the app's Trash and out of Archived (one-explorer.md "Archived"), which only Archived lists.
const live = (i: ThisBrowserItem) => i.trashedAt === null && !i.archivedAt;
const localTrashed = (i: ThisBrowserItem) => i.trashedAt !== null && !i.archivedAt;
/** Archived in this browser, newest first. */
export const localArchived = (i: ThisBrowserItem) => i.trashedAt === null && Boolean(i.archivedAt);

/** The live items, newest change first. */
export function useThisBrowserItems(): { host: ThisBrowserHost | null; live: ThisBrowserItem[] } {
  const { thisBrowser } = useHostExtras();
  const items = useMemo(() => thisBrowser?.items.filter(live) ?? [], [thisBrowser]);
  return { host: thisBrowser, live: items };
}

/** Most Used and Recent's merge: the opened ones among `recent`, by the same rule (last opened first), at most `max`. */
export function mergeOpened<T extends { lastOpenedAt: number | null }>(
  recent: readonly T[],
  local: readonly ThisBrowserItem[],
  max: number,
): (T | ThisBrowserItem)[] {
  const opened = local.filter((i) => i.lastOpenedAt !== null);
  if (opened.length === 0) return [...recent];
  return [...recent, ...opened]
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
    .slice(0, Math.max(max, recent.length));
}

const SYNC_LINK =
  'mr-3 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-300 dark:hover:bg-slate-800';

/** One item kept in this browser, as a row: Offline's list (ThisBrowserPane.tsx) and the Trash's group. */
export function LocalRow({
  item,
  detail,
  sync = false,
}: {
  item: ThisBrowserItem;
  detail: ReactNode;
  // Offer Sync and Delete beside it (a live row, where the host can).
  sync?: boolean;
}) {
  const { thisBrowser } = useHostExtras();
  const { app, kind, openDialog } = useExplorer();
  const archive = useArchiveLocal();
  const syncLocal = useSyncLocal();
  const drag = useThisBrowserDrag(item);
  const name = item.title || 'Untitled';
  // A row in a local folder syncs through the dialog that keeps its place; one at the root as it always did.
  const syncHref = sync && !item.folderId ? thisBrowser?.syncHref?.(item) : undefined;
  return (
    // On a phone the actions take a line of their own under the title: beside it they left the title no room.
    <li
      data-this-browser-row={item.id}
      className="flex flex-wrap items-center justify-end pb-2 sm:flex-nowrap sm:pb-0"
      {...(sync ? drag : {})}
    >
      <a
        href={thisBrowser?.itemHref(item)}
        className="flex min-w-0 flex-1 basis-full items-center sm:basis-auto gap-3 px-4 py-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 dark:hover:bg-slate-800/60"
      >
        <LocalPreview app={app} iconSize={14} className="h-8 w-8 shrink-0 rounded-lg" />
        <span className="flex min-w-0 flex-1 flex-col">
          {/* On a phone a long title takes its line and the pill goes under it; wider, the title truncates beside it. */}
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 sm:flex-nowrap">
            <span className="max-w-full truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {name}
            </span>
            <ThisBrowserPill inLink />
          </span>
          <span className={`text-xs ${MUTED}`}>{detail}</span>
        </span>
      </a>
      {syncHref ? (
        <a href={syncHref} aria-label={`Sync ${kind.one}: ${name}`} className={SYNC_LINK}>
          Sync {kind.one}
        </a>
      ) : sync && syncLocal ? (
        <button
          type="button"
          aria-label={`Sync ${kind.one}: ${name}`}
          onClick={() => syncLocal(item)}
          className={`${SYNC_LINK} cursor-pointer`}
        >
          Sync {kind.one}
        </button>
      ) : null}
      {sync ? (
        <span className="mr-1 shrink-0">
          <PaneIconButton
            label={`Move to Folder: ${name}`}
            onClick={() => openDialog({ kind: 'move-local-item', item })}
          >
            <FolderOutlineIcon />
          </PaneIconButton>
        </span>
      ) : null}
      {sync ? (
        <span className="mr-1 shrink-0">
          <PaneIconButton label={`Move to Archived: ${name}`} onClick={() => archive(item)}>
            <ArchiveIcon />
          </PaneIconButton>
        </span>
      ) : null}
      {sync && thisBrowser?.remove ? (
        // For good, asked first: the panel's Offline rows do the same (liveworkspace/docs/specs/004-index/one-explorer.md "Offline").
        <span className="mr-3 shrink-0">
          <PaneIconButton
            label={`Delete ${name}`}
            tone="danger"
            onClick={() => openDialog({ kind: 'delete-local', item })}
          >
            <TrashIcon />
          </PaneIconButton>
        </span>
      ) : null}
    </li>
  );
}

/** How many of the host's local items wait in its Trash. */
export function useThisBrowserTrashed(): number {
  const { thisBrowser } = useHostExtras();
  return useMemo(() => thisBrowser?.items.filter(localTrashed).length ?? 0, [thisBrowser]);
}

/** The Trash's Offline group: each opens in its app, whose own Trash restores or deletes it. */
export function ThisBrowserTrashGroup() {
  const { thisBrowser } = useHostExtras();
  const [now] = useState(() => Date.now());
  const trashed = useMemo(() => thisBrowser?.items.filter(localTrashed) ?? [], [thisBrowser]);
  if (trashed.length === 0) return null;
  return (
    <section
      aria-labelledby="trash-this-browser"
      data-trash-group="this-browser"
      className={LIST_CARD}
    >
      <TrashGroupHeader
        id="trash-this-browser"
        title={BROWSER_STORAGE_COPY.label}
        icon={<BrowserIcon />}
        tone="teal"
        count={trashed.length}
        action={
          <span className={`text-xs ${MUTED} max-sm:hidden`}>
            Open one to restore or delete it.
          </span>
        }
      />
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {trashed.map((item) => (
          <LocalRow
            key={item.id}
            item={item}
            detail={`Deleted ${DAY_MONTH.format(item.trashedAt!)} · ${daysLeftLabel(item.trashedAt!, now)}`}
          />
        ))}
      </ul>
    </section>
  );
}
