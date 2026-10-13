'use client';

import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { LocalOnlyPill, LOCAL_ONLY_DESCRIPTION } from '@/components/primitives/LocalOnlyPill';
import { MadeByAiPill, isMadeByAi } from '@/components/primitives/MadeByAiPill';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { DocumentActionsMenu } from '@/app/explorer/document-row-shared';
import { FavouriteMarker } from '@/app/explorer/document-badges';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';
import { PaneRow, PANE_THUMB_BOX } from '../explorer-panel/pane-parts';
import type { PaneDocument } from '@/app/explorer/views';
import { isLocalOnly } from '@/lib/document-space';
import { startDocumentDrag } from '../explorer-drag-mime';
import { usePanelTree } from './PanelTreeContext';

// A document row of the editor's Explorer pane (docs/specs/013-workspace/explorer-structure.md "The pane"): its
// thumbnail, name and last save; activating it opens the document; it carries the one document menu (⋯,
// right-click, Shift+F10), its star and, saved only in this browser, the Local only pill. The open document's row
// is the current one.
export function PanelDocumentItem({
  document: doc,
  draggable = false,
}: {
  // `team` set: a team-library document, whose Change Folder opens the picker on that team.
  // `shared` set: a document shared with the reader, opened on its share link, with Dismiss.
  document: PaneDocument;
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
  const now = useRelativeNow();
  const current = doc.id === tree.currentDocumentId;
  return (
    <PaneRow
      leading={
        <DocumentThumbnail
          ownerId={tree.ownerId}
          documentId={doc.id}
          version={doc.savedAt}
          empty={doc.empty}
          shareCode={shareCode ?? null}
          offline={doc.ownerId === OFFLINE_OWNER_ID}
          className={PANE_THUMB_BOX}
        />
      }
      title={
        <span className="flex min-w-0 items-center gap-1">
          {favourite ? <FavouriteMarker /> : null}
          <span className="min-w-0 truncate">{name}</span>
        </span>
      }
      label={local ? `${name}. ${LOCAL_ONLY_DESCRIPTION}` : name}
      meta={`Updated ${relativeSince(doc.savedAt, now)}`}
      current={current}
      onActivate={open}
      className={tree.exitingDocumentIds.has(doc.id) ? 'animate-slide-row-out overflow-hidden' : ''}
      rowProps={{
        onContextMenu: menu.onContextMenu,
        ...(draggable
          ? {
              draggable: true,
              onDragStart: (e: React.DragEvent) =>
                startDocumentDrag(e.dataTransfer, { id: doc.id, localOnly: local }),
            }
          : {}),
      }}
      trailing={
        <>
          {local ? <LocalOnlyPill tabbable={false} /> : null}
          {isMadeByAi(doc) ? <MadeByAiPill compact /> : null}
          <EllipsisTriggerButton
            {...menu.triggerProps}
            size="md"
            reveal
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
