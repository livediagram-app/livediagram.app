'use client';

// Card view for the Explorer page (spec/67): the same folders + diagrams
// the ListView shows, as a responsive grid of cards with a large SVG
// snapshot. Takes the SAME props as ListView so ExplorerPane can swap the
// two on the view toggle without re-wiring callbacks. Badge + actions
// menu come from diagram-row-shared, so list and card can't drift.

import Link from 'next/link';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { useRef, useState } from 'react';
import { relativeSince, useRelativeTimeTick } from '@/lib/relative-time';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { DiagramThumbnail } from '@/components/panels/DiagramThumbnail';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { DynamicFolderIcon, OfflineFolderIcon, SparkleIcon, UnsortedIcon } from './icons';
import { DiagramActionsMenu, hrefForDiagram, VisibilityBadge } from './diagram-row-shared';
import { cardShell, FolderCard, previewArea, SyntheticFolderCard } from './explorer-folder-cards';
import type { Folder } from '@/lib/api-client';
import type { PaneDiagram } from './views';

type FolderActions = (
  f: Folder,
  anchor: HTMLElement | null,
) => { rename: () => void; newSubfolder: () => void; move: () => void; delete: () => void };

export function CardView({
  folders,
  diagrams,
  ownerId,
  showUnsortedRow,
  unsortedCount,
  onOpenUnsorted,
  showGeneratedRow = false,
  generatedCount = 0,
  onOpenGenerated,
  showOfflineRow = false,
  offlineCount = 0,
  onOpenOffline,
  showDynamicRow = false,
  dynamicCount = 0,
  onOpenDynamic,
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
  childrenCount,
  diagramsCount,
  showOwner = false,
  showVisibilityBadge = true,
}: {
  folders: Folder[];
  diagrams: PaneDiagram[];
  ownerId: string | null;
  showUnsortedRow: boolean;
  unsortedCount: number;
  onOpenUnsorted: () => void;
  showGeneratedRow?: boolean;
  generatedCount?: number;
  onOpenGenerated?: () => void;
  // The Offline synthetic folder card (spec/76), beside Generated on My Work.
  showOfflineRow?: boolean;
  offlineCount?: number;
  onOpenOffline?: () => void;
  // The "Dynamic" parent folder card on My Work (/all).
  showDynamicRow?: boolean;
  dynamicCount?: number;
  onOpenDynamic?: () => void;
  onOpenFolder: (id: string) => void;
  onCommitRenameFolder: (id: string, name: string) => void;
  onCancelRenameFolder: () => void;
  renamingFolderId: string | null;
  renamingDiagramId: string | null;
  onCommitRenameDiagram: (id: string, name: string) => void;
  onCancelRenameDiagram: () => void;
  folderActions: FolderActions;
  onStartRenameDiagram: (id: string) => void;
  onDuplicateDiagram: (id: string) => void;
  onDeleteDiagram: (id: string) => void;
  onMoveDiagram: (id: string, anchor: HTMLElement | null) => void;
  onDismissShared?: (id: string) => void;
  childrenCount: (id: string) => number;
  diagramsCount: (id: string) => number;
  showOwner?: boolean;
  // Team library cards (spec/35) hide the visibility badge: every diagram
  // in that grid is a team diagram, so a per-card "Team"/"Private" badge is
  // noise — its list view omits it too. Defaults on for the Explorer.
  showVisibilityBadge?: boolean;
}) {
  useRelativeTimeTick();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {showUnsortedRow ? (
        <SyntheticFolderCard
          icon={<UnsortedIcon />}
          label="Unsorted"
          count={unsortedCount}
          onOpen={onOpenUnsorted}
        />
      ) : null}
      {showGeneratedRow && onOpenGenerated ? (
        <SyntheticFolderCard
          icon={<SparkleIcon />}
          label="Generated"
          count={generatedCount}
          onOpen={onOpenGenerated}
        />
      ) : null}
      {showOfflineRow && onOpenOffline ? (
        <SyntheticFolderCard
          icon={<OfflineFolderIcon />}
          label="Offline"
          count={offlineCount}
          onOpen={onOpenOffline}
        />
      ) : null}
      {showDynamicRow && onOpenDynamic ? (
        <SyntheticFolderCard
          icon={<DynamicFolderIcon />}
          label="Dynamic"
          count={dynamicCount}
          onOpen={onOpenDynamic}
        />
      ) : null}
      {folders.map((f) => (
        <FolderCard
          key={f.id}
          folder={f}
          renaming={renamingFolderId === f.id}
          childCount={childrenCount(f.id) + diagramsCount(f.id)}
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
        />
      ))}
    </div>
  );
}

function DiagramCard({
  diagram,
  ownerId,
  showOwner,
  showVisibilityBadge,
  renaming,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onDelete,
  onMove,
  onDismiss,
}: {
  diagram: PaneDiagram;
  ownerId: string | null;
  showOwner: boolean;
  showVisibilityBadge: boolean;
  renaming: boolean;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (anchor: HTMLElement | null) => void;
  onDismiss?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const href = hrefForDiagram(diagram);
  const ownerLabel = showOwner
    ? (diagram.team?.name ??
      diagram.shared?.ownerName ??
      (diagram.shared ? 'Unknown owner' : 'You'))
    : null;

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
      {/* Larger snapshot. The whole preview links to the diagram unless
          we're renaming (then it's inert so the input keeps focus). */}
      {renaming ? (
        <span className={previewArea}>
          <DiagramThumbnail
            ownerId={ownerId}
            diagramId={diagram.id}
            version={diagram.savedAt}
            shareCode={diagram.shared?.shareCode}
            offline={diagram.ownerId === OFFLINE_OWNER_ID}
            className="h-full w-full"
          />
        </span>
      ) : (
        <Link href={href} className={previewArea} aria-label={`Open ${diagram.name}`}>
          <DiagramThumbnail
            ownerId={ownerId}
            diagramId={diagram.id}
            version={diagram.savedAt}
            shareCode={diagram.shared?.shareCode}
            offline={diagram.ownerId === OFFLINE_OWNER_ID}
            className="h-full w-full"
          />
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
            <EllipsisTriggerButton
              ref={menuRef}
              tuck
              label={`Menu for ${diagram.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
            />
          )}
        </div>
        {/* Keep every column the list shows: owner, visibility, updated. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showVisibilityBadge ? <VisibilityBadge diagram={diagram} /> : null}
          <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {relativeSince(diagram.savedAt)}
          </span>
        </div>
        {ownerLabel ? (
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">{ownerLabel}</span>
        ) : null}
      </div>
      {menuOpen ? (
        <DiagramActionsMenu
          diagram={diagram}
          anchor={menuRef.current}
          ownerId={ownerId}
          onClose={() => setMenuOpen(false)}
          onStartRename={onStartRename}
          onDuplicate={onDuplicate}
          onMove={onMove}
          onDelete={onDelete}
          onDismiss={onDismiss}
        />
      ) : null}
    </div>
  );
}
