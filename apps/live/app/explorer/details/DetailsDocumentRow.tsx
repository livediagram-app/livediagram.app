'use client';

import Link from 'next/link';
import { useCallback, useRef } from 'react';
import { useRowPreview } from '@livediagram/ui';
import type { DocumentEntryProps } from '@/app/explorer/explorer-view-props';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { LocalOnlyPill } from '@/components/primitives/LocalOnlyPill';
import { MadeByAiPill, isMadeByAi } from '@/components/primitives/MadeByAiPill';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { isLocalOnly, readerAccessOf } from '@/lib/document-space';
import { DocumentEntryMenu, documentDragProps, hrefForDocument } from '../document-row-shared';
import { FavouriteMarker, FolderChip } from '../document-badges';
import type { PaneDocument } from '../views';
import {
  AccessCell,
  CommentsCell,
  DateCell,
  NOT_COUNTED,
  NoValue,
  SHOWN_FROM_CLASS,
  TypeCell,
  cellClass,
  useDenseRows,
} from './details-cells';
import { formatSize } from './details-format';
import { useSnapshotPrefetch } from './useSnapshotPrefetch';

// One document in the Details view (docs/specs/013-workspace/explorer-details-view.md): its columns,
// the preview on a resting hover over the row, the drag source, and the `⋯` menu shown on hover.
export function DetailsDocumentRow(props: DocumentEntryProps) {
  const {
    document: doc,
    ownerId,
    renaming,
    onCommitRename,
    onCancelRename,
    favourite,
    folderChip,
  } = props;
  const menu = useRowMenu({ disabled: renaming });
  const dense = useDenseRows();
  const CELL_CLASS = cellClass(dense);
  const rowRef = useRef<HTMLTableRowElement>(null);
  const local = isLocalOnly(doc);
  const href = hrefForDocument(doc);
  const shareCode = doc.shared?.shareCode ?? null;
  // Preloaded: the row asks for its snapshot as it nears the viewport, so the preview paints at once.
  useSnapshotPrefetch(
    rowRef,
    ownerId && !local && !doc.empty
      ? { ownerId, documentId: doc.id, version: doc.savedAt, shareCode }
      : null,
  );

  // The whole row is the preview's trigger (the spec's "resting the pointer on a document row");
  // only the name link's keyboard focus opens it, not the row's other controls.
  const preview = useRowPreview(<DocumentPreview doc={doc} ownerId={ownerId} />);
  const { rowRef: attachPreview } = preview;
  const attachRow = useCallback(
    (el: HTMLTableRowElement | null) => {
      rowRef.current = el;
      attachPreview(el);
    },
    [attachPreview],
  );

  const stats = doc.stats;
  return (
    <tr
      ref={attachRow}
      className="group transition hover:bg-slate-50 dark:hover:bg-slate-700/60"
      onContextMenu={menu.onContextMenu}
      {...(renaming ? {} : preview.rowProps)}
      {...documentDragProps(doc, renaming)}
    >
      <td className={`${CELL_CLASS} max-w-0`}>
        <span className="flex min-w-0 items-center gap-1.5">
          {favourite ? <FavouriteMarker /> : null}
          {renaming ? (
            <InlineRenameInput
              initial={doc.name}
              onCommit={onCommitRename}
              onCancel={onCancelRename}
              className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
            />
          ) : (
            <Link
              href={href}
              {...preview.focusProps}
              className="truncate text-sm font-medium text-slate-900 transition hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
            >
              {doc.name}
            </Link>
          )}
          {local ? <LocalOnlyPill /> : null}
          {isMadeByAi(doc) ? <MadeByAiPill /> : null}
          {folderChip ? (
            <span className="hidden shrink-0 sm:inline-flex">
              <FolderChip label={folderChip.label} onOpen={folderChip.onOpen} />
            </span>
          ) : null}
        </span>
      </td>
      <td className={`${CELL_CLASS} ${SHOWN_FROM_CLASS.sm} text-center`}>
        <TypeCell stats={stats} />
      </td>
      <td className={`${CELL_CLASS} ${SHOWN_FROM_CLASS.md} text-center`}>
        <CommentsCell stats={stats} dense={dense} />
      </td>
      <td className={`${CELL_CLASS} ${SHOWN_FROM_CLASS.md} text-center`}>
        <AccessCell level={readerAccessOf(doc)} />
      </td>
      <td
        className={`${CELL_CLASS} ${SHOWN_FROM_CLASS.sm} whitespace-nowrap text-right text-xs tabular-nums text-slate-600 dark:text-slate-300`}
      >
        {stats ? formatSize(stats) : <NoValue label={NOT_COUNTED} />}
      </td>
      <td className={`${CELL_CLASS} ${SHOWN_FROM_CLASS.md}`}>
        <DateCell at={doc.createdAt} />
      </td>
      <td className={CELL_CLASS}>
        <DateCell at={doc.savedAt} />
      </td>
      <td className={`${CELL_CLASS} text-right`}>
        {renaming ? null : (
          <EllipsisTriggerButton
            {...menu.triggerProps}
            reveal
            size={dense ? 'sm' : 'lg'}
            label={`Menu for ${doc.name}`}
          />
        )}
        {menu.open ? (
          <DocumentEntryMenu entry={props} anchor={menu.triggerRef.current} onClose={menu.close} />
        ) : null}
        {renaming ? null : preview.surface}
      </td>
    </tr>
  );
}

// The preview's picture: the snapshot at card size, its name beneath. The same thumbnail the card
// shows, read from the page's cache the row's prefetch filled.
function DocumentPreview({ doc, ownerId }: { doc: PaneDocument; ownerId: string | null }) {
  return (
    <span className="flex flex-col gap-1.5">
      <DocumentThumbnail
        ownerId={ownerId}
        documentId={doc.id}
        version={doc.savedAt}
        empty={doc.empty}
        shareCode={doc.shared?.shareCode}
        offline={isLocalOnly(doc)}
        className="block h-44 w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40"
      />
      <span className="truncate px-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
        {doc.name}
      </span>
    </span>
  );
}
