'use client';

// Card view for the Explorer page (docs/specs/006-document/document-snapshots.md): the same folders + documents
// the ListView shows, as a responsive grid of cards with a large SVG
// snapshot. Takes the SAME props as ListView so ExplorerPane can swap the
// two on the view toggle without re-wiring callbacks. Badge + actions
// menu come from document-row-shared, so list and card can't drift.

import Link from 'next/link';
import type { CardViewProps, DocumentEntryProps } from '@/app/explorer/explorer-view-props';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { DocumentEntryMenu, hrefForDocument, ownerLabelFor } from './document-row-shared';
import { FavouriteMarker, FolderChip, VisibilityBadge } from './document-badges';
import { DriveNoticeMarker } from '@/components/drive/DriveNoticeMarker';
import { DocumentSyncMark } from '@/components/drive/DocumentSyncMark';
import { SYNTHETIC_FOLDERS, visibleSyntheticFolders } from './synthetic-folders';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { FolderCard, SyntheticFolderCard } from './explorer-folder-cards';
import { CARD_GRID, CARD_PREVIEW as previewArea, CARD_SHELL as cardShell } from '@livediagram/ui';
import { FolderPreview } from './FolderPreview';
import { RelativeTimeChip } from '@/components/primitives/RelativeTimeChip';

export function CardView(props: CardViewProps) {
  const {
    folders,
    documents: liveDocs,
    ownerId,
    onOpenFolder,
    onCommitRenameFolder,
    onCancelRenameFolder,
    renamingFolderId,
    renamingDocumentId,
    onCommitRenameDocument,
    onCancelRenameDocument,
    folderActions,
    onStartRenameDocument,
    onDuplicateDocument,
    onDeleteDocument,
    onMoveDocument,
    onDismissShared,
    recentExcludedIds,
    favouriteIds,
    onToggleFavourite,
    folderChipFor,
    onToggleRecentExclusion,
    onShowHistory,
    childrenCount,
    documentsCount,
    folderContents,
    showOwner = false,
    showVisibilityBadge = true,
  } = props;
  return (
    <div className={`lvd-cascade ${CARD_GRID}`}>
      {visibleSyntheticFolders(props).map((e) => {
        const { Icon, label } = SYNTHETIC_FOLDERS[e.kind];
        return (
          <SyntheticFolderCard
            key={e.kind}
            icon={<Icon />}
            label={label}
            count={e.count}
            onOpen={e.onOpen}
          />
        );
      })}
      {folders.map((f) => (
        <FolderCard
          key={f.id}
          folder={f}
          renaming={renamingFolderId === f.id}
          childCount={childrenCount(f.id) + documentsCount(f.id)}
          preview={
            folderContents ? (
              <FolderPreview contents={folderContents(f.id)} ownerId={ownerId} />
            ) : null
          }
          onOpen={() => onOpenFolder(f.id)}
          onCommitRename={(name) => onCommitRenameFolder(f.id, name)}
          onCancelRename={onCancelRenameFolder}
          getActions={(anchor) => folderActions(f, anchor)}
        />
      ))}
      {liveDocs.map((d) => (
        <DocumentCard
          key={d.id}
          document={d}
          ownerId={ownerId}
          showOwner={showOwner}
          showVisibilityBadge={showVisibilityBadge}
          renaming={renamingDocumentId === d.id}
          onStartRename={() => onStartRenameDocument(d.id)}
          onCommitRename={(name) => onCommitRenameDocument(d.id, name)}
          onCancelRename={onCancelRenameDocument}
          onDuplicate={() => onDuplicateDocument(d.id)}
          onDelete={() => onDeleteDocument(d.id)}
          onMove={(anchor) => onMoveDocument(d.id, anchor)}
          onDismiss={d.shared && onDismissShared ? () => onDismissShared(d.id) : undefined}
          folderChip={folderChipFor?.(d) ?? null}
          favourite={favouriteIds?.has(d.id) === true}
          onToggleFavourite={onToggleFavourite ? () => onToggleFavourite(d.id) : undefined}
          recentExcluded={recentExcludedIds?.includes(d.id) === true}
          onShowHistory={onShowHistory ? () => onShowHistory(d.id) : undefined}
          onToggleRecentExclusion={
            onToggleRecentExclusion ? () => onToggleRecentExclusion(d.id) : undefined
          }
        />
      ))}
    </div>
  );
}

function DocumentCard(
  props: DocumentEntryProps & {
    // Card-only: the list view shows visibility in its own column.
    showVisibilityBadge: boolean;
  },
) {
  const {
    document: liveDoc,
    ownerId,
    showOwner,
    showVisibilityBadge,
    folderChip,
    renaming,
    onCommitRename,
    onCancelRename,
    favourite,
  } = props;
  const menu = useRowMenu({ disabled: renaming });
  const href = hrefForDocument(liveDoc);
  const ownerLabel = showOwner ? ownerLabelFor(liveDoc) : null;
  const thumbnail = (
    <DocumentThumbnail
      ownerId={ownerId}
      documentId={liveDoc.id}
      version={liveDoc.savedAt}
      shareCode={liveDoc.shared?.shareCode}
      offline={liveDoc.ownerId === OFFLINE_OWNER_ID}
      className="h-full w-full"
    />
  );

  return (
    <div className={cardShell} onContextMenu={menu.onContextMenu}>
      {/* Larger snapshot. The whole preview links to the document unless
          we're renaming (then it's inert so the input keeps focus). */}
      {renaming ? (
        <span className={previewArea}>{thumbnail}</span>
      ) : (
        <Link href={href} className={previewArea} aria-label={`Open ${liveDoc.name}`}>
          {thumbnail}
        </Link>
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="flex items-start gap-1">
          {renaming ? (
            <InlineRenameInput
              initial={liveDoc.name}
              onCommit={onCommitRename}
              onCancel={onCancelRename}
              className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
            />
          ) : (
            <Link
              href={href}
              className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 transition hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
            >
              {liveDoc.name}
            </Link>
          )}
          {renaming ? null : (
            <EllipsisTriggerButton {...menu.triggerProps} tuck label={`Menu for ${liveDoc.name}`} />
          )}
        </div>
        {/* Keep every column the list shows: owner, visibility, updated. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showVisibilityBadge ? <VisibilityBadge document={liveDoc} /> : null}
          {favourite ? <FavouriteMarker /> : null}
          <DriveNoticeMarker documentId={liveDoc.id} />
          {folderChip ? <FolderChip label={folderChip.label} onOpen={folderChip.onOpen} /> : null}
          <RelativeTimeChip at={liveDoc.savedAt} />
          <span className="ml-auto">
            <DocumentSyncMark documentId={liveDoc.id} savedAt={liveDoc.savedAt} />
          </span>
        </div>
        {ownerLabel ? (
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">{ownerLabel}</span>
        ) : null}
      </div>
      {menu.open ? (
        <DocumentEntryMenu entry={props} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </div>
  );
}
