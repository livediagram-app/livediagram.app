'use client';

import type { Folder } from '@/lib/api-client';
import { DefaultFolderMarker } from '@/components/placement/DefaultFolderMarker';
import { DROP_TARGET_ROW } from '@/components/panels/useDocumentDropTarget';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { FolderSolidIcon } from '@/components/primitives/explorer-icons';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import type { FolderActionBundle } from '../explorer-view-props';
import { FolderActionsMenu } from '../folder-actions-menu';
import { menuHandlers } from '../folder-row';
import { useExplorerDropTarget } from '../useExplorerDropTarget';
import { CELL_CLASS, DateCell, SHOWN_FROM_CLASS } from './details-cells';
import { formatItems } from './details-format';

// One folder in the Details view (docs/specs/013-workspace/explorer-details-view.md): name, "Folder",
// its item count, its dates; it takes a dropped document and carries the folder menu.
export function DetailsFolderRow({
  folder,
  itemCount,
  renaming,
  onOpen,
  onCommitRename,
  onCancelRename,
  getActions,
}: {
  folder: Folder;
  itemCount: number;
  renaming: boolean;
  onOpen: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  getActions: (anchor: HTMLElement | null) => FolderActionBundle;
}) {
  const menu = useRowMenu({ disabled: renaming });
  const drop = useExplorerDropTarget({ teamId: folder.teamId ?? null, folderId: folder.id });
  return (
    <tr
      className={`group transition hover:bg-slate-50 dark:hover:bg-slate-700/60 ${
        drop.isDragOver ? DROP_TARGET_ROW : ''
      }`}
      onContextMenu={menu.onContextMenu}
      {...drop.handlers}
    >
      <td className={`${CELL_CLASS} max-w-0`}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-amber-500">
            <FolderSolidIcon />
          </span>
          {renaming ? (
            <InlineRenameInput
              initial={folder.name}
              onCommit={onCommitRename}
              onCancel={onCancelRename}
              className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
            />
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="truncate text-left text-sm font-medium text-slate-900 transition hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
            >
              {folder.name}
            </button>
          )}
          {renaming ? null : <DefaultFolderMarker folderId={folder.id} />}
        </span>
      </td>
      <td
        className={`${CELL_CLASS} ${SHOWN_FROM_CLASS.sm} text-xs text-slate-600 dark:text-slate-300`}
      >
        Folder
      </td>
      <td className={`${CELL_CLASS} ${SHOWN_FROM_CLASS.md}`} />
      <td className={`${CELL_CLASS} ${SHOWN_FROM_CLASS.md}`} />
      <td
        className={`${CELL_CLASS} ${SHOWN_FROM_CLASS.sm} whitespace-nowrap text-right text-xs tabular-nums text-slate-600 dark:text-slate-300`}
      >
        {formatItems(itemCount)}
      </td>
      <td className={`${CELL_CLASS} ${SHOWN_FROM_CLASS.md}`}>
        <DateCell at={folder.createdAt} />
      </td>
      <td className={CELL_CLASS}>
        <DateCell at={folder.updatedAt} />
      </td>
      <td className={`${CELL_CLASS} text-right`}>
        {renaming ? null : (
          <EllipsisTriggerButton
            {...menu.triggerProps}
            reveal
            label={`Menu for folder ${folder.name}`}
          />
        )}
        {menu.open ? (
          <FolderActionsMenu
            folder={folder}
            anchor={menu.triggerRef.current}
            onClose={menu.close}
            {...menuHandlers(getActions(menu.triggerRef.current))}
          />
        ) : null}
      </td>
    </tr>
  );
}
