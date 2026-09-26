'use client';

// The Explorer card grid's folder cards (docs/specs/006-diagram/diagram-snapshots.md), split out of
// CardView: the real FolderCard (rename / menu / child count) and the
// synthetic Unsorted / Generated card. The card shell + preview classes
// every card shares live in @livediagram/ui, where the Timeline's cards
// use them too (docs/specs/013-workspace/timeline.md §2).

import type { ReactNode } from 'react';
import { CARD_PREVIEW as previewArea, CARD_SHELL as cardShell } from '@livediagram/ui';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { CountBadge } from '@/components/primitives/CountBadge';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { FolderActionsMenu } from './folder-actions-menu';
import { FolderSolidIcon } from '@/components/primitives/explorer-icons';
import type { Folder } from '@/lib/api-client';
import type { FolderActionBundle } from './explorer-view-props';
import { menuHandlers } from './folder-row';

// The plain folder mark that fills a folder card's preview box when
// there's nothing inside to preview (docs/specs/013-workspace/folder-content-previews.md). Exported so FolderPreview
// falls back to exactly this glyph for an empty folder rather than
// leaving the box blank.
export function FolderCardGlyph() {
  return (
    <span className="[&_svg]:h-9 [&_svg]:w-9">
      <FolderSolidIcon open={false} />
    </span>
  );
}

export function FolderCard({
  folder,
  childCount,
  preview,
  renaming,
  onOpen,
  onCommitRename,
  onCancelRename,
  getActions,
}: {
  folder: Folder;
  childCount: number;
  // A content preview of what's inside (docs/specs/013-workspace/folder-content-previews.md), built by the caller so
  // this card stays presentational. Absent (or an empty folder, which
  // renders as null) falls back to the plain folder glyph.
  preview?: ReactNode;
  renaming: boolean;
  onOpen: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  getActions: (anchor: HTMLElement | null) => FolderActionBundle;
}) {
  const menu = useRowMenu({ disabled: renaming });
  return (
    <div className={cardShell} onContextMenu={menu.onContextMenu}>
      <button
        type="button"
        onClick={onOpen}
        onDoubleClick={onOpen}
        className={`${previewArea} text-brand-400 dark:text-brand-300`}
        aria-label={`Open folder ${folder.name}`}
      >
        {preview ?? <FolderCardGlyph />}
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
            {childCount > 0 ? <CountBadge count={childCount} className="ml-1.5" /> : null}
          </button>
        )}
        {renaming ? null : (
          <EllipsisTriggerButton
            {...menu.triggerProps}
            tuck
            label={`Menu for folder ${folder.name}`}
          />
        )}
      </div>
      {menu.open ? (
        <FolderActionsMenu
          folder={folder}
          anchor={menu.triggerRef.current}
          onClose={menu.close}
          {...menuHandlers(getActions(menu.triggerRef.current))}
        />
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
        {count > 0 ? <CountBadge count={count} /> : null}
      </span>
    </button>
  );
}
