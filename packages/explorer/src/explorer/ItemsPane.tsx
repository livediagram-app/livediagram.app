'use client';

// Every view that lists items (My Work, a folder, a team, Recent, Favourites, Shared With Me,
// Search, the Trash): its header, its folder rows from the folder tree, and its items from one paged list,
// in the chosen layout. As livediagram's: cards by default; Shared With Me is a fixed list and the Trash its
// own grouped page, neither with the layout toggle; New Folder only where folders live.

import { useEffect, useMemo, useRef } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import { folderPath, type FolderStore } from '../data/useFolders';
import { useItemList } from '../data/useItemList';
import { useOtherApps } from '../data/useOtherApps';
import { makeListLens, viewList, type ListLens, type SharedMeta } from '../data/viewLists';
import { isLensSet, itemSubject, parseLens, type ParsedLens } from '../lens';
import {
  explorerPath,
  lensViewOf,
  SIDEBAR_LABELS,
  VIEW_TITLES,
  type ItemsView,
  viewLens,
  withLens,
  type ExplorerView,
} from '../views';
import { CardView } from './CardView';
import { useExplorer } from './context';
import { DetailsView } from './DetailsView';
import { EmptyPane, SkeletonRows } from './EmptyPane';
import { OtherAppsHere } from './OtherAppsHere';
import { FilteredEmpty, LensAnnouncer, LensBar } from './Lens';
import { useLensContext } from './SearchField';
import { TrashNote, TrashPane } from './TrashPane';
import { ListView } from './ListView';
import { SharedList } from './SharedList';
import { TeamPage } from './TeamPane';
import { PaneHeader, type Crumb } from './PaneHeader';
import { ImportToolbar } from '../library/ImportToolbar';
import { useViewMode } from './useViewMode';
import type { RowOptions } from './rows';

