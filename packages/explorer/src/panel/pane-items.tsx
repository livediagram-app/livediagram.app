'use client';

// The pane's cards and rows: Home's Jump Back In cards, a space's folder cards and its item rows, each with its menu,
// inline rename and drag.

import { memo } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import { jumpBackInLine } from '../data/viewLists';
import type { ShownItem } from '../data/overlay';
import { useExplorer } from '../explorer/context';
import { AppMark, FavouriteMarker } from '../explorer/badges';
import { FolderMenu, ItemMenu } from '../explorer/menus';
import { elsewhereLabel } from '../explorer/FolderMosaic';
import { useDropTarget, useFolderDrag, useItemDrag } from '../drag/drag';
import { InlineRenameInput } from '../ui/InlineRenameInput';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { FolderSolidIcon, ItemIcon } from '../ui/icons';
import { relativeSince, useNow } from '../time';
import { folderCountLabel } from '../words';
import { PANE_PREVIEW_BOX, PANE_THUMB_BOX, FolderPreview, PaneCard, PaneRow } from './pane-parts';

function Preview({ item, size }: { item: ShownItem; size: 'row' | 'card' }) {
  const { renderThumbnail } = useExplorer();
  const thumb = renderThumbnail?.(item, size);
  if (thumb)
    return (
      <span className={`block ${size === 'card' ? PANE_PREVIEW_BOX : PANE_THUMB_BOX}`}>
        {thumb}
      </span>
    );
  return (
    <span
      className={`flex items-center justify-center text-slate-300 dark:text-slate-600 ${
        size === 'card' ? `${PANE_PREVIEW_BOX} [&_svg]:h-7 [&_svg]:w-7` : PANE_THUMB_BOX
      }`}
    >
      <ItemIcon size={size === 'card' ? 28 : 16} />
    </span>
  );
}

function usePaneItemMenu(item: ShownItem) {
  const menu = useRowMenu();
  const name = item.title || 'Untitled';
  return {
    onContextMenu: menu.onContextMenu,
    trailing: (
      <>
        <EllipsisTriggerButton {...menu.triggerProps} size="md" reveal label={`Menu for ${name}`} />
        {menu.open ? (
          <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
        ) : null}
      </>
    ),
  };
}

export const JumpBackInCard = memo(function JumpBackInCard({ item }: { item: ShownItem }) {
  const { openItem, filter, kind, actions, renamingId, setRenamingId } = useExplorer();
  const menu = usePaneItemMenu(item);
  const editing = renamingId === item.id;
  const drag = useItemDrag(item, editing);
  const now = useNow();
  const name = item.title || `Untitled ${kind.lowerOne}`;
  const commit = (next: string) => {
    setRenamingId(null);
    void actions.rename(item, next);
  };
  return (
    <PaneCard
      preview={<Preview item={item} size="card" />}
      title={
        editing ? (
          <InlineRenameInput
            initial={item.title}
            ariaLabel={`Rename ${name}`}
            onCommit={commit}
            onCancel={() => setRenamingId(null)}
            className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-[13px] dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          name
        )
      }
      label={name}
      meta={
        <span className="flex items-center gap-1.5">
          {filter === 'all' ? <AppMark app={item.app} size={12} /> : null}
          <span className="truncate">{jumpBackInLine(item, now || Date.now())}</span>
        </span>
      }
      onActivate={editing ? undefined : () => openItem(item)}
      rowProps={{ onContextMenu: menu.onContextMenu, ...drag }}
      trailing={editing ? null : menu.trailing}
    />
  );
});

export const FolderCard = memo(function FolderCard({
  folder,
  itemCount,
  elsewhere,
  onOpen,
}: {
  folder: Folder;
  // How many items it holds, once the index has said.
  itemCount?: number;
  // With none of this app's, how many other apps' items it holds (useFolderPreviews).
  elsewhere?: number;
  onOpen: () => void;
}) {
  const { folders, renamingId, setRenamingId, words } = useExplorer();
  const editing = renamingId === folder.id;
  const menu = useRowMenu({ disabled: editing });
  const drop = useDropTarget({ teamId: folder.teamId, folderId: folder.id });
  const drag = useFolderDrag(folder, editing);
  const own = folderCountLabel(
    folders.childrenOf(folder.id, folder.teamId).length,
    elsewhere ? undefined : itemCount,
    words,
  );
  // "2 folders · 3 in other apps": a folder of another app's items never reads as empty.
  const count = elsewhere
    ? own === 'Folder'
      ? elsewhereLabel(elsewhere)
      : `${own} · ${elsewhereLabel(elsewhere)}`
    : own;
  const commit = (name: string) => {
    const next = name.trim();
    if (next && next !== folder.name) void folders.rename(folder.id, next);
    setRenamingId(null);
  };
  return (
    <PaneCard
      preview={<FolderPreview icon={<FolderSolidIcon />} count={count} />}
      title={
        editing ? (
          <InlineRenameInput
            initial={folder.name}
            ariaLabel={`Rename ${folder.name}`}
            onCommit={commit}
            onCancel={() => setRenamingId(null)}
            className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-[13px] dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          folder.name
        )
      }
      label={folder.name}
      onActivate={editing ? undefined : onOpen}
      rowProps={{ onContextMenu: menu.onContextMenu, ...drop.handlers, ...drag }}
      highlighted={drop.over}
      trailing={
        editing ? null : (
          <>
            <EllipsisTriggerButton
              {...menu.triggerProps}
              size="md"
              reveal
              label={`Menu for ${folder.name}`}
            />
            {menu.open ? (
              <FolderMenu folder={folder} anchor={menu.triggerRef.current} onClose={menu.close} />
            ) : null}
          </>
        )
      }
    />
  );
});

export const ItemRow = memo(function ItemRow({
  item,
  current,
}: {
  item: ShownItem;
  current: boolean;
}) {
  const { openItem, filter, kind, actions, renamingId, setRenamingId, renderItemMark } =
    useExplorer();
  const menu = usePaneItemMenu(item);
  const now = useNow();
  const name = item.title || `Untitled ${kind.lowerOne}`;
  // The open item renames on its card on top, never twice.
  const editing = renamingId === item.id && !current;
  const drag = useItemDrag(item, editing);
  const commit = (next: string) => {
    const trimmed = next.trim();
    if (trimmed && trimmed !== item.title) void actions.rename(item, trimmed);
    setRenamingId(null);
  };
  return (
    <PaneRow
      leading={<Preview item={item} size="row" />}
      title={
        editing ? (
          <InlineRenameInput
            initial={item.title}
            ariaLabel={`Rename ${name}`}
            onCommit={commit}
            onCancel={() => setRenamingId(null)}
            className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-[13px] dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          <span className="flex min-w-0 items-center gap-1">
            {filter === 'all' ? <AppMark app={item.app} size={12} /> : null}
            {item.favourite ? <FavouriteMarker /> : null}
            {renderItemMark?.(item, 'title')}
            <span className="min-w-0 truncate">{name}</span>
          </span>
        )
      }
      label={name}
      meta={`Updated ${relativeSince(item.updatedAt, now || Date.now())}`}
      current={current}
      onActivate={editing ? undefined : () => openItem(item)}
      rowProps={{ onContextMenu: menu.onContextMenu, ...drag }}
      trailing={editing ? null : menu.trailing}
    />
  );
});
