'use client';

import { DocumentIcon } from '@/components/primitives/explorer-icons';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { LocalOnlyPill, LOCAL_ONLY_DESCRIPTION } from '@/components/primitives/LocalOnlyPill';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { DocumentActionsMenu } from '@/app/explorer/document-row-shared';
import { FavouriteMarker } from '@/app/explorer/document-badges';
import { SidebarRow } from '@/app/explorer/sidebar/SidebarRow';
import type { PaneDocument } from '@/app/explorer/views';
import { isLocalOnly } from '@/lib/document-space';
import { DOCUMENT_DRAG_MIME } from '../explorer-drag-mime';
import { usePanelTree } from './PanelTreeContext';

// A document as a leaf row of the panel's tree
// (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel): activating it
// opens the document; it carries the one document menu (⋯, right-click, Shift+F10), its star
// and, saved only in this browser, the Local only pill. The open document's row is selected.
export function PanelDocumentItem({
  document: doc,
  depth,
  draggable = false,
}: {
  // `team` set: a team-library document, whose Change Folder opens the picker on that team.
  // `shared` set: a document shared with the reader, opened on its share link, with Dismiss.
  document: PaneDocument;
  depth: number;
  draggable?: boolean;
}) {
  const tree = usePanelTree();
  const menu = useRowMenu();
  const name = doc.name || 'Untitled document';
  const local = isLocalOnly(doc);
  const team = doc.team;
  const shareCode = doc.shared?.shareCode;
  const shared = shareCode !== undefined;
  const favourite = tree.favouriteIds?.has(doc.id) === true;
  const open = () => tree.onOpenDocument(doc.id, shareCode);
  return (
    <SidebarRow
      icon={<DocumentIcon />}
      label={
        <span className="flex min-w-0 items-center gap-1">
          {favourite ? <FavouriteMarker /> : null}
          <span className="min-w-0 truncate">{name}</span>
        </span>
      }
      textLabel={name}
      selected={doc.id === tree.currentDocumentId}
      onActivate={open}
      depth={depth}
      description={local ? LOCAL_ONLY_DESCRIPTION : undefined}
      className={
        tree.exitingDocumentIds.has(doc.id)
          ? 'animate-slide-row-out overflow-hidden'
          : 'animate-slide-row-in overflow-hidden'
      }
      rowProps={
        draggable
          ? {
              draggable: true,
              onDragStart: (e) => {
                e.dataTransfer.setData(DOCUMENT_DRAG_MIME, doc.id);
                e.dataTransfer.effectAllowed = 'move';
              },
            }
          : undefined
      }
      onContextMenu={menu.onContextMenu}
      trailing={
        <>
          {local ? <LocalOnlyPill tabbable={false} /> : null}
          <EllipsisTriggerButton
            {...menu.triggerProps}
            size="md"
            reveal
            tabIndex={-1}
            label={`Menu for ${name}`}
          />
          {menu.open ? (
            <DocumentActionsMenu
              document={doc}
              anchor={menu.triggerRef.current}
              ownerId={tree.ownerId}
              onClose={menu.close}
              isOpen={doc.id === tree.currentDocumentId}
              onOpen={open}
              onDismiss={
                shared && tree.onDismissShared ? () => tree.onDismissShared?.(doc.id) : undefined
              }
              onDuplicate={
                !shared && tree.onDuplicateDocument
                  ? () => tree.onDuplicateDocument?.(doc.id)
                  : undefined
              }
              onMove={
                shared
                  ? undefined
                  : team
                    ? tree.onMoveTeamDocumentRequest
                      ? () => tree.onMoveTeamDocumentRequest?.(doc.id, team.id)
                      : undefined
                    : tree.onMoveDocumentRequest
                      ? () => tree.onMoveDocumentRequest?.(doc.id)
                      : undefined
              }
              onDelete={
                !shared && tree.onDeleteDocument
                  ? () => tree.onDeleteDocument?.(doc.id, menu.triggerRef.current)
                  : undefined
              }
              favourite={shared ? undefined : favourite}
              onToggleFavourite={
                !shared && tree.onToggleFavourite
                  ? () => tree.onToggleFavourite?.(doc.id)
                  : undefined
              }
              recentExcluded={tree.recentExcludedIds?.includes(doc.id) === true}
              onToggleRecentExclusion={
                tree.onToggleRecentExclusion
                  ? () => tree.onToggleRecentExclusion?.(doc.id)
                  : undefined
              }
            />
          ) : null}
        </>
      }
    />
  );
}