export function ItemsPane({ view, onOpenNav }: { view: ItemsView; onOpenNav?: () => void }) {
  const ctx = useExplorer();
  const { client, app, filter, overlay, epoch, folders, words, onCreate, viewerId } = ctx;
  const [mode, setMode] = useViewMode();
  const sharedMeta = useRef(new Map<string, SharedMeta>());
  // The lens the address carries (the field writes it at most every 250 ms): parsed once per change.
  const lensKind = lensViewOf(view.kind);
  const lensContext = useLensContext();
  const q = viewLens(view);
  const parsed = useMemo(() => parseLens(q, lensContext), [q, lensContext]);
  const lensOn = lensKind !== null && isLensSet(parsed.lens);
  const listLens = useListLens(lensOn ? parsed : null, lensKind, view, folders, viewerId);
  // Keyed on the view's place (its lens is in `listLens.key`), so a host that builds a new view object each
  // render keeps the same list.
  const viewKey = explorerPath(withLens(view, ''));
  const list = useMemo(
    () => viewList(client, view, app, filter, sharedMeta.current, listLens),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, viewKey, app, filter, listLens],
  );
  const state = useItemList({
    key: list?.key ?? 'none',
    load: list?.load ?? NO_LOAD,
    overlay,
    belongs: list?.belongs,
    cap: list?.cap,
    epoch,
    enabled: Boolean(list?.enabled),
  });

  // The rows the lens reads, for the field's "No matches" marks: only a list loaded whole can say.
  const { lensSubjects } = ctx;
  useEffect(() => {
    lensSubjects.current = state.hasMore
      ? null
      : state.items.map((item) => itemSubject(item, viewerId));
  }, [lensSubjects, state.items, state.hasMore, viewerId]);
  useEffect(() => () => void (lensSubjects.current = null), [lensSubjects]);

  // The folder rows: a scope's folders under the open folder (or its root). They step aside while a lens is
  // set: the list is then the whole scope, flat.
  const place = placement(view);
  const folderRows: Folder[] = useMemo(() => {
    // `view` is read through `viewKey`.
    if (lensOn) return NO_FOLDERS;
    if (view.kind === 'all') return folders.childrenOf(null, null);
    if (view.kind === 'folder') {
      const f = folders.byId.get(view.id);
      return folders.childrenOf(view.id, f?.teamId ?? null);
    }
    if (view.kind === 'team') return folders.childrenOf(view.folderId ?? null, view.id);
    return NO_FOLDERS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, folders, lensOn]);

  const { title, crumbs } = heading(view, ctx);
  const layouts = !FIXED_LAYOUT.has(view.kind);
  // Lists that span places name where each item lives (livediagram's location chip) and, on Recent and Search,
  // whose it is.
  // A lensed scope lists its subfolders' items too, so each names its folder.
  const showFolder = lensOn || ['recent', 'favourites', 'search', 'shared'].includes(view.kind);
  const showOwner = view.kind === 'recent' || view.kind === 'search';
  const options = useMemo<RowOptions>(
    () => ({ showApp: filter === 'all', showFolder, showOwner }),
    [filter, showFolder, showOwner],
  );

  const createFolder =
    place && FOLDER_VIEWS.has(view.kind)
      ? () => {
          void folders
            .create({ name: 'New Folder', parentId: place.folderId, teamId: place.teamId })
            .then((made) => made && ctx.setRenamingId(made.id));
        }
      : undefined;
  const createItem = place ? () => onCreate(place) : undefined;

  const empty = !state.loading && state.items.length === 0 && folderRows.length === 0;
  // Empty in this app, a place may still hold other apps' items: say so, so it is never deleted as empty.
  const others = useOtherApps({
    client,
    view,
    app,
    enabled: empty && !state.error && !lensOn && filter === 'app' && PLACE_VIEWS.has(view.kind),
    epoch,
  });

  // The folder on screen, told to the host once its list is in (FolderShown).
  const { onFolderShown } = ctx;
  const shownId =
    view.kind === 'folder' ? view.id : view.kind === 'team' ? (view.folderId ?? null) : null;
  const shownName = shownId ? (folders.byId.get(shownId)?.name ?? null) : null;
  const shownCount = lensOn ? null : state.items.length;
  useEffect(() => {
    if (!onFolderShown || !shownId || state.loading) return;
    onFolderShown({ folderId: shownId, name: shownName, itemCount: shownCount });
  }, [onFolderShown, shownId, shownName, shownCount, state.loading]);
  const sharedProps = {
    folders: folderRows,
    items: state.items,
    options,
    hasMore: state.hasMore,
    loadingMore: state.loadingMore,
    onLoadMore: state.loadMore,
  };

  const body = state.error ? (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
      Couldn’t load this list.{' '}
      <button type="button" className="font-semibold underline" onClick={state.retry}>
        Try again
      </button>
    </div>
  ) : state.loading && folderRows.length === 0 ? (
    <SkeletonRows />
  ) : view.kind === 'trash' ? (
    <TrashPane
      items={state.items}
      hasMore={state.hasMore}
      loadingMore={state.loadingMore}
      onLoadMore={state.loadMore}
    />
  ) : empty && lensOn ? (
    <FilteredEmpty
      issues={parsed.issues}
      words={words}
      onClear={() => ctx.navigate(withLens(view, ''), { replace: true })}
    />
  ) : empty && others ? (
    <OtherAppsHere view={view} others={others} onCreate={createItem} />
  ) : empty ? (
    <EmptyPane
      view={view}
      words={words}
      onCreate={createItem}
      createLabel={`New ${ctx.kind.one}`}
    />
  ) : view.kind === 'shared' ? (
    <SharedList {...sharedProps} resetKey={list?.key ?? ''} />
  ) : !layouts ? (
    <ListView {...sharedProps} resetKey={list?.key ?? ''} />
  ) : mode === 'card' ? (
    <CardView {...sharedProps} resetKey={list?.key ?? ''} />
  ) : mode === 'details' ? (
    <DetailsView {...sharedProps} resetKey={list?.key ?? ''} />
  ) : (
    <ListView {...sharedProps} resetKey={list?.key ?? ''} />
  );

  return (
    <div data-explorer-view={view.kind}>
      <PaneHeader
        title={title}
        crumbs={crumbs}
        onOpenNav={onOpenNav}
        onCreateItem={createItem}
        onCreateFolder={createFolder}
        // Imports land where New files an item, so they sit beside it: in the person's own space, as livediagram's.
        actions={place && place.teamId === null ? <ImportToolbar placement={place} /> : undefined}
        folderLabel={
          view.kind === 'folder' || (view.kind === 'team' && view.folderId)
            ? 'New Subfolder'
            : 'New Folder'
        }
        viewMode={layouts ? mode : undefined}
        onSetViewMode={layouts ? setMode : undefined}
      />
      {lensKind !== null ? <LensBar parsed={parsed} showIssues={!(empty && lensOn)} /> : null}
      {lensKind !== null ? (
        <LensAnnouncer
          lens={q}
          loading={state.loading}
          shown={state.items.length}
          more={state.hasMore}
          words={words}
        />
      ) : null}
      {view.kind === 'trash' ? <TrashNote words={words} /> : null}
      {view.kind === 'team' && !view.folderId ? <TeamPage teamId={view.id}>{body}</TeamPage> : body}
    </div>
  );
}

