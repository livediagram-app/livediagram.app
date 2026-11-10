'use client';

// This Browser in the Explorer: the host app's items kept only in this browser (this-browser.ts), where the host can
// read them (the Explorer served on the app's own address). They show as liveplanner's own Explorer showed them: a
// sidebar row with their count, a view of their own (`/explorer/offline`), a This Browser group in the Trash, and
// among Recent in Home's Jump Back In. The editor's Explorer panel has the same view (panel/PanelThisBrowser.tsx). Each
// opens in its app's editor, which does the rest (rename, restore): the index never sees them, so the Explorer only
// lists them. Where the app moves them into the account, each live row also has Sync: in place in the editor's panel
// (`sync`), or, on the Explorer page, a hand-over to the app's editor (this-browser.ts `thisBrowserConvertHref`).
// Jump Back In's card of one has This Browser's menu (ThisBrowserItemMenu: Open, Sync, Delete where the host can)
// and drags to the Trash or a place (drag.tsx), each through these same verbs.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { App } from '@liveworkspace/index-client';
import {
  parseThisBrowserStore,
  readThisBrowserConversion,
  setThisBrowserArchived,
  subscribeThisBrowser,
  thisBrowserKey,
  BROWSER_STORAGE_COPY,
  THIS_BROWSER_COPY,
  THIS_BROWSER_FOCUS,
  THIS_BROWSER_HOVER,
  THIS_BROWSER_TONE,
  type ThisBrowserConversion,
  type ThisBrowserFolder,
  type ThisBrowserItem,
} from '../this-browser';
import { DAY_MONTH, MEDIUM_DATE_TIME } from '@liveworkspace/ui/date-format';
import { relativeSince, useNow } from '../time';
import { LIST_CARD, MUTED } from '../ui/classes';
import { ArchiveIcon, FolderOutlineIcon, OpenIcon, SyncIcon, TrashIcon } from '../ui/icons';
import { quoted } from '../quoted';
import { MenuActionRow, MenuGroupSeparator, MenuHeader, PortalMenu } from '../ui/Menu';
import { useExplorer } from './context';
import { BrowserIcon, useHostExtras } from './host';
import { PaneIconButton } from '../panel/pane-parts';
import { LocalPreview } from './LocalPreview';
import { PaneHeader, type Crumb } from './PaneHeader';
import { parseLens } from '../lens';
import { SIDEBAR_LABELS, viewLens, withLens } from '../views';
import { Button } from '@liveworkspace/ui';
import { useThisBrowserDrag } from '../drag/drag';
import { localChildren, localPath } from '../this-browser';
import { CARD_GRID } from '../ui/classes';
import { LocalFolderCard } from './this-browser-space/LocalFolderCard';
import { LOCAL_FOLDER_COPY, useCreateLocalFolder, useSyncLocal } from './this-browser-space/space';
import { FilteredEmpty, LensAnnouncer, LensBar } from './Lens';
import { useLensContext } from './SearchField';
import {
  itemsByFolder,
  narrowLocalFolders,
  narrowThisBrowser,
  thisBrowserSubjects,
} from './this-browser-lens';
import { daysLeftLabel } from './TrashPane';

/** What a host hands the Explorer for This Browser. */
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

/** What This Browser says with nothing kept, on the page and in the panel. */
export const THIS_BROWSER_EMPTY = 'Nothing is kept in Browser Storage.';
export { LocalPreview };

// A host's verb that moved an item (Sync, Take Offline) without a page load: the lists load again once it settles,
// whether it moved or not, so they show where the item is now.
export function thenReload(result: Promise<unknown> | void, reloadLists: () => void): void {
  if (result) void result.then(reloadLists, reloadLists);
}

// Live: out of the app's Trash and out of Archived (one-explorer.md "Archived"), which only Archived lists.
const live = (i: ThisBrowserItem) => i.trashedAt === null && !i.archivedAt;
const localTrashed = (i: ThisBrowserItem) => i.trashedAt !== null && !i.archivedAt;
/** Archived in this browser, newest first. */
export const localArchived = (i: ThisBrowserItem) => i.trashedAt === null && Boolean(i.archivedAt);

/** Move to Archived for an item kept only in this browser: marked in this browser alone, nothing uploaded
 *  (one-explorer.md "Archived"). */
export function useArchiveLocal(): (item: ThisBrowserItem) => void {
  const { app, toast } = useExplorer();
  return useCallback(
    (item: ThisBrowserItem) => {
      setThisBrowserArchived(app, item.id, Date.now());
      toast.show(`Moved ${quoted(item.title || 'Untitled')} to Archived.`, { tone: 'success' });
    },
    [app, toast],
  );
}

