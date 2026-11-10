'use client';

// A folder card in This Browser's view (one-explorer.md "This Browser, a Space"): drawn as My Work's folder cards
// are (rows.tsx FolderCard: the same shell, letterbox, name, count and ⋯), opening the folder, renaming in place, and
// taking a This Browser item dropped on it. Its picture is up to four of its newest items, each the app's picture of a
// local item (LocalPreview), or the folder glyph while it holds none.

import { memo } from 'react';
import type { ThisBrowserFolder, ThisBrowserItem } from '../../this-browser';
import { useDropTarget } from '../../drag/drag';
import {
  CARD_PREVIEW,
  CARD_SHELL,
  CARD_TITLE_BUTTON,
  DROP_TARGET_RING,
  RENAME_INPUT,
} from '../../ui/classes';
import { FolderSolidIcon } from '../../ui/icons';
import { InlineRenameInput } from '../../ui/InlineRenameInput';
import { EllipsisTriggerButton, useRowMenu } from '../../ui/RowMenu';
import { useExplorer } from '../context';
import { LocalPreview } from '../LocalPreview';
import { FolderCount } from '../rows';
import { LocalFolderMenu } from './LocalFolderMenu';
import { useRenameLocalFolder } from './space';

export const LocalFolderCard = memo(function LocalFolderCard({
  folder,
  subfolders,
  items,
}: {
  folder: ThisBrowserFolder;
  subfolders: number;
  // Its live items, newest change first.
  items: readonly ThisBrowserItem[];
}) {
  const { app, navigate, renamingId, setRenamingId } = useExplorer();
  const commit = useRenameLocalFolder();
  const renaming = renamingId === folder.id;
  const menu = useRowMenu({ disabled: renaming });
  const drop = useDropTarget(renaming ? null : { local: folder.id });
  const open = () => navigate({ kind: 'offline', folder: folder.id });
  const shown = items.slice(0, 4);
  return (
    <div
      data-local-folder-card={folder.id}
      data-drop-over={drop.over || undefined}
      className={`${CARD_SHELL} ${drop.over ? DROP_TARGET_RING : ''}`}
      onContextMenu={menu.onContextMenu}
      {...drop.handlers}
    >
      <button
        type="button"
        onClick={renaming ? undefined : open}
        className={CARD_PREVIEW}
        aria-label={`Open ${folder.name}`}
      >
        {shown.length > 0 ? (
          <span aria-hidden className="grid h-full w-full grid-cols-2 gap-1.5 p-3">
            {shown.map((item) => (
              <LocalPreview
                key={item.id}
                app={app}
                iconSize={18}
                className={`h-full w-full rounded-lg ${shown.length === 1 ? 'col-span-2' : ''}`}
              />
            ))}
          </span>
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
            onCommit={(name) => {
              setRenamingId(null);
              commit(folder.id, name);
            }}
            onCancel={() => setRenamingId(null)}
            className={`min-w-0 flex-1 ${RENAME_INPUT}`}
          />
        ) : (
          <button type="button" onClick={open} className={CARD_TITLE_BUTTON}>
            {folder.name}
          </button>
        )}
        <FolderCount subfolders={subfolders} items={items.length} />
        {renaming ? null : (
          <EllipsisTriggerButton {...menu.triggerProps} tuck label={`Menu for ${folder.name}`} />
        )}
      </div>
      {menu.open ? (
        <LocalFolderMenu
          folder={folder}
          anchor={menu.triggerRef.current}
          onClose={menu.close}
          onRename={setRenamingId}
        />
      ) : null}
    </div>
  );
});
