import { useRef, useState } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import type { Folder } from '@/lib/api-client';
import { relativeSince, useRelativeTimeTick } from '@/lib/relative-time';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { MenuItem, PortalMenu } from '@/components/primitives/PortalMenu';
import { FolderIcon, MenuFolderIcon, MenuPencilIcon, MenuTrashIcon, PlusIcon } from './icons';

// The Explorer's folder row (spec/15) + its shared actions menu, lifted
// out of views.tsx: the list row (icon, inline rename, child-count
// badge, relative time, ellipsis / right-click menu) and the
// FolderMenuItems the sidebar tree reuses so both surfaces offer the
// same actions. Re-exported from views.tsx so importers keep resolving.

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
  getActionsForAnchor: (anchor: HTMLElement | null) => {
    rename: () => void;
    newSubfolder: () => void;
    move: () => void;
    delete: () => void;
  };
}) {
  useRelativeTimeTick();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  // When renaming, the label area is a plain div so the <input>
  // inside it isn't nested in a <button> (which steals focus).
  const labelInner = (
    <>
      <span className="shrink-0 text-amber-500">
        <FolderIcon open={false} />
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
      {childCount > 0 ? (
        <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {childCount}
        </span>
      ) : null}
    </>
  );
  return (
    <li
      className="group grid grid-cols-[1fr_140px_40px] sm:grid-cols-[1fr_90px_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-700"
      // Right-click anywhere on the row opens the same actions menu as the
      // ellipsis button (anchored to it).
      onContextMenu={
        renaming
          ? undefined
          : (e) => {
              e.preventDefault();
              setMenuOpen(true);
            }
      }
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
      <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {relativeSince(folder.updatedAt)}
      </span>
      {renaming ? (
        <span />
      ) : (
        <EllipsisTriggerButton
          ref={menuRef}
          label={`Menu for ${folder.name}`}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
        />
      )}
      {menuOpen ? (
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <FolderMenuItems
            actions={getActionsForAnchor(menuRef.current)}
            close={() => setMenuOpen(false)}
          />
        </PortalMenu>
      ) : null}
    </li>
  );
}

export function FolderMenuItems({
  actions,
  close,
}: {
  actions: {
    rename: () => void;
    newSubfolder: () => void;
    move: () => void;
    delete: () => void;
  };
  close: () => void;
}) {
  return (
    <>
      <MenuItem
        icon={<MenuPencilIcon />}
        label="Rename"
        onClick={() => {
          actions.rename();
          close();
        }}
      />
      <MenuItem
        icon={<PlusIcon />}
        label="New subfolder"
        onClick={() => {
          actions.newSubfolder();
          close();
        }}
      />
      <MenuItem
        icon={<MenuFolderIcon />}
        label="Change Folder"
        onClick={() => {
          actions.move();
          close();
        }}
      />
      <MenuItem
        icon={<MenuTrashIcon />}
        label="Delete"
        danger
        onClick={() => {
          actions.delete();
          close();
        }}
      />
    </>
  );
}
