'use client';

// Offline's own view (`/explorer/offline`), from its own chunk (lazy-panes.ts): only that view draws it, so it and its
// folder cards are out of the Explorer's first load. What else shows Offline's items (Home, the Trash, the panel)
// stays in ThisBrowser.tsx.

import { useEffect, useMemo } from 'react';
import {
  readThisBrowserConversion,
  BROWSER_STORAGE_COPY,
  localChildren,
  localPath,
} from '../this-browser';
import { CARD_GRID, LIST_CARD, MUTED } from '../ui/classes';
import { useExplorer } from './context';
import { PaneHeader, type Crumb } from './PaneHeader';
import { parseLens } from '../lens';
import { SIDEBAR_LABELS, viewLens, withLens } from '../views';
import { Button } from '@liveworkspace/ui';
import { LocalFolderCard } from './this-browser-space/LocalFolderCard';
import { LOCAL_FOLDER_COPY, useCreateLocalFolder } from './this-browser-space/space';
import { FilteredEmpty, LensBar } from './lazy-lens';
import { LensAnnouncer } from './LensAnnouncer';
import { useLensContext } from './SearchField';
import {
  itemsByFolder,
  narrowLocalFolders,
  narrowThisBrowser,
  thisBrowserSubjects,
} from './this-browser-lens';
import { ChangedAgo } from './ThisBrowserItemMenu';
import { NO_ITEMS, useThisBrowserFolders } from './this-browser-store';
import {
  LocalRow,
  THIS_BROWSER_EMPTY,
  useThisBrowserItems,
  type ThisBrowserHost,
} from './ThisBrowser';

/** `/explorer/offline`: Offline's Space (one-explorer.md "Offline, a Space"), at its root or one of its
 *  folders (`?folder=`): the back bar to the level above, New Folder, the folders here as cards by name, then the live
 *  items here as rows, newest change first, both narrowed by the lens. `folder` is the address's `?folder=`. */
export function ThisBrowserPane({ folder }: { folder: string | null }) {
  const { words, view, app, navigate, lensSubjects, setRenamingId } = useExplorer();
  const { host, live } = useThisBrowserItems();
  const folders = useThisBrowserFolders(host ? app : null);
  useHandOver(host);
  const create = useCreateLocalFolder();
  // An unknown folder (deleted, or another browser's link) shows the root.
  const path = useMemo(() => localPath(folders, folder), [folders, folder]);
  const open = path.length > 0 ? path[path.length - 1]! : null;
  const here = open?.id ?? null;
  // The lens the address carries, matched here: the index never sees these items.
  const lensContext = useLensContext();
  const q = viewLens(view);
  const parsed = useMemo(() => parseLens(q, lensContext), [q, lensContext]);
  const atLevel = useMemo(() => live.filter((i) => (i.folderId ?? null) === here), [live, here]);
  const items = useMemo(
    () => narrowThisBrowser(atLevel, parsed.lens, app, Date.now()),
    [atLevel, parsed, app],
  );
  const kids = useMemo(() => localChildren(folders, here), [folders, here]);
  const shownFolders = useMemo(() => narrowLocalFolders(kids, parsed.lens), [kids, parsed]);
  // Each folder's live items (newest first), for its card: one pass over the list.
  const inside = useMemo(() => itemsByFolder(live), [live]);
  // The list is always whole, so the field can mark a value that matches nothing.
  useEffect(() => {
    lensSubjects.current = thisBrowserSubjects(atLevel, app);
    return () => void (lensSubjects.current = null);
  }, [lensSubjects, atLevel, app]);
  const holdsHere = atLevel.length > 0 || kids.length > 0;
  // Something is kept here, but the lens leaves nothing: only a set lens can.
  const filteredEmpty =
    Boolean(host) && holdsHere && items.length === 0 && shownFolders.length === 0;
  const spaceEmpty = !host || (live.length === 0 && folders.length === 0);
  const crumbs: Crumb[] = [
    { name: BROWSER_STORAGE_COPY.label, onClick: () => navigate({ kind: 'offline' }) },
    ...path.map((f) => ({
      name: f.name,
      onClick: () => navigate({ kind: 'offline', folder: f.id }),
    })),
  ];
  return (
    <div data-explorer-view="offline">
      <PaneHeader
        title={open?.name ?? BROWSER_STORAGE_COPY.label}
        crumbs={crumbs}
        showFilter={false}
        onCreateFolder={host ? () => create(here, setRenamingId) : undefined}
      />
      {open ? null : (
        <p className={`mb-5 text-sm ${MUTED}`}>
          {words.many} kept only in this browser. They aren’t in your account and don’t sync to
          other devices.
        </p>
      )}
      {host && holdsHere ? <LensBar parsed={parsed} showIssues={!filteredEmpty} /> : null}
      <LensAnnouncer lens={q} loading={false} shown={items.length} more={false} words={words} />
      {filteredEmpty ? (
        <FilteredEmpty
          issues={parsed.issues}
          words={words}
          onClear={() => navigate(withLens(view, ''), { replace: true })}
        />
      ) : spaceEmpty ? (
        <SpaceEmpty />
      ) : !holdsHere && open ? (
        <EmptyFolder folderId={open.id} />
      ) : (
        <div className="flex flex-col gap-6">
          {shownFolders.length > 0 ? (
            <div className={CARD_GRID} data-local-folders="">
              {shownFolders.map((f) => (
                <LocalFolderCard
                  key={f.id}
                  folder={f}
                  subfolders={localChildren(folders, f.id).length}
                  items={inside.get(f.id) ?? NO_ITEMS}
                />
              ))}
            </div>
          ) : null}
          {items.length > 0 ? (
            <ul className={`${LIST_CARD} divide-y divide-slate-100 dark:divide-slate-700/60`}>
              {items.map((item) => (
                <LocalRow
                  key={item.id}
                  item={item}
                  sync
                  detail={<ChangedAgo at={item.updatedAt} />}
                />
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Offline with nothing left in it (its last item synced, deleted or archived while the view was open): it says
 *  so, with the way back. */
function SpaceEmpty() {
  const { navigate } = useExplorer();
  return (
    <div className="flex flex-col items-start gap-3" data-this-browser-empty="">
      <p className={`text-sm ${MUTED}`}>{THIS_BROWSER_EMPTY}</p>
      <Button size="xs" variant="secondary" onClick={() => navigate({ kind: 'all' })}>
        {`Go to ${SIDEBAR_LABELS.myWork}`}
      </Button>
    </div>
  );
}

/** A local folder holding nothing: it says so, with Delete Folder. */
function EmptyFolder({ folderId }: { folderId: string }) {
  const { openDialog } = useExplorer();
  return (
    <div className="flex flex-col items-start gap-3" data-local-folder-empty="">
      <p className={`text-sm ${MUTED}`}>{LOCAL_FOLDER_COPY.empty}</p>
      <Button
        size="xs"
        variant="secondary"
        onClick={() => openDialog({ kind: 'delete-local-folder', folderId })}
      >
        Delete Folder
      </Button>
    </div>
  );
}

/** A Take Offline or Sync asked of this view by its address (`?convert=…&item=…`, an older `/offline` link redirected
 *  here) goes on to the app's editor, which runs it and asks first. Once, and never back here on Back. */
function useHandOver(host: ThisBrowserHost | null) {
  const to = host?.handOverHref;
  useEffect(() => {
    if (!to) return;
    const asked = readThisBrowserConversion(window.location.search);
    if (asked) window.location.replace(to(asked.conversion, asked.id));
  }, [to]);
}
