'use client';

import { ThisBrowserPill, THIS_BROWSER_DESCRIPTION } from '@/components/primitives/ThisBrowserPill';
import { MadeByAiPill, isMadeByAi } from '@/components/primitives/MadeByAiPill';
import { FavouriteMarker } from '@/app/explorer/document-badges';
import { useDocumentTags } from '@/components/tags/DocumentTagsProvider';
import { DocumentTagDots } from '@/components/tags/TagChip';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';
import { PaneRow, PANE_THUMB_BOX } from '../explorer-panel/pane-parts';
import type { PaneDocument } from '@/app/explorer/views';
import { isInThisBrowser } from '@/lib/document-space';
import { startDocumentDrag } from '../explorer-drag-mime';
import { usePanelTree } from './PanelTreeContext';
import { usePaneDocumentMenu } from './usePaneDocumentMenu';

// A document row of the editor's Explorer pane (docs/specs/013-workspace/explorer-structure.md "The pane"): its
// thumbnail, name and last save; activating it opens the document; it carries the one document menu (⋯,
// right-click, Shift+F10), its star and, saved only in this browser, the This Browser pill. The open document's row
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
  const menu = usePaneDocumentMenu(doc);
  const name = doc.name || 'Untitled document';
  const local = isInThisBrowser(doc);
  const shareCode = doc.shared?.shareCode;
  const favourite = tree.favouriteIds?.has(doc.id) === true;
  // The reader's tags as dots (docs/specs/013-workspace/tags.md "Where tags show"): the row is too narrow for chips.
  const tags = useDocumentTags().tagsFor(doc.id);
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
          <DocumentTagDots tags={tags} />
        </span>
      }
      label={local ? `${name}. ${THIS_BROWSER_DESCRIPTION}` : name}
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
          {local ? <ThisBrowserPill tabbable={false} /> : null}
          {isMadeByAi(doc) ? <MadeByAiPill compact /> : null}
          {menu.trailing}
        </>
      }
    />
  );
}
