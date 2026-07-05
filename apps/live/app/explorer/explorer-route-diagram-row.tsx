'use client';

import Link from 'next/link';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { useRef, useState } from 'react';
import { relativeSince, useRelativeTimeTick } from '@/lib/relative-time';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import type { PaneDiagram } from './views';
import { DiagramThumbnail } from '@/components/panels/DiagramThumbnail';
import { DiagramActionsMenu, hrefForDiagram, VisibilityBadge } from './diagram-row-shared';

// One diagram row in the full-page /explorer list (open / rename / move /
// duplicate / delete + the drag source). Split out of views.tsx; rendered
// by FolderRow + the unsorted list there. The badge + actions menu come
// from diagram-row-shared so the card view (CardView) can't drift.
export function DiagramRow({
  diagram,
  ownerId,
  renaming,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onDelete,
  onMove,
  onDismiss,
  showOwner = false,
}: {
  diagram: PaneDiagram;
  // Viewer identity for the row's thumbnail fetch (spec/67). Null while a
  // guest id is still resolving; the thumbnail holds its placeholder.
  ownerId: string | null;
  renaming: boolean;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (anchor: HTMLElement | null) => void;
  // Shared-row menu action (spec/35): drop it from "Shared with me".
  onDismiss?: () => void;
  // Adds the desktop Owner cell ("You", the team name, or the sharer).
  showOwner?: boolean;
}) {
  useRelativeTimeTick();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const isSharedRow = !!diagram.shared;
  const href = hrefForDiagram(diagram);

  const titleNode = renaming ? (
    <InlineRenameInput
      initial={diagram.name}
      onCommit={onCommitRename}
      onCancel={onCancelRename}
      className="rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
    />
  ) : (
    <Link
      href={href}
      className="truncate text-sm font-medium text-slate-900 transition hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
    >
      {diagram.name}
    </Link>
  );

  return (
    <li
      className={
        'group grid grid-cols-[1fr_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-700 ' +
        (showOwner
          ? 'sm:grid-cols-[1fr_110px_90px_140px_40px]'
          : 'sm:grid-cols-[1fr_90px_140px_40px]')
      }
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
      <span className="flex min-w-0 items-center gap-2">
        <DiagramThumbnail
          ownerId={ownerId}
          diagramId={diagram.id}
          version={diagram.savedAt}
          shareCode={diagram.shared?.shareCode}
        />
        {titleNode}
      </span>
      {showOwner ? (
        <span className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
          {diagram.team?.name ??
            diagram.shared?.ownerName ??
            (isSharedRow ? 'Unknown owner' : 'You')}
        </span>
      ) : null}
      <span className="hidden sm:block">
        <VisibilityBadge diagram={diagram} />
      </span>
      <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {relativeSince(diagram.savedAt)}
      </span>
      {renaming ? (
        <span />
      ) : (
        <EllipsisTriggerButton
          ref={menuRef}
          label={`Menu for ${diagram.name}`}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
        />
      )}
      {menuOpen ? (
        <DiagramActionsMenu
          diagram={diagram}
          anchor={menuRef.current}
          onClose={() => setMenuOpen(false)}
          onStartRename={onStartRename}
          onDuplicate={onDuplicate}
          onMove={onMove}
          onDelete={onDelete}
          onDismiss={onDismiss}
        />
      ) : null}
    </li>
  );
}
