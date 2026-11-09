'use client';

// Archived's This Browser group (liveworkspace/docs/specs/004-index/one-explorer.md "Archived"): what the host app
// keeps only in this browser and the person archived here (this-browser.ts `setThisBrowserArchived`). Each row has its
// local picture and the This Browser pill, and is closed: a click says it is archived, Change Folder moves it back to
// This Browser (or, signed in, syncs it into the account), and Delete removes it for good where the host deletes in
// place. Nothing on liveworkspace.app, which can't read the app's store.

import { useMemo } from 'react';
import { localArchived, ChangedAgo, ThisBrowserPill, THIS_BROWSER_COPY } from './ThisBrowser';
import type { ThisBrowserItem } from '../this-browser';
import { LIST_CARD, MUTED } from '../ui/classes';
import { FolderOutlineIcon, TrashIcon } from '../ui/icons';
import { PaneIconButton } from '../panel/pane-parts';
import { useExplorer } from './context';
import { useHostExtras } from './host';
import { LocalPreview } from './LocalPreview';

/** The host's items archived in this browser, newest first. */
export function useThisBrowserArchived(): ThisBrowserItem[] {
  const { thisBrowser } = useHostExtras();
  return useMemo(
    () =>
      (thisBrowser?.items.filter(localArchived) ?? []).sort(
        (a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0),
      ),
    [thisBrowser],
  );
}

export function ThisBrowserArchivedGroup({ first = false }: { first?: boolean }) {
  const { openDialog } = useExplorer();
  const { thisBrowser } = useHostExtras();
  const archived = useThisBrowserArchived();
  if (archived.length === 0) return null;
  return (
    <section
      aria-labelledby="archived-this-browser"
      data-archived-group="this-browser"
      className={`${LIST_CARD} ${first ? '' : 'mt-6'}`}
    >
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700/60">
        <h2
          id="archived-this-browser"
          className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          {THIS_BROWSER_COPY.label}
        </h2>
        <span className={`text-xs ${MUTED}`}>Archived here, never uploaded.</span>
      </header>
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {archived.map((item) => (
          <ArchivedLocalRow
            key={item.id}
            item={item}
            onOpen={() => openDialog({ kind: 'archived-local', item })}
            onMove={() => openDialog({ kind: 'move-local', item })}
            onDelete={
              thisBrowser?.remove ? () => openDialog({ kind: 'delete-local', item }) : undefined
            }
          />
        ))}
      </ul>
    </section>
  );
}

function ArchivedLocalRow({
  item,
  onOpen,
  onMove,
  onDelete,
}: {
  item: ThisBrowserItem;
  onOpen: () => void;
  onMove: () => void;
  onDelete?: () => void;
}) {
  const { app } = useExplorer();
  const name = item.title || 'Untitled';
  return (
    <li data-this-browser-row={item.id} data-archived="" className="flex items-center">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 dark:hover:bg-slate-800/60"
      >
        <LocalPreview app={app} iconSize={14} className="h-8 w-8 shrink-0 rounded-lg" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {name}
            </span>
            <ThisBrowserPill inLink />
          </span>
          <span className={`text-xs ${MUTED}`}>
            <ChangedAgo at={item.updatedAt} />
          </span>
        </span>
      </button>
      <span className="mr-3 flex shrink-0 items-center gap-1">
        <PaneIconButton label={`Change Folder: ${name}`} onClick={onMove}>
          <FolderOutlineIcon />
        </PaneIconButton>
        {onDelete ? (
          <PaneIconButton label={`Delete ${name}`} tone="danger" onClick={onDelete}>
            <TrashIcon />
          </PaneIconButton>
        ) : null}
      </span>
    </li>
  );
}