const NO_FOLDERS: Folder[] = [];

/**
 * The lens as the list takes it, stable while the filters it sends are the same: the index's filters (Edited's
 * cutoff worked out when the lens changed), a key, the check a changed row must still pass, and for a folder, its
 * subtree (a lens inside a folder reaches its subfolders).
 */
function useListLens(
  parsed: ParsedLens | null,
  lensKind: 'scoped' | 'aggregate' | null,
  view: ExplorerView,
  folders: FolderStore,
  viewerId: string | null,
): ListLens | null {
  const folderId =
    view.kind === 'folder' ? view.id : view.kind === 'team' ? (view.folderId ?? null) : null;
  return useMemo(() => {
    if (!parsed || lensKind === null) return null;
    const subtree = folderId ? subtreeOf(folders, folderId) : undefined;
    return makeListLens(parsed.lens, lensKind, viewerId, Date.now(), subtree);
  }, [parsed, lensKind, folderId, folders, viewerId]);
}

/** A folder and every folder under it, from the folder tree already loaded. */
function subtreeOf(folders: FolderStore, root: string): ReadonlySet<string> {
  const out = new Set<string>([root]);
  const stack = [root];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const teamId = folders.byId.get(id)?.teamId ?? null;
    for (const child of folders.childrenOf(id, teamId)) {
      if (out.has(child.id)) continue;
      out.add(child.id);
      stack.push(child.id);
    }
  }
  return out;
}
// Where New Folder applies: the places folders live.
const FOLDER_VIEWS: ReadonlySet<ExplorerView['kind']> = new Set(['all', 'folder', 'team']);
// Shared With Me and the Trash keep one layout (livediagram's fixed lists).
// The places whose emptiness may be only this app's: they also hold other apps' items.
const PLACE_VIEWS: ReadonlySet<ExplorerView['kind']> = new Set(['all', 'folder', 'team']);
const FIXED_LAYOUT: ReadonlySet<ExplorerView['kind']> = new Set(['shared', 'trash']);
const NO_LOAD = async () => ({ items: [], nextCursor: null });

/** Where New files an item from this view, or null where New does not apply. */
export function placement(
  view: ExplorerView,
): { folderId: string | null; teamId: string | null } | null {
  switch (view.kind) {
    case 'all':
    case 'home':
    case 'recent':
    case 'favourites':
    case 'search':
      return { folderId: null, teamId: null };
    case 'folder':
      return { folderId: view.id, teamId: null };
    case 'team':
      return { folderId: view.folderId ?? null, teamId: view.id };
    default:
      return null;
  }
}

function heading(
  view: ExplorerView,
  ctx: ReturnType<typeof useExplorer>,
): { title: string; crumbs: Crumb[] } {
  const { folders, teamName, navigate } = ctx;
  const crumbsFor = (folderId: string | null, root: Crumb): Crumb[] => [
    root,
    ...folderPath(folders.byId, folderId).map<Crumb>((f) => ({
      name: f.name,
      onClick: () =>
        navigate(
          f.teamId ? { kind: 'team', id: f.teamId, folderId: f.id } : { kind: 'folder', id: f.id },
        ),
    })),
  ];
  switch (view.kind) {
    case 'folder': {
      const f = folders.byId.get(view.id);
      if (f?.teamId) {
        const name = teamName(f.teamId) ?? 'Team';
        const crumbs = crumbsFor(view.id, {
          name,
          onClick: () => navigate({ kind: 'team', id: f.teamId! }),
        });
        return { title: f.name, crumbs };
      }
      return {
        title: f?.name ?? 'Folder',
        crumbs: crumbsFor(view.id, {
          name: SIDEBAR_LABELS.myWork,
          onClick: () => navigate({ kind: 'all' }),
        }),
      };
    }
    case 'team': {
      const name = teamName(view.id) ?? 'Team';
      if (!view.folderId) return { title: name, crumbs: [] };
      const f = folders.byId.get(view.folderId);
      return {
        title: f?.name ?? 'Folder',
        crumbs: crumbsFor(view.folderId, {
          name,
          onClick: () => navigate({ kind: 'team', id: view.id }),
        }),
      };
    }
    case 'recent':
      // Reached from Home (Jump Back In's See All), and leads back to it.
      return {
        title: VIEW_TITLES.recent,
        crumbs: [
          { name: VIEW_TITLES.home, onClick: () => navigate({ kind: 'home' }) },
          { name: VIEW_TITLES.recent },
        ],
      };
    default:
      return { title: VIEW_TITLES[view.kind], crumbs: [] };
  }
}
