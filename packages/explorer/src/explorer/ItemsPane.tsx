'use client';

// Every view that lists items (My Work, a folder, a team, Recent, Shared With Me,
// Search, the Trash): its header, its folder rows from the folder tree, and its items from one paged list,
// in the chosen layout. As livediagram's: cards by default; Shared With Me is a fixed list and the Trash its
// own grouped page, neither with the layout toggle; New Folder only where folders live.

import { MoreFailed } from './MoreFailed';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { App, Folder } from '@liveworkspace/index-client';
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
import { EmptyPane, SkeletonRows } from './EmptyPane';
import { OtherAppsHere } from './OtherAppsHere';
import { FilteredEmpty, LensBar } from './lazy-lens';
import { LensAnnouncer } from './LensAnnouncer';
import { DetailsView } from './lazy-panes';
import { useLensContext } from './SearchField';
import { TrashNote, TrashPane } from './TrashPane';
import { ThisBrowserArchivedGroup, useThisBrowserArchived } from './ArchivedThisBrowser';
import { useArchivedAsk } from './useArchivedAsk';
import { ListView } from './ListView';
import { SharedList } from './SharedList';
import { TeamNotFound, TeamPage } from './TeamPane';
import { NotFoundCard } from './NotFoundCard';
import { PaneHeader, type Crumb } from './PaneHeader';
import { viewTitle } from './view-title';
import { useViewMode } from './useViewMode';
import { KindChips, SortMenu } from './team/LibraryToolbar';
import {
  kindCounts,
  readLibrarySort,
  sortLibrary,
  writeLibrarySort,
  type LibrarySort,
} from './team/library';
import type { RowOptions } from './rows';
import { Callout } from '@liveworkspace/ui/callout';

