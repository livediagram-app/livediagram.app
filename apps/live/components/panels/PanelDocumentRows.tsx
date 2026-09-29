'use client';

import type { DocumentListItem } from '@/lib/api-client';
import { DocumentRow } from './DocumentRow';
import { DocumentRowShell } from './DocumentRowShell';

// What a document row in the panel's tree can do, bundled because every
// node that lists documents (folders, the synthetic buckets, teams) passes
// the same set down, and each level of the recursion passes it on.
export type PanelRowActions = {
  // The VIEWER's owner id, for each row's authenticated thumbnail fetch.
  ownerId: string | null;
  currentDocumentId: string | null;
  // Ids mid slide-out (useExplorerRowDelete), so a deleted row plays out.
  exitingDocumentIds: Set<string>;
  onOpenDocument: (id: string, shareCode?: string) => void;
  // Each hands up the row's menu button as the anchor for the confirm
  // popover / move picker the panel opens beside it.
  onDeleteDocument?: (id: string, anchor: HTMLElement | null) => void;
  onDuplicateDocument?: (id: string) => void;
  onMoveDocumentRequest?: (id: string, anchor: HTMLElement | null) => void;
  // Drag-and-drop filing. Present = rows are drag sources and folder
  // headers drop targets; absent (Offline, the team trees) = neither.
  onMoveDocumentToFolder?: (documentId: string, folderId: string | null) => void;
};

// One bucket's documents as tree rows, indented to sit under their node.
export function PanelDocumentRows({
  documents: liveDocs,
  indent,
  rows,
}: {
  documents: DocumentListItem[];
  indent: number;
  rows: PanelRowActions;
}) {
  const { onDeleteDocument, onDuplicateDocument, onMoveDocumentRequest } = rows;
  return (
    <>
      {liveDocs.map((d) => (
        <DocumentRowShell key={d.id} exiting={rows.exitingDocumentIds.has(d.id)} indent={indent}>
          <DocumentRow
            item={d}
            ownerId={rows.ownerId}
            active={d.id === rows.currentDocumentId}
            draggable={!!rows.onMoveDocumentToFolder}
            onOpen={() => rows.onOpenDocument(d.id)}
            onDelete={onDeleteDocument ? (anchor) => onDeleteDocument(d.id, anchor) : undefined}
            onDuplicate={onDuplicateDocument ? () => onDuplicateDocument(d.id) : undefined}
            onMoveRequest={
              onMoveDocumentRequest ? (anchor) => onMoveDocumentRequest(d.id, anchor) : undefined
            }
          />
        </DocumentRowShell>
      ))}
    </>
  );
}
