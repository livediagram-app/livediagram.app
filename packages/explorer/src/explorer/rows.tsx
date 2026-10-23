'use client';

// One item or folder as a list row or a card (liveplanner's ProjectRow, FolderRow, ProjectCard and
// FolderCard). Rows are memoised on their item: the overlay hands a new object only to the item that
// changed, and the context's callbacks are stable, so a rename or a star re-renders one row, not the list.

import { memo, useCallback } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import type { ShownItem } from '../data/overlay';
import { CountBadge } from '../ui/CountBadge';
import { InlineRenameInput } from '../ui/InlineRenameInput';
import { RelativeTimeChip } from '../ui/RelativeTimeChip';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { CARD_PREVIEW, CARD_SHELL, RENAME_INPUT } from '../ui/classes';
import { FolderSolidIcon, ItemIcon } from '../ui/icons';
import { AppMark, FavouriteMarker, FolderChip, VisibilityBadge } from './badges';
import { useExplorer } from './context';
import { FolderMenu, ItemMenu } from './menus';

// Every list row is this tall, so a long list can be windowed by arithmetic.
export const ROW_HEIGHT = 48;

export const ROW_GRID = 'grid grid-cols-[1fr_140px_40px] sm:grid-cols-[1fr_90px_140px_40px]';

const ROW = 'group items-center gap-2 px-4 transition hover:bg-slate-50 dark:hover:bg-slate-700';

export type RowOptions = {
  // The app's mark beside the name (the All filter).
  showApp: boolean;
  // The folder chip (Recent, Favourites, Search: lists that span folders).
  showFolder: boolean;
};

function useItemBits(item: ShownItem) {
  const { folders, navigate, actions, setRenamingId, itemHref } = useExplorer();
  const folder = item.folderId ? folders.byId.get(item.folderId) : undefined;
  const openFolder = useCallback(() => {
    if (!folder) return;
    navigate(
      folder.teamId
        ? { kind: 'team', id: folder.teamId, folderId: folder.id }
        : { kind: 'folder', id: folder.id },
    );
  }, [folder, navigate]);
  const commitRename = useCallback(
    (title: string) => {
      setRenamingId(null);
      void actions.rename(item, title);
    },
    [actions, item, setRenamingId],
  );
  const cancelRename = useCallback(() => setRenamingId(null), [setRenamingId]);
  return { folder, openFolder, commitRename, cancelRename, href: itemHref(item) };
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
  const { Link, renderThumbnail } = useExplorer();
  const bits = useItemBits(item);
  const menu = useRowMenu({ disabled: renaming });
  const title = item.title || 'Untitled';
  return (
    <li
      data-item-row={item.id}
      className={`${ROW_GRID} ${ROW}`}
      style={{ height: ROW_HEIGHT }}
      onContextMenu={menu.onContextMenu}
    >
      <span className="flex min-w-0 items-center gap-2">
        {options.showApp ? <AppMark app={item.app} /> : null}
        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded text-slate-400">
          {renderThumbnail ? renderThumbnail(item, 'row') : <ItemIcon />}
        </span>
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
        {options.showFolder && bits.folder ? (
          <span className="hidden shrink-0 sm:inline-flex">
            <FolderChip label={bits.folder.name} onOpen={bits.openFolder} />
          </span>
        ) : null}
      </span>
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
  // Subfolders only: counting a folder's items would be a request per folder.
  const childCount = folders.childrenOf(folder.id, folder.teamId).length;
  return { open, commitRename, cancelRename, childCount };
}

export const FolderRow = memo(function FolderRow({
  folder,
  renaming,
}: {
  folder: Folder;
  renaming: boolean;
}) {
  const bits = useFolderBits(folder);
  const menu = useRowMenu({ disabled: renaming });
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
      {bits.childCount > 0 ? <CountBadge count={bits.childCount} className="ml-1" /> : null}
    </>
  );
  return (
    <li
      data-folder-row={folder.id}
      className={`${ROW_GRID} ${ROW}`}
      style={{ height: ROW_HEIGHT }}
      onContextMenu={menu.onContextMenu}
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
  const { Link, renderThumbnail } = useExplorer();
  const bits = useItemBits(item);
  const menu = useRowMenu({ disabled: renaming });
  const title = item.title || 'Untitled';
  const preview = renderThumbnail ? (
    renderThumbnail(item, 'card')
  ) : (
    <span className="text-slate-300 dark:text-slate-600 [&_svg]:h-10 [&_svg]:w-10">
      <ItemIcon />
    </span>
  );
  return (
    <div data-item-card={item.id} className={CARD_SHELL} onContextMenu={menu.onContextMenu}>
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
          {item.favourite ? <FavouriteMarker /> : null}
          {options.showFolder && bits.folder ? (
            <FolderChip label={bits.folder.name} onOpen={bits.openFolder} />
          ) : null}
          <span className="flex min-w-0 !shrink items-center">
            <RelativeTimeChip at={item.trashedAt ?? item.updatedAt} />
          </span>
        </div>
      </div>
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </div>
  );
});

export const FolderCard = memo(function FolderCard({
  folder,
  renaming,
}: {
  folder: Folder;
  renaming: boolean;
}) {
  const bits = useFolderBits(folder);
  const menu = useRowMenu({ disabled: renaming });
  return (
    <div data-folder-card={folder.id} className={CARD_SHELL} onContextMenu={menu.onContextMenu}>
      <button
        type="button"
        onClick={renaming ? undefined : bits.open}
        className={CARD_PREVIEW}
        aria-label={`Open ${folder.name}`}
      >
        <span className="text-amber-400 [&_svg]:h-14 [&_svg]:w-14">
          <FolderSolidIcon size={56} />
        </span>
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
        {bits.childCount > 0 ? <CountBadge count={bits.childCount} /> : null}
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
