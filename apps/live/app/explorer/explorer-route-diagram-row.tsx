'use client';

import Link from 'next/link';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { useRelativeTimeTick } from '@/lib/relative-time';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { DiagramThumbnail } from '@/components/panels/DiagramThumbnail';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import type { DiagramEntryProps } from '@/app/explorer/explorer-view-props';
import { DiagramEntryMenu, hrefForDiagram, ownerLabelFor } from './diagram-row-shared';
import { FavouriteMarker, FolderChip, VisibilityBadge } from './diagram-badges';
import { RelativeTimeChip } from '@/components/primitives/RelativeTimeChip';

// One diagram row in the full-page /explorer list (open / rename / move /
// duplicate / delete + the drag source). Split out of views.tsx; rendered
// by FolderRow + the unsorted list there. The badge + actions menu come
// from diagram-row-shared so the card view (CardView) can't drift. The
// team library (TeamSharedDiagrams) renders this same row.
export function DiagramRow(props: DiagramEntryProps) {
  const {
    diagram,
    ownerId,
    renaming,
    onCommitRename,
    onCancelRename,
    favourite,
    showOwner = false,
    folderChip,
    showVisibility = true,
  } = props;
  useRelativeTimeTick();
  const menu = useRowMenu({ disabled: renaming });
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
      onContextMenu={menu.onContextMenu}
    >
      <span className="flex min-w-0 items-center gap-2">
        <DiagramThumbnail
          ownerId={ownerId}
          diagramId={diagram.id}
          version={diagram.savedAt}
          shareCode={diagram.shared?.shareCode}
          offline={diagram.ownerId === OFFLINE_OWNER_ID}
        />
        {/* Before the name, so a column of rows shows its stars in one
            vertical line you can scan rather than at ragged name-end
            positions (spec/95). */}
        {favourite ? <FavouriteMarker /> : null}
        {titleNode}
        {folderChip ? (
          <span className="hidden shrink-0 sm:inline-flex">
            <FolderChip label={folderChip.label} onOpen={folderChip.onOpen} />
          </span>
        ) : null}
      </span>
      {showOwner ? (
        <span className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
          {ownerLabelFor(diagram)}
        </span>
      ) : null}
      <span className="hidden sm:block">
        {showVisibility ? <VisibilityBadge diagram={diagram} /> : null}
      </span>
      <RelativeTimeChip at={diagram.savedAt} />
      {renaming ? (
        <span />
      ) : (
        <EllipsisTriggerButton {...menu.triggerProps} label={`Menu for ${diagram.name}`} />
      )}
      {menu.open ? (
        <DiagramEntryMenu entry={props} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </li>
  );
}