export function ItemsPane({ view }: { view: ItemsView }) {
  const ctx = useExplorer();
  const { client, app, filter, overlay, epoch, folders, words, onCreate, viewerId } = ctx;
  const [mode, setMode] = useViewMode();
  // Details draws from its own chunk: a list that opens in it fetches the code while its items load.
  useEffect(() => {
    if (mode === 'details') void DetailsView.preload();
  }, [mode]);
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
  }, [viewKey, folders, lensOn]);

  const { title, crumbs } = heading(view, ctx);
  const layouts = !FIXED_LAYOUT.has(view.kind);
  // Lists that span places name where each item lives (livediagram's location chip) and, on Recent and Search,
  // whose it is.
  // A lensed scope lists its subfolders' items too, so each names its folder.
  const showFolder = lensOn || ['recent', 'search', 'shared'].includes(view.kind);
  const showOwner = view.kind === 'recent' || view.kind === 'search';
  const options = useMemo<RowOptions>(
    () => ({ showApp: filter === 'all', showFolder, showOwner }),
    [filter, showFolder, showOwner],
  );

  // A team the person is not in (gone, left, never joined): its not-found card stands alone, with no filters, layout
  // toggle or Create, since nothing can be made or found there.
  const teamGone = view.kind === 'team' && !ctx.teams.some((t) => t.id === view.id);
  const createFolder =
    place && FOLDER_VIEWS.has(view.kind) && !teamGone
      ? () => {
          void folders
            .create({ name: 'New Folder', parentId: place.folderId, teamId: place.teamId })
            .then((made) => made && ctx.setRenamingId(made.id));
        }
      : undefined;
  const createItem =
    place && !teamGone ? (app?: App) => (app ? onCreate(place, app) : onCreate(place)) : undefined;
  // The empty states' one button makes the host app's kind.
  const createOwn = createItem ? () => createItem() : undefined;

  // Archived also lists what this browser archived (its own group below); only both empty is empty.
  const localArchived = useThisBrowserArchived();
  const archivedView = view.kind === 'archived';
  useArchivedAsk(archivedView, state.items, localArchived, state.loading);
  const empty =
    !state.loading &&
    state.items.length === 0 &&
    folderRows.length === 0 &&
    !(archivedView && localArchived.length > 0);
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
  // A team's Library tab (its root): Sort (Last Changed or Name) orders the cards, and each kind chip counts the
  // library while it is loaded whole and unfiltered, kept while a chip narrows it.
  const teamRoot = view.kind === 'team' && !view.folderId;
  const [librarySort, setLibrarySort] = useState<LibrarySort>(readLibrarySort);
  const libraryItems = useMemo(
    () => (teamRoot && librarySort === 'name' ? sortLibrary(state.items, 'name') : state.items),
    [teamRoot, librarySort, state.items],
  );
  const whole = teamRoot && !lensOn && !state.loading && !state.error && !state.hasMore;
  const counted = useRef<{
    key: string;
    kinds: ReturnType<typeof kindCounts>;
    total: number;
  } | null>(null);
  if (whole && (counted.current?.key !== viewKey || counted.current.total !== state.items.length)) {
    counted.current = { key: viewKey, kinds: kindCounts(state.items), total: state.items.length };
  }
  const libraryCounts = counted.current?.key === viewKey ? counted.current : null;
  const sharedProps = {
    folders: folderRows,
    items: libraryItems,
    options,
    // A failed page shows Try again below instead of loading on scroll.
    hasMore: state.hasMore && !state.moreFailed,
    loadingMore: state.loadingMore,
    onLoadMore: state.loadMore,
  };

  // Inside a folder: New makes a subfolder too, and the empty folder, which asks for one, offers it beside New.
  const inFolder = view.kind === 'folder' || (view.kind === 'team' && Boolean(view.folderId));
  const folderLabel = inFolder ? 'New Subfolder' : 'New Folder';
  const body = teamGone ? (
    <TeamNotFound />
  ) : state.error && state.missing && view.kind === 'folder' ? (
    // A folder deleted or moved out of reach (a stale link, another tab): no retry brings it back.
    <NotFoundCard title="Folder not found">
      {`This folder was deleted, or it is somewhere you can’t reach. Head back to your own ${words.lowerMany}.`}
    </NotFoundCard>
  ) : state.error ? (
    <Callout tone="error" size="md" action={{ label: 'Try Again', onSelect: state.retry }}>
      Couldn’t load this list.
    </Callout>
  ) : state.loading && folderRows.length === 0 ? (
    <SkeletonRows />
  ) : archivedView && state.items.length === 0 && !empty ? null : view.kind === 'trash' ? (
    <TrashPane
      items={state.items}
      hasMore={state.hasMore && !state.moreFailed}
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
    <OtherAppsHere view={view} others={others} onCreate={createOwn} />
  ) : empty ? (
    <EmptyPane
      view={view}
      words={words}
      onCreate={createItem}
      createLabel={`New ${ctx.kind.one}`}
      onCreateFolder={inFolder ? createFolder : undefined}
      folderLabel={folderLabel}
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

  if (teamRoot && view.kind === 'team') {
    // The team's own header and tabs stand over the Library: its toolbar is the kind chips, Sort, the layout and New.
    const teamMode = mode === 'list' ? 'card' : mode;
    const teamBody =
      mode === 'list' &&
      body &&
      !teamGone &&
      layouts &&
      !empty &&
      !state.error &&
      !state.loading ? (
        <CardView {...sharedProps} resetKey={list?.key ?? ''} />
      ) : (
        body
      );
    return (
      <div data-explorer-view={view.kind}>
        <TeamPage teamId={view.id} tab={view.tab} libraryCount={libraryCounts?.total ?? null}>
          <PaneHeader
            leading={
              <KindChips
                counts={libraryCounts?.kinds ?? null}
                total={libraryCounts?.total ?? null}
                lens={q}
                parsed={parsed}
                lensContext={lensContext}
                onLens={(next) => ctx.navigate(withLens(view, next), { replace: true })}
              />
            }
            onCreateItem={createItem}
            onCreateFolder={createFolder}
            folderLabel={folderLabel}
            createLabel="New"
            viewMode={teamMode}
            onSetViewMode={setMode}
            viewModes={TEAM_VIEW_MODES}
            showFilter
            actions={
              teamMode === 'card' ? (
                <SortMenu
                  sort={librarySort}
                  onSort={(next) => {
                    setLibrarySort(next);
                    writeLibrarySort(next);
                  }}
                />
              ) : null
            }
          />
          {/* The kind chips stand for Opens in; the other filters show once one is set (from the Filter field). */}
          {lensKind !== null && lensOn ? (
            <LensBar parsed={parsed} showIssues={!(empty && lensOn)} />
          ) : null}
          {lensKind !== null ? (
            <LensAnnouncer
              lens={q}
              loading={state.loading}
              shown={state.items.length}
              more={state.hasMore}
              words={words}
            />
          ) : null}
          {teamBody}
          {state.moreFailed && !state.error ? (
            <MoreFailed onRetry={state.retryMore} loading={state.loadingMore} />
          ) : null}
        </TeamPage>
      </div>
    );
  }

  return (
    <div data-explorer-view={view.kind}>
      <PaneHeader
        title={title}
        crumbs={crumbs}
        onCreateItem={createItem}
        onCreateFolder={createFolder}
        folderLabel={folderLabel}
        viewMode={layouts && !teamGone ? mode : undefined}
        onSetViewMode={layouts && !teamGone ? setMode : undefined}
        showFilter={!teamGone}
      />
      {lensKind !== null && !teamGone ? (
        <LensBar parsed={parsed} showIssues={!(empty && lensOn)} />
      ) : null}
      {lensKind !== null && !teamGone ? (
        <LensAnnouncer
          lens={q}
          loading={state.loading}
          shown={state.items.length}
          more={state.hasMore}
          words={words}
        />
      ) : null}
      {view.kind === 'trash' ? <TrashNote words={words} /> : null}
      {body}
      {/* Kept in this browser, so it shows even when the account's list can't load (offline). */}
      {archivedView && !state.loading ? (
        <ThisBrowserArchivedGroup first={!state.error && state.items.length === 0} />
      ) : null}
      {state.moreFailed && !state.error ? (
        <MoreFailed onRetry={state.retryMore} loading={state.loadingMore} />
      ) : null}
    </div>
  );
}

const NO_FOLDERS: Folder[] = [];
const TEAM_VIEW_MODES = ['card', 'details'] as const;

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
  const title = viewTitle(view, folders, teamName);
  switch (view.kind) {
    case 'folder': {
      const f = folders.byId.get(view.id);
      if (f?.teamId) {
        const name = teamName(f.teamId) ?? 'Team';
        const crumbs = crumbsFor(view.id, {
          name,
          onClick: () => navigate({ kind: 'team', id: f.teamId! }),
        });
        return { title, crumbs };
      }
      return {
        title,
        crumbs: crumbsFor(view.id, {
          name: SIDEBAR_LABELS.myWork,
          onClick: () => navigate({ kind: 'all' }),
        }),
      };
    }
    case 'team': {
      if (!view.folderId) return { title, crumbs: [] };
      const name = teamName(view.id) ?? 'Team';
      return {
        title,
        crumbs: crumbsFor(view.folderId, {
          name,
          onClick: () => navigate({ kind: 'team', id: view.id }),
        }),
      };
    }
    case 'recent':
      // Reached from Home (Recent's See More), and leads back to it.
      return {
        title,
        crumbs: [
          { name: VIEW_TITLES.home, onClick: () => navigate({ kind: 'home' }) },
          { name: VIEW_TITLES.recent },
        ],
      };
    default:
      return { title, crumbs: [] };
  }
}
