'use client';

// Every view that lists items (My Work, a folder, a team, Unsorted, Recent, Favourites, Shared With Me,
// Search, the Trash): its header, its folder rows from the folder tree, and its items from one paged list,
// in the chosen layout. As livediagram's: cards by default; Shared With Me is a fixed list and the Trash its
// own grouped page, neither with the layout toggle; New Folder only where folders live.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import { folderPath } from '../data/useFolders';
import { useItemList } from '../data/useItemList';
import { viewList, type SharedMeta } from '../data/viewLists';
import { explorerPath, SIDEBAR_LABELS, VIEW_TITLES, type ExplorerView } from '../views';
import { CardView } from './CardView';
import { useExplorer } from './context';
import { DetailsView } from './DetailsView';
import { EmptyPane, SkeletonRows } from './EmptyPane';
import { TrashNote, TrashPane } from './TrashPane';
import { ListView } from './ListView';
import { PaneHeader, type Crumb, type ViewMode } from './PaneHeader';
import type { RowOptions } from './rows';

const VIEW_MODE_KEY = 'liveworkspace:explorer-view-mode';

export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const saved =
        typeof localStorage === 'undefined' ? null : localStorage.getItem(VIEW_MODE_KEY);
      return saved === 'list' || saved === 'details' ? saved : 'card';
    } catch {
      return 'card';
    }
  });
  const set = useCallback((next: ViewMode) => {
    setMode(next);
    try {
      localStorage.setItem(VIEW_MODE_KEY, next);
    } catch {
      // A convenience only.
    }
  }, []);
  return [mode, set];
}

export function ItemsPane({
  view,
  onOpenNav,
}: {
  view: Exclude<ExplorerView, { kind: 'home' } | { kind: 'inbox' } | { kind: 'timeline' }>;
  onOpenNav?: () => void;
}) {
  const ctx = useExplorer();
  const { client, app, filter, overlay, epoch, folders, words, onCreate } = ctx;
  const [mode, setMode] = useViewMode();
  const sharedMeta = useRef(new Map<string, SharedMeta>());
  // Keyed on the view's address, so a host that builds a new view object each render keeps the same list.
  const viewKey = explorerPath(view);
  const list = useMemo(
    () => viewList(client, view, app, filter, sharedMeta.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, viewKey, app, filter],
  );
  const state = useItemList({
    key: list?.key ?? 'none',
    load: list?.load ?? NO_LOAD,
    overlay,
    belongs: list?.belongs,
    epoch,
    enabled: Boolean(list?.enabled),
  });

  // The folder rows: a scope's folders under the open folder (or its root).
  const place = placement(view);
  const folderRows: Folder[] = useMemo(() => {
    // `view` is read through `viewKey`.
    if (view.kind === 'all') return folders.childrenOf(null, null);
    if (view.kind === 'folder') {
      const f = folders.byId.get(view.id);
      return folders.childrenOf(view.id, f?.teamId ?? null);
    }
    if (view.kind === 'team') return folders.childrenOf(view.folderId ?? null, view.id);
    return NO_FOLDERS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, folders]);

  const { title, crumbs } = heading(view, ctx);
  const layouts = !FIXED_LAYOUT.has(view.kind);
  // Lists that span places name where each item lives (livediagram's location chip) and, on Recent and Search,
  // whose it is.
  const showFolder = ['recent', 'favourites', 'search', 'shared'].includes(view.kind);
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
  const sharedProps = {
    folders: folderRows,
    items: state.items,
    options,
    hasMore: state.hasMore,
    loadingMore: state.loadingMore,
    onLoadMore: state.loadMore,
  };

  return (
    <div data-explorer-view={view.kind}>
      <PaneHeader
        title={title}
        crumbs={crumbs}
        onOpenNav={onOpenNav}
        onCreateItem={createItem}
        onCreateFolder={createFolder}
        folderLabel={
          view.kind === 'folder' || (view.kind === 'team' && view.folderId)
            ? 'New Subfolder'
            : 'New Folder'
        }
        viewMode={layouts ? mode : undefined}
        onSetViewMode={layouts ? setMode : undefined}
      />
      {view.kind === 'trash' ? <TrashNote words={words} /> : null}
      {state.error ? (
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
      ) : empty ? (
        <EmptyPane
          view={view}
          words={words}
          onCreate={createItem}
          createLabel={`New ${ctx.kind.one}`}
        />
      ) : !layouts ? (
        <ListView {...sharedProps} />
      ) : mode === 'card' ? (
        <CardView {...sharedProps} resetKey={list?.key ?? ''} />
      ) : mode === 'details' ? (
        <DetailsView {...sharedProps} />
      ) : (
        <ListView {...sharedProps} />
      )}
    </div>
  );
}

const NO_FOLDERS: Folder[] = [];
// Where New Folder applies: the places folders live.
const FOLDER_VIEWS: ReadonlySet<ExplorerView['kind']> = new Set(['all', 'folder', 'team']);
// Shared With Me and the Trash keep one layout (livediagram's fixed lists).
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
    case 'unsorted':
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
    default:
      return { title: VIEW_TITLES[view.kind], crumbs: [] };
  }
}
