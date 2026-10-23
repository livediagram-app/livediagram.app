'use client';

// One item or folder as a list row or a card (liveplanner's ProjectRow, FolderRow, ProjectCard and
// FolderCard). Rows are memoised on their item: the overlay hands a new object only to the item that
// changed, and the context's callbacks are stable, so a rename or a star re-renders one row, not the list.

import { memo, useCallback, useMemo } from 'react';
import type { Folder, FolderPreview } from '@liveworkspace/index-client';
import type { ShownItem } from '../data/overlay';
import { CountBadge } from '../ui/CountBadge';
import { InlineRenameInput } from '../ui/InlineRenameInput';
import { RelativeTimeChip } from '../ui/RelativeTimeChip';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { CARD_PREVIEW, CARD_SHELL, DROP_TARGET_RING, RENAME_INPUT } from '../ui/classes';
import { DROP_ROW, useDropTarget, useFolderDrag, useItemDrag } from '../drag/drag';
import { FolderSolidIcon, ItemIcon } from '../ui/icons';
import { AppMark, FavouriteMarker, FolderChip, MadeByAiBadge, VisibilityBadge } from './badges';
import { useExplorer } from './context';
import { FolderMosaic } from './FolderMosaic';
import { FolderMenu, ItemMenu } from './menus';
import { DefaultFolderMarker } from '../defaults/DefaultFolderMarker';
import { folderCountLabel } from '../words';
import { SIDEBAR_LABELS } from '../views';

// Every list row is this tall, so a long list can be windowed by arithmetic.
export const ROW_HEIGHT = 48;

export const ROW_GRID = 'grid grid-cols-[1fr_140px_40px] sm:grid-cols-[1fr_90px_140px_40px]';
// With the Owner column (Recent and Search, as livediagram's list).
export const ROW_GRID_OWNER =
  'grid grid-cols-[1fr_140px_40px] sm:grid-cols-[1fr_110px_90px_140px_40px]';
export const rowGrid = (showOwner: boolean) => (showOwner ? ROW_GRID_OWNER : ROW_GRID);

const ROW = 'group items-center gap-2 px-4 transition hover:bg-slate-50 dark:hover:bg-slate-700';

export type RowOptions = {
  // The app's mark beside the name (the All filter).
  showApp: boolean;
  // The location chip (Recent, Favourites, Search: lists that span places).
  showFolder: boolean;
  // The Owner column, and the owner line on a card (Recent, Search): You, the team, or Shared with you.
  showOwner?: boolean;
};

export type ItemPlace = { label: string; open: () => void };

/** Who a row's Owner cell names: the team for a team item, "Shared with you" for one reached through a link or
 * owned by someone else, otherwise "You". The index keeps no names, so a sharer is not named. */
export function ownerLabel(
  item: Pick<ShownItem, 'teamId' | 'ownerId' | 'sharedVia'>,
  viewerId: string | null,
  teamName: (id: string | null) => string | null,
): string {
  if (item.teamId) return teamName(item.teamId) ?? 'Team';
  if (item.sharedVia || (viewerId && item.ownerId !== viewerId)) return 'Shared with you';
  return 'You';
}

export function useItemBits(item: ShownItem) {
  const { folders, navigate, actions, setRenamingId, itemHref, teamName } = useExplorer();
  const folder = item.folderId ? folders.byId.get(item.folderId) : undefined;
  // Where the item lives, for the location chip (livediagram's rowLocation): its folder, its team's library for a
  // team item in no folder, My Work for one of yours in none; nothing for an item reached through a link, which
  // lives in someone else's library.
  const placeLabel = item.sharedVia
    ? null
    : folder
      ? folder.name
      : item.folderId
        ? null
        : item.teamId
          ? teamName(item.teamId)
          : SIDEBAR_LABELS.myWork;
  const placeTeam = item.teamId;
  const placeFolderId = folder?.id ?? null;
  const open = useCallback(() => {
    if (placeFolderId)
      navigate(
        placeTeam
          ? { kind: 'team', id: placeTeam, folderId: placeFolderId }
          : { kind: 'folder', id: placeFolderId },
      );
    else navigate(placeTeam ? { kind: 'team', id: placeTeam } : { kind: 'all' });
  }, [navigate, placeFolderId, placeTeam]);
  const place: ItemPlace | null = useMemo(
    () => (placeLabel ? { label: placeLabel, open } : null),
    [placeLabel, open],
  );
  const commitRename = useCallback(
    (title: string) => {
      setRenamingId(null);
      void actions.rename(item, title);
    },
    [actions, item, setRenamingId],
  );
  const cancelRename = useCallback(() => setRenamingId(null), [setRenamingId]);
  return { folder, place, commitRename, cancelRename, href: itemHref(item) };
}

