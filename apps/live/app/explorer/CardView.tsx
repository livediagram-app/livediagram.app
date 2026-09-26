'use client';

// Card view for the Explorer page (docs/specs/006-diagram/diagram-snapshots.md): the same folders + diagrams
// the ListView shows, as a responsive grid of cards with a large SVG
// snapshot. Takes the SAME props as ListView so ExplorerPane can swap the
// two on the view toggle without re-wiring callbacks. Badge + actions
// menu come from diagram-row-shared, so list and card can't drift.

import Link from 'next/link';
import type { CardViewProps, DiagramEntryProps } from '@/app/explorer/explorer-view-props';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { useRelativeTimeTick } from '@/lib/relative-time';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { DiagramThumbnail } from '@/components/panels/DiagramThumbnail';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { DiagramEntryMenu, hrefForDiagram, ownerLabelFor } from './diagram-row-shared';
import { FavouriteMarker, FolderChip, VisibilityBadge } from './diagram-badges';
import { SYNTHETIC_FOLDERS, visibleSyntheticFolders } from './synthetic-folders';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { FolderCard, SyntheticFolderCard } from './explorer-folder-cards';
import { CARD_GRID, CARD_PREVIEW as previewArea, CARD_SHELL as cardShell } from '@livediagram/ui';
import { FolderPreview } from './FolderPreview';
import { RelativeTimeChip } from '@/components/primitives/RelativeTimeChip';

export function CardView(props: CardViewProps) {
  const {
    folders,
    diagrams,
    ownerId,
    onOpenFolder,
    onCommitRenameFolder,
    onCancelRenameFolder,
    renamingFolderId,
    renamingDiagramId,
    onCommitRenameDiagram,
    onCancelRenameDiagram,
    folderActions,
    onStartRenameDiagram,
    onDuplicateDiagram,
    onDeleteDiagram,
    onMoveDiagram,
    onDismissShared,
    recentExcludedIds,
    favouriteIds,
    onToggleFavourite,
    folderChipFor,
    onToggleRecentExclusion,
    onShowHistory,
    childrenCount,
    diagramsCount,
    folderContents,
    showOwner = false,
    showVisibilityBadge = true,
  } = props;
  useRelativeTimeTick();
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
          childCount={childrenCount(f.id) + diagramsCount(f.id)}
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
      {diagrams.map((d) => (
        <DiagramCard
          key={d.id}
          diagram={d}
          ownerId={ownerId}
          showOwner={showOwner}
          showVisibilityBadge={showVisibilityBadge}
          renaming={renamingDiagramId === d.id}
          onStartRename={() => onStartRenameDiagram(d.id)}
          onCommitRename={(name) => onCommitRenameDiagram(d.id, name)}
          onCancelRename={onCancelRenameDiagram}
          onDuplicate={() => onDuplicateDiagram(d.id)}
          onDelete={() => onDeleteDiagram(d.id)}
          onMove={(anchor) => onMoveDiagram(d.id, anchor)}
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

function DiagramCard(
  props: DiagramEntryProps & {
    // Card-only: the list view shows visibility in its own column.
    showVisibilityBadge: boolean;
  },
) {
  const {
    diagram,
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
  const href = hrefForDiagram(diagram);
  const ownerLabel = showOwner ? ownerLabelFor(diagram) : null;
  const thumbnail = (
    <DiagramThumbnail
      ownerId={ownerId}
      diagramId={diagram.id}
      version={diagram.savedAt}
      shareCode={diagram.shared?.shareCode}
      offline={diagram.ownerId === OFFLINE_OWNER_ID}
      className="h-full w-full"
    />
  );

  return (
    <div className={cardShell} onContextMenu={menu.onContextMenu}>
      {/* Larger snapshot. The whole preview links to the diagram unless
          we're renaming (then it's inert so the input keeps focus). */}
      {renaming ? (
        <span className={previewArea}>{thumbnail}</span>
      ) : (
        <Link href={href} className={previewArea} aria-label={`Open ${diagram.name}`}>
          {thumbnail}
        </Link>
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="flex items-start gap-1">
          {renaming ? (
            <InlineRenameInput
              initial={diagram.name}
              onCommit={onCommitRename}
              onCancel={onCancelRename}
              className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
            />
          ) : (
            <Link
              href={href}
              className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 transition hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
            >
              {diagram.name}
            </Link>
          )}
          {renaming ? null : (
            <EllipsisTriggerButton {...menu.triggerProps} tuck label={`Menu for ${diagram.name}`} />
          )}
        </div>
        {/* Keep every column the list shows: owner, visibility, updated. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showVisibilityBadge ? <VisibilityBadge diagram={diagram} /> : null}
          {favourite ? <FavouriteMarker /> : null}
          {folderChip ? <FolderChip label={folderChip.label} onOpen={folderChip.onOpen} /> : null}
          <RelativeTimeChip at={diagram.savedAt} />
        </div>
        {ownerLabel ? (
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">{ownerLabel}</span>
        ) : null}
      </div>
      {menu.open ? (
        <DiagramEntryMenu entry={props} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </div>
  );
}
