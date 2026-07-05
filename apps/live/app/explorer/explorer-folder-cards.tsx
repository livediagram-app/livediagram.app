'use client';

// The Explorer card grid's folder cards (spec/67), split out of
// CardView: the real FolderCard (rename / menu / child count) and the
// synthetic Unsorted / Generated card, plus the card shell + preview
// class constants every card shares (DiagramCard imports them back).

import { useRef, useState, type ReactNode } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { MenuItem, PortalMenu } from '@/components/primitives/PortalMenu';
import { FolderIcon, MenuFolderIcon, MenuPencilIcon, MenuTrashIcon, PlusIcon } from './icons';
import type { Folder } from '@/lib/api-client';

export const cardShell =
  'group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-300 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/50';
// Fixed height (not an aspect ratio): every diagram's SVG has a
// different intrinsic shape, so an aspect-ratio box would resolve to a
// different height per card. A fixed-height letterbox keeps every
// preview — and therefore every card — the same height; the snapshot
// sits centred via object-contain.
export const previewArea =
  'flex h-48 w-full items-center justify-center border-b border-slate-100 bg-slate-50/70 dark:border-slate-700/60 dark:bg-slate-900/30';

export function FolderCard({
  folder,
  childCount,
  renaming,
  onOpen,
  onCommitRename,
  onCancelRename,
  getActions,
}: {
  folder: Folder;
  childCount: number;
  renaming: boolean;
  onOpen: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  getActions: (anchor: HTMLElement | null) => {
    rename: () => void;
    newSubfolder: () => void;
    move: () => void;
    delete: () => void;
  };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const actions = getActions(menuRef.current);
  return (
    <div
      className={cardShell}
      onContextMenu={
        renaming
          ? undefined
          : (e) => {
              e.preventDefault();
              setMenuOpen(true);
            }
      }
    >
      <button
        type="button"
        onClick={onOpen}
        onDoubleClick={onOpen}
        className={`${previewArea} text-brand-400 dark:text-brand-300`}
        aria-label={`Open folder ${folder.name}`}
      >
        <span className="[&_svg]:h-9 [&_svg]:w-9">
          <FolderIcon open={false} />
        </span>
      </button>
      <div className="flex items-start gap-1 p-2.5">
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
            className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-900 transition hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
          >
            {folder.name}
            {childCount > 0 ? (
              <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {childCount}
              </span>
            ) : null}
          </button>
        )}
        {renaming ? null : (
          <EllipsisTriggerButton
            ref={menuRef}
            tuck
            label={`Menu for folder ${folder.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
          />
        )}
      </div>
      {menuOpen ? (
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <MenuItem
            icon={<MenuPencilIcon />}
            label="Rename"
            onClick={() => {
              actions.rename();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<PlusIcon />}
            label="New subfolder"
            onClick={() => {
              actions.newSubfolder();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuFolderIcon />}
            label="Change Folder"
            onClick={() => {
              actions.move();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuTrashIcon />}
            label="Delete"
            danger
            onClick={() => {
              actions.delete();
              setMenuOpen(false);
            }}
          />
        </PortalMenu>
      ) : null}
    </div>
  );
}

// Unsorted / Generated: a folder-shaped card with no actions (it's a
// synthetic view, not a real folders row).
export function SyntheticFolderCard({
  icon,
  label,
  count,
  onOpen,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className={`${cardShell} text-left`}>
      <span className={`${previewArea} text-brand-400 dark:text-brand-300`}>
        <span className="[&_svg]:h-9 [&_svg]:w-9">{icon}</span>
      </span>
      <span className="flex items-center gap-1.5 p-2.5">
        <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {label}
        </span>
        {count > 0 ? (
          <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {count}
          </span>
        ) : null}
      </span>
    </button>
  );
}