/** Opens one in its app: the host's `open` (the editor's panel, no page load), else a page load of its address. */
export function openThisBrowserItem(host: ThisBrowserHost, item: ThisBrowserItem): void {
  if (host.open) host.open(item);
  else window.location.assign(host.itemHref(item));
}

// The list as the app last wrote it, per app, parsed again only when its stored text changes: one stable array per
// change, so a reader re-renders only when the list does.
const NO_ITEMS: readonly ThisBrowserItem[] = [];
const NO_FOLDERS: readonly ThisBrowserFolder[] = [];
type Snapshot = {
  raw: string | null;
  items: readonly ThisBrowserItem[];
  folders: readonly ThisBrowserFolder[];
};
const EMPTY_SNAPSHOT: Snapshot = { raw: null, items: NO_ITEMS, folders: NO_FOLDERS };
const reads = new Map<App, Snapshot>();
function snapshotOf(app: App): Snapshot {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(thisBrowserKey(app));
  } catch {
    return EMPTY_SNAPSHOT;
  }
  const kept = reads.get(app);
  if (kept?.raw === raw) return kept;
  const parsed = raw ? parseThisBrowserStore(raw) : null;
  const next: Snapshot = {
    raw,
    items: parsed?.items.length ? parsed.items : NO_ITEMS,
    folders: parsed?.folders.length ? parsed.folders : NO_FOLDERS,
  };
  reads.set(app, next);
  return next;
}
const snapshot = (app: App) => snapshotOf(app).items;
const folderSnapshot = (app: App) => snapshotOf(app).folders;

/** The app's This Browser list on its own origin (every item, live and trashed, newest change first), heard as it
 *  changes in this tab or another. Empty for no app, and while prerendered. */
export function useThisBrowserList(app: App | null): readonly ThisBrowserItem[] {
  const subscribe = useCallback(
    (onChange: () => void) => (app ? subscribeThisBrowser(app, onChange) : () => {}),
    [app],
  );
  return useSyncExternalStore(
    subscribe,
    () => (app ? snapshot(app) : NO_ITEMS),
    () => NO_ITEMS,
  );
}

/** This Browser's folders on the app's own origin, heard as they change: one parse per change of the stored list,
 *  shared with useThisBrowserList. Empty for no app, and while prerendered. */
export function useThisBrowserFolders(app: App | null): readonly ThisBrowserFolder[] {
  const subscribe = useCallback(
    (onChange: () => void) => (app ? subscribeThisBrowser(app, onChange) : () => {}),
    [app],
  );
  return useSyncExternalStore(
    subscribe,
    () => (app ? folderSnapshot(app) : NO_FOLDERS),
    () => NO_FOLDERS,
  );
}

/** The live items, newest change first. */
export function useThisBrowserItems(): { host: ThisBrowserHost | null; live: ThisBrowserItem[] } {
  const { thisBrowser } = useHostExtras();
  const items = useMemo(() => thisBrowser?.items.filter(live) ?? [], [thisBrowser]);
  return { host: thisBrowser, live: items };
}

/** Jump Back In's merge: the opened ones among `recent`, by the same rule (last opened first), at most `max`. */
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

let pillSeq = 0;

/** The teal pill every local row and card carries: not colour alone (an icon and the words), its sentence as its
 *  description, and a link to the app's help where the row is not itself a link. Its tone (THIS_BROWSER_TONE) is the
 *  editors' pill's too (@liveworkspace/workbench ThisBrowserPill). */
export function ThisBrowserPill({ inLink = false }: { inLink?: boolean }) {
  const { thisBrowser } = useHostExtras();
  const [id] = useState(() => `this-browser-pill-${++pillSeq}`);
  const body = (
    <>
      <BrowserIcon size={11} />
      <span>{BROWSER_STORAGE_COPY.label}</span>
      <span id={id} className="sr-only">
        {BROWSER_STORAGE_COPY.sentence}
      </span>
    </>
  );
  const className = `inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${THIS_BROWSER_TONE}`;
  if (inLink || !thisBrowser?.helpHref)
    return (
      <span
        data-this-browser=""
        aria-describedby={id}
        title={BROWSER_STORAGE_COPY.sentence}
        className={className}
      >
        {body}
      </span>
    );
  return (
    <a
      data-this-browser=""
      href={thisBrowser.helpHref}
      target="_blank"
      rel="noreferrer"
      aria-describedby={id}
      title={BROWSER_STORAGE_COPY.sentence}
      className={`${className} hover:underline ${THIS_BROWSER_HOVER} ${THIS_BROWSER_FOCUS}`}
    >
      {body}
    </a>
  );
}

