'use client';

// Every view that lists items (My Work, a folder, a team, Unsorted, Recent, Favourites, Shared With Me,
// one tag, Search, the Trash): its header, its folder rows from the folder tree, and its items from one
// paged list, in the chosen layout.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import { folderPath } from '../data/useFolders';
import { useItemList } from '../data/useItemList';
import { viewList, type SharedMeta } from '../data/viewLists';
import { Button } from '../ui/Button';
import { explorerPath, SIDEBAR_LABELS, VIEW_TITLES, type ExplorerView } from '../views';
import { CardView } from './CardView';
import { useExplorer } from './context';
import { DetailsView } from './DetailsView';
import { EmptyPane, SkeletonRows } from './EmptyPane';
import { ListView } from './ListView';
import { PaneHeader, type Crumb, type ViewMode } from './PaneHeader';
import type { RowOptions } from './rows';

const VIEW_MODE_KEY = 'liveworkspace:explorer-view-mode';

export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const saved =
        typeof localStorage === 'undefined' ? null : localStorage.getItem(VIEW_MODE_KEY);
      return saved === 'card' || saved === 'details' ? saved : 'list';
    } catch {
      return 'list';
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
  view: Exclude<ExplorerView, { kind: 'home' } | { kind: 'inbox' }>;
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
  const showFolder = ['recent', 'favourites', 'search', 'tags', 'unsorted', 'shared'].includes(
    view.kind,
  );
  const options = useMemo<RowOptions>(
    () => ({ showApp: filter === 'all', showFolder }),
    [filter, showFolder],
  );

  const createFolder = place
    ? () => {
        void folders
          .create({ name: 'New Folder', parentId: place.folderId, teamId: place.teamId })
          .then((made) => made && ctx.setRenamingId(made.id));
      }
    : undefined;
  const createItem = place ? () => onCreate(place) : undefined;

  const trashActions =
    view.kind === 'trash' && state.items.length > 0 ? (
      <Button variant="secondary" size="xs" onClick={() => ctx.openDialog({ kind: 'empty-trash' })}>
        Empty Trash
      </Button>
    ) : null;

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
        actions={trashActions}
        viewMode={mode}
        onSetViewMode={setMode}
      />
      {view.kind === 'trash' ? (
        <p className="-mt-2 mb-4 text-xs text-slate-500 dark:text-slate-400">
          Items in the Trash are deleted for good after 30 days.
        </p>
      ) : null}
      {state.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          Couldn’t load this list.{' '}
          <button type="button" className="font-semibold underline" onClick={state.retry}>
            Try again
          </button>
        </div>
      ) : state.loading && folderRows.length === 0 ? (
        <SkeletonRows />
      ) : empty ? (
        <EmptyPane view={view} words={words}>
          {createItem ? (
            <Button size="sm" onClick={createItem}>
              New {ctx.kind.one}
            </Button>
          ) : null}
        </EmptyPane>
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
  const { folders, tags, teamName, navigate } = ctx;
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
    case 'tags': {
      if (!view.id) return { title: VIEW_TITLES.tags, crumbs: [] };
      const t = tags.byId.get(view.id);
      return {
        title: t?.name ?? 'Tag',
        crumbs: [
          { name: VIEW_TITLES.tags, onClick: () => navigate({ kind: 'tags' }) },
          { name: t?.name ?? 'Tag' },
        ],
      };
    }
    case 'search':
      return { title: view.q ? `Results for “${view.q}”` : VIEW_TITLES.search, crumbs: [] };
    default:
      return { title: VIEW_TITLES[view.kind], crumbs: [] };
  }
}