export const ItemRow = memo(function ItemRow({
  item,
  renaming,
  options,
}: {
  item: ShownItem;
  renaming: boolean;
  options: RowOptions;
}) {
  const { Link, viewerId, teamName } = useExplorer();
  const bits = useItemBits(item);
  const menu = useRowMenu({ disabled: renaming });
  const drag = useItemDrag(item, renaming);
  const title = item.title || 'Untitled';
  const showOwner = options.showOwner === true;
  return (
    <li
      data-item-row={item.id}
      className={`${rowGrid(showOwner)} ${ROW}`}
      style={{ height: ROW_HEIGHT }}
      onContextMenu={menu.onContextMenu}
      {...drag}
    >
      <span className="flex min-w-0 items-center gap-2">
        {options.showApp ? <AppMark app={item.app} /> : null}
        <RowThumb item={item} />
        {item.favourite ? <FavouriteMarker /> : null}
        {renaming ? (
          <InlineRenameInput
            initial={item.title}
            ariaLabel={`Rename ${title}`}
            onCommit={bits.commitRename}
            onCancel={bits.cancelRename}
            className={RENAME_INPUT}
          />
        ) : (
          <Link
            href={bits.href}
            className="truncate text-sm font-medium text-slate-900 transition hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
          >
            {title}
          </Link>
        )}
        {options.showFolder && bits.place ? (
          <span className="hidden shrink-0 sm:inline-flex">
            <FolderChip label={bits.place.label} onOpen={bits.place.open} />
          </span>
        ) : null}
        <MadeByAiBadge item={item} />
      </span>
      {showOwner ? (
        <span className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
          {ownerLabel(item, viewerId, teamName)}
        </span>
      ) : null}
      <span className="hidden sm:flex sm:items-center">
        <VisibilityBadge item={item} />
      </span>
      <span className="flex min-w-0 items-center">
        <RelativeTimeChip at={item.trashedAt ?? item.updatedAt} />
      </span>
      {renaming ? (
        <span />
      ) : (
        <EllipsisTriggerButton {...menu.triggerProps} label={`Menu for ${title}`} />
      )}
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </li>
  );
});

function useFolderBits(folder: Folder) {
  const { navigate, folders, setRenamingId } = useExplorer();
  const open = useCallback(
    () =>
      navigate(
        folder.teamId
          ? { kind: 'team', id: folder.teamId, folderId: folder.id }
          : { kind: 'folder', id: folder.id },
      ),
    [folder.id, folder.teamId, navigate],
  );
  const commitRename = useCallback(
    (name: string) => {
      setRenamingId(null);
      const next = name.trim();
      if (next && next !== folder.name) void folders.rename(folder.id, next);
    },
    [folder.id, folder.name, folders, setRenamingId],
  );
  const cancelRename = useCallback(() => setRenamingId(null), [setRenamingId]);
  // Its subfolders, from the folders already loaded; its items come from the batched previews.
  const childCount = folders.childrenOf(folder.id, folder.teamId).length;
  return { open, commitRename, cancelRename, childCount };
}

/**
 * A folder's count pill: its subfolders and items together, as liveplanner's rows and cards counted them, read out
 * (and shown on hover) as "2 folders · 5 plans". Until the previews answer it counts the subfolders alone.
 */
