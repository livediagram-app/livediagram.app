'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import { useFolderPreviews } from '../data/useFolderPreviews';
import { useItemList } from '../data/useItemList';
import { viewList } from '../data/viewLists';
import { useExplorer } from '../explorer/context';
import { emptyCopy } from '../explorer/EmptyPane';
import { OtherAppsHere } from '../explorer/OtherAppsHere';
import { useOtherApps } from '../data/useOtherApps';
import { BackBar, Button } from '@liveworkspace/ui';
import type { ExplorerView } from '../views';
import { PANE_LINK, PaneEmpty, PaneFailed, PaneGrid, PaneList, PaneSkeleton } from './pane-parts';
import type { PanelSection } from './sections';
import { paneView } from './panel-view';
import { FolderCard, ItemRow } from './pane-items';

// ---- A place: Shared With Me, My Work, a team, Favourites -------------------------------------------------

export function PlaceSection({
  section,
  folderId,
  onOpenFolder,
  currentId,
  rootLabel,
  pendingRename,
}: {
  section: Exclude<PanelSection, { kind: 'home' } | { kind: 'inbox' } | { kind: 'trash' }>;
  folderId: string | null;
  onOpenFolder: (id: string | null) => void;
  currentId: string | null;
  rootLabel: string;
  pendingRename: React.MutableRefObject<((id: string) => void) | null>;
}) {
  const { client, app, filter, overlay, epoch, placedEpoch, folders, words, setRenamingId } =
    useExplorer();
  const sharedMeta = useRef(new Map());
  const view = paneView(section, folderId);
  const list = useMemo(
    () => viewList(client, view, app, filter, sharedMeta.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, app, filter, view.kind, 'id' in view ? view.id : null, folderId],
  );
  const state = useItemList({
    key: list?.key ?? 'none',
    load: list?.load ?? (async () => ({ items: [], nextCursor: null })),
    overlay,
    belongs: list?.belongs,
    cap: list?.cap,
    epoch,
    enabled: Boolean(list?.enabled),
  });
  // A folder just made opens renaming.
  useEffect(() => {
    pendingRename.current = (id) => setRenamingId(id);
    return () => {
      pendingRename.current = null;
    };
  }, [pendingRename, setRenamingId]);

  const teamId = section.kind === 'team' ? section.id : null;
  const space = section.kind === 'mine' || section.kind === 'team';
  const folderRows = space ? folders.childrenOf(folderId, teamId) : [];
  // What is inside each folder card, for its count: one request for the cards shown.
  const previews = useFolderPreviews({
    client,
    folderIds: folderRows.map((f) => f.id),
    app: filter === 'all' ? null : app,
    epoch,
    placedEpoch,
  });
  const trail: Folder[] = [];
  for (
    let f = folderId ? folders.byId.get(folderId) : undefined;
    f;
    f = f.parentId ? folders.byId.get(f.parentId) : undefined
  )
    trail.unshift(f);
  const here = trail.at(-1)?.name ?? rootLabel;

  // Empty in this app, a folder may still hold other apps' items: the pane says so (useOtherApps).
  const emptyView: ExplorerView = folderId ? { kind: 'folder', id: folderId } : view;
  const others = useOtherApps({
    client,
    view: emptyView,
    app,
    enabled:
      space &&
      filter === 'app' &&
      !state.loading &&
      !state.error &&
      !folders.loading &&
      folderRows.length + state.items.length === 0,
    epoch,
  });

  let content: ReactNode;
  if (state.error) {
    content = <PaneFailed message="This list could not load." onRetry={state.retry} />;
  } else if (state.loading || (space && folders.loading)) {
    content = <PaneSkeleton />;
  } else if (folderRows.length + state.items.length === 0 && others) {
    content = <OtherAppsHere view={emptyView} others={others} compact />;
  } else if (folderRows.length + state.items.length === 0) {
    const copy = emptyCopy(emptyView, words);
    content = <PaneEmpty icon={copy.icon} title={copy.title} description={copy.description} />;
  } else {
    content = (
      // Keyed by the folder open, so opening one slides its contents in.
      <div key={folderId ?? 'root'} className="flex animate-view-forward flex-col gap-3">
        {folderRows.length ? (
          <PaneGrid label={`Folders in ${here}`}>
            {folderRows.map((f) => (
              <FolderCard
                key={f.id}
                folder={f}
                itemCount={previews.get(f.id)?.itemCount}
                elsewhere={previews.get(f.id)?.elsewhere?.itemCount}
                onOpen={() => onOpenFolder(f.id)}
              />
            ))}
          </PaneGrid>
        ) : null}
        {state.items.length ? (
          <PaneList label={here}>
            {state.items.map((item) => (
              <ItemRow key={item.id} item={item} current={item.id === currentId} />
            ))}
          </PaneList>
        ) : null}
        {state.hasMore ? (
          <Button
            variant="none"
            busy={state.loadingMore}
            onClick={state.moreFailed ? state.retryMore : state.loadMore}
            className={`${PANE_LINK} self-center py-1`}
          >
            {state.loadingMore
              ? 'Loading…'
              : state.moreFailed
                ? 'Couldn’t load more. Try again'
                : 'Show more'}
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {trail.length ? (
        <BackBar
          gap="tight"
          label={trail.at(-2)?.name ?? rootLabel}
          current={trail.at(-1)!.name}
          onClick={() => onOpenFolder(trail.at(-2)?.id ?? null)}
        />
      ) : null}
      {content}
    </div>
  );
}
