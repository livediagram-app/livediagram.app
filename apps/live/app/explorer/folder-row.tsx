import { FolderSolidIcon } from '@/components/primitives/explorer-icons';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { CountBadge } from '@/components/primitives/CountBadge';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import type { Folder } from '@/lib/api-client';
import { useRelativeTimeTick } from '@/lib/relative-time';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { FolderActionsMenu } from './folder-actions-menu';
import { RelativeTimeChip } from '@/components/primitives/RelativeTimeChip';
import type { FolderActionBundle } from './explorer-view-props';

// The Explorer's folder row (docs/specs/013-workspace/folders.md), lifted out of views.tsx: the list
// row (icon, inline rename, child-count badge, relative time, ellipsis /
// right-click menu). The menu itself is the shared FolderActionsMenu,
// which the cards, the sidebar tree and the floating panel open too.

export function FolderRow({
  folder,
  renaming,
  childCount,
  onOpen,
  onCommitRename,
  onCancelRename,
  getActionsForAnchor,
}: {
  folder: Folder;
  renaming: boolean;
  childCount: number;
  onOpen: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  getActionsForAnchor: (anchor: HTMLElement | null) => FolderActionBundle;
}) {
  useRelativeTimeTick();
  const menu = useRowMenu({ disabled: renaming });

  // When renaming, the label area is a plain div so the <input>
  // inside it isn't nested in a <button> (which steals focus).
  const labelInner = (
    <>
      <span className="shrink-0 text-amber-500">
        <FolderSolidIcon />
      </span>
      {renaming ? (
        <InlineRenameInput
          initial={folder.name}
          onCommit={onCommitRename}
          onCancel={onCancelRename}
          className="rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
        />
      ) : (
        <span className="truncate text-sm font-medium text-slate-900 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
          {folder.name}
        </span>
      )}
      {childCount > 0 ? <CountBadge count={childCount} className="ml-1" /> : null}
    </>
  );
  return (
    <li
      className="group grid grid-cols-[1fr_140px_40px] sm:grid-cols-[1fr_90px_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-700"
      // Right-click anywhere on the row opens the same actions menu as the
      // ellipsis button (anchored to it).
      onContextMenu={menu.onContextMenu}
    >
      {renaming ? (
        <div className="flex min-w-0 items-center gap-2">{labelInner}</div>
      ) : (
        <button
          type="button"
          onDoubleClick={onOpen}
          onClick={onOpen}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          {labelInner}
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
        <FolderActionsMenu
          folder={folder}
          anchor={menu.triggerRef.current}
          onClose={menu.close}
          {...menuHandlers(getActionsForAnchor(menu.triggerRef.current))}
        />
      ) : null}
    </li>
  );
}

// The page's action bundle, as the shared menu's optional handlers.
export function menuHandlers(actions: FolderActionBundle) {
  return {
    onRename: actions.rename,
    onNewSubfolder: actions.newSubfolder,
    onMove: actions.move,
    onDelete: actions.delete,
  };
}