function FolderCount({
  subfolders,
  items,
  className,
}: {
  subfolders: number;
  items: number | undefined;
  className?: string;
}) {
  const { words } = useExplorer();
  const count = subfolders + (items ?? 0);
  if (count === 0) return null;
  const label = folderCountLabel(subfolders, items, words);
  return (
    <span title={label} data-folder-count className={`inline-flex shrink-0 ${className ?? ''}`}>
      <span aria-hidden className="inline-flex">
        <CountBadge count={count} />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export const FolderRow = memo(function FolderRow({
  folder,
  renaming,
  itemCount,
  showOwner = false,
}: {
  folder: Folder;
  renaming: boolean;
  // The list has an Owner column (a folder's cell stays empty).
  showOwner?: boolean;
  // How many items it holds, once the previews have said.
  itemCount?: number;
}) {
  const bits = useFolderBits(folder);
  const menu = useRowMenu({ disabled: renaming });
  const drop = useDropTarget({ teamId: folder.teamId, folderId: folder.id });
  const drag = useFolderDrag(folder, renaming);
  const label = (
    <>
      <span className="shrink-0 text-amber-500">
        <FolderSolidIcon />
      </span>
      {renaming ? (
        <InlineRenameInput
          initial={folder.name}
          ariaLabel={`Rename ${folder.name}`}
          onCommit={bits.commitRename}
          onCancel={bits.cancelRename}
          className={RENAME_INPUT}
        />
      ) : (
        <span className="truncate text-sm font-medium text-slate-900 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
          {folder.name}
        </span>
      )}
      <DefaultFolderMarker folderId={folder.id} />
      <FolderCount subfolders={bits.childCount} items={itemCount} className="ml-1" />
    </>
  );
  return (
    <li
      data-folder-row={folder.id}
      data-drop-over={drop.over || undefined}
      className={`${rowGrid(showOwner)} ${ROW} ${drop.over ? DROP_ROW : ''}`}
      style={{ height: ROW_HEIGHT }}
      onContextMenu={menu.onContextMenu}
      {...drop.handlers}
      {...drag}
    >
      {renaming ? (
        <div className="flex min-w-0 items-center gap-2">{label}</div>
      ) : (
        <button
          type="button"
          onClick={bits.open}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          {label}
        </button>
      )}
      {showOwner ? <span className="hidden sm:block" /> : null}
      <span className="hidden sm:block" />
      <RelativeTimeChip at={folder.updatedAt} />
      {renaming ? (
        <span />
      ) : (
        <EllipsisTriggerButton {...menu.triggerProps} label={`Menu for ${folder.name}`} />
      )}
      {menu.open ? (
        <FolderMenu folder={folder} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </li>
  );
});

export const ItemCard = memo(function ItemCard({
  item,
  renaming,
  options,
}: {
  item: ShownItem;
  renaming: boolean;
  options: RowOptions;
}) {
  const { Link, renderThumbnail, viewerId, teamName } = useExplorer();
  const bits = useItemBits(item);
  const menu = useRowMenu({ disabled: renaming });
  const drag = useItemDrag(item, renaming);
  const title = item.title || 'Untitled';
  const preview = renderThumbnail?.(item, 'card') ?? (
    <span className="text-slate-300 dark:text-slate-600 [&_svg]:h-10 [&_svg]:w-10">
      <ItemIcon />
    </span>
  );
  return (
    <div
      data-item-card={item.id}
      className={CARD_SHELL}
      onContextMenu={menu.onContextMenu}
      {...drag}
    >
      {renaming ? (
        <span className={CARD_PREVIEW}>{preview}</span>
      ) : (
        <Link href={bits.href} className={CARD_PREVIEW} aria-label={`Open ${title}`}>
          {preview}
        </Link>
      )}
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="flex items-start gap-1">
          {options.showApp ? (
            <span className="mt-0.5">
              <AppMark app={item.app} />
            </span>
          ) : null}
          {renaming ? (
            <InlineRenameInput
              initial={item.title}
              ariaLabel={`Rename ${title}`}
              onCommit={bits.commitRename}
              onCancel={bits.cancelRename}
              className={`min-w-0 flex-1 ${RENAME_INPUT}`}
            />
          ) : (
            <Link
              href={bits.href}
              className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 transition hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
            >
              {title}
            </Link>
          )}
          {renaming ? null : (
            <EllipsisTriggerButton {...menu.triggerProps} tuck label={`Menu for ${title}`} />
          )}
        </div>
        <div className="flex min-w-0 items-center gap-x-2 [&>*]:shrink-0">
          <VisibilityBadge item={item} />
          <MadeByAiBadge item={item} />
          {item.favourite ? <FavouriteMarker /> : null}
          {options.showFolder && bits.place ? (
            <FolderChip label={bits.place.label} onOpen={bits.place.open} />
          ) : null}
          <span className="flex min-w-0 !shrink items-center">
            <RelativeTimeChip at={item.trashedAt ?? item.updatedAt} />
          </span>
        </div>
        {options.showOwner ? (
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">
            {ownerLabel(item, viewerId, teamName)}
          </span>
        ) : null}
      </div>
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </div>
  );
});

// A row's snapshot in the box the list always drew (ProjectThumbnail's compact box), or the kind's icon when the host
// draws none for this item (another app's, say).
const ROW_THUMB_BOX =
  'h-7 w-9 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40';

function RowThumb({ item }: { item: ShownItem }) {
  const { renderThumbnail } = useExplorer();
  const thumb = renderThumbnail?.(item, 'row');
  return thumb ? (
    <span className={ROW_THUMB_BOX}>{thumb}</span>
  ) : (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded text-slate-400">
      <ItemIcon />
    </span>
  );
}

export const FolderCard = memo(function FolderCard({
  folder,
  renaming,
  preview,
}: {
  folder: Folder;
  renaming: boolean;
  // What is inside, once the index has said (useFolderPreviews); the plain glyph until then.
  preview?: FolderPreview;
}) {
  const bits = useFolderBits(folder);
  const { folders } = useExplorer();
  const menu = useRowMenu({ disabled: renaming });
  const drop = useDropTarget({ teamId: folder.teamId, folderId: folder.id });
  const drag = useFolderDrag(folder, renaming);
  return (
    <div
      data-folder-card={folder.id}
      data-drop-over={drop.over || undefined}
      className={`${CARD_SHELL} ${drop.over ? DROP_TARGET_RING : ''}`}
      onContextMenu={menu.onContextMenu}
      {...drop.handlers}
      {...drag}
    >
      <button
        type="button"
        onClick={renaming ? undefined : bits.open}
        className={CARD_PREVIEW}
        aria-label={`Open ${folder.name}`}
      >
        {preview ? (
          <FolderMosaic
            preview={preview}
            subfolders={folders.childrenOf(folder.id, folder.teamId)}
          />
        ) : (
          <span className="text-amber-400 [&_svg]:h-14 [&_svg]:w-14">
            <FolderSolidIcon size={56} />
          </span>
        )}
      </button>
      <div className="flex items-center gap-1 p-2.5">
        {renaming ? (
          <InlineRenameInput
            initial={folder.name}
            ariaLabel={`Rename ${folder.name}`}
            onCommit={bits.commitRename}
            onCancel={bits.cancelRename}
            className={`min-w-0 flex-1 ${RENAME_INPUT}`}
          />
        ) : (
          <button
            type="button"
            onClick={bits.open}
            className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-900 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
          >
            {folder.name}
          </button>
        )}
        <DefaultFolderMarker folderId={folder.id} />
        <FolderCount subfolders={bits.childCount} items={preview?.itemCount} />
        {renaming ? null : (
          <EllipsisTriggerButton {...menu.triggerProps} tuck label={`Menu for ${folder.name}`} />
        )}
      </div>
      {menu.open ? (
        <FolderMenu folder={folder} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </div>
  );
});