const SYNC_LINK =
  'mr-3 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-300 dark:hover:bg-slate-800';

/** "Changed 3 hours ago", its full date and time in the reader's locale on hover: This Browser's rows, on the page
 *  and in the panel alike. */
export function ChangedAgo({ at }: { at: number }) {
  const now = useNow();
  // A stored date past what a Date holds has no full date to give.
  if (Number.isNaN(new Date(at).getTime())) return <span>Changed</span>;
  return (
    <time dateTime={new Date(at).toISOString()} title={MEDIUM_DATE_TIME.format(at)}>
      Changed {relativeSince(at, now || Date.now())}
    </time>
  );
}

function LocalRow({
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
        // For good, asked first: the panel's This Browser rows do the same (liveworkspace/docs/specs/004-index/one-explorer.md "This Browser").
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

/** `/explorer/offline`: This Browser's Space (one-explorer.md "This Browser, a Space"), at its root or one of its
 *  folders (`?folder=`): the back bar to the level above, New Folder, the folders here as cards by name, then the live
 *  items here as rows, newest change first, both narrowed by the lens. */
export function ThisBrowserPane() {
  const { words, view, app, navigate, lensSubjects, setRenamingId } = useExplorer();
  const { host, live } = useThisBrowserItems();
  const folders = useThisBrowserFolders(host ? app : null);
  useHandOver(host);
  const create = useCreateLocalFolder();
  const asked = view.kind === 'offline' ? (view.folder ?? null) : null;
  // An unknown folder (deleted, or another browser's link) shows the root.
  const path = useMemo(() => localPath(folders, asked), [folders, asked]);
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

/** This Browser with nothing left in it (its last item synced, deleted or archived while the view was open): it says
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

/** How many of the host's local items wait in its Trash. */
export function useThisBrowserTrashed(): number {
  const { thisBrowser } = useHostExtras();
  return useMemo(() => thisBrowser?.items.filter(localTrashed).length ?? 0, [thisBrowser]);
}

/** The Trash's This Browser group: each opens in its app, whose own Trash restores or deletes it. */
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
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700/60">
        <h2
          id="trash-this-browser"
          className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          {BROWSER_STORAGE_COPY.label}
        </h2>
        <span className={`text-xs ${MUTED}`}>Open one to restore or delete it.</span>
      </header>
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

/** This Browser's menu for one live item, from its Jump Back In card's ⋯ or a right-click: Open; Sync (signed in: in
 *  place with `sync`, or the page's hand-over to the editor with `syncHref`), as This Browser's rows offer it; and
 *  Delete, asked first, where the host deletes in place (`remove`). */
export function ThisBrowserItemMenu({
  item,
  anchor,
  onClose,
}: {
  item: ThisBrowserItem;
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  const { thisBrowser: host } = useHostExtras();
  const { kind, openDialog } = useExplorer();
  const archive = useArchiveLocal();
  const syncLocal = useSyncLocal();
  const title = item.title || 'Untitled';
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  if (!host) return null;
  const sync = syncLocal ? () => syncLocal(item) : null;
  return (
    <PortalMenu anchor={anchor} onClose={onClose} label={`Actions for ${title}`}>
      <MenuHeader title={title} aside={<ThisBrowserPill inLink />} />
      <MenuActionRow
        label="Open"
        icon={<OpenIcon />}
        onClick={run(() => openThisBrowserItem(host, item))}
      />
      {sync ? (
        <MenuActionRow label={`Sync ${kind.one}`} icon={<SyncIcon />} onClick={run(sync)} />
      ) : null}
      <MenuActionRow
        label="Move to Folder"
        icon={<FolderOutlineIcon />}
        onClick={run(() => openDialog({ kind: 'move-local-item', item }))}
      />
      <MenuActionRow
        label="Move to Archived"
        icon={<ArchiveIcon />}
        onClick={run(() => archive(item))}
      />
      {host.remove ? (
        <>
          <MenuGroupSeparator />
          <MenuActionRow
            label={`Delete ${kind.one}`}
            icon={<TrashIcon />}
            onClick={run(() => openDialog({ kind: 'delete-local', item }))}
          />
        </>
      ) : null}
    </PortalMenu>
  );
}
