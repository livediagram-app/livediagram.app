'use client';

import type { DiagramListItem } from '@/lib/api-client';
import { DiagramRow } from './DiagramRow';
import { DiagramRowShell } from './DiagramRowShell';

// What a diagram row in the panel's tree can do, bundled because every
// node that lists diagrams (folders, the synthetic buckets, teams) passes
// the same set down, and each level of the recursion passes it on.
export type PanelRowActions = {
  // The VIEWER's owner id, for each row's authenticated thumbnail fetch.
  ownerId: string | null;
  currentDiagramId: string | null;
  // Ids mid slide-out (useExplorerRowDelete), so a deleted row plays out.
  exitingDiagramIds: Set<string>;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  // Each hands up the row's menu button as the anchor for the confirm
  // popover / move picker the panel opens beside it.
  onDeleteDiagram?: (id: string, anchor: HTMLElement | null) => void;
  onDuplicateDiagram?: (id: string) => void;
  onMoveDiagramRequest?: (id: string, anchor: HTMLElement | null) => void;
  // Drag-and-drop filing. Present = rows are drag sources and folder
  // headers drop targets; absent (Offline, the team trees) = neither.
  onMoveDiagramToFolder?: (diagramId: string, folderId: string | null) => void;
};

// One bucket's diagrams as tree rows, indented to sit under their node.
export function PanelDiagramRows({
  diagrams,
  indent,
  rows,
}: {
  diagrams: DiagramListItem[];
  indent: number;
  rows: PanelRowActions;
}) {
  const { onDeleteDiagram, onDuplicateDiagram, onMoveDiagramRequest } = rows;
  return (
    <>
      {diagrams.map((d) => (
        <DiagramRowShell key={d.id} exiting={rows.exitingDiagramIds.has(d.id)} indent={indent}>
          <DiagramRow
            item={d}
            ownerId={rows.ownerId}
            active={d.id === rows.currentDiagramId}
            draggable={!!rows.onMoveDiagramToFolder}
            onOpen={() => rows.onOpenDiagram(d.id)}
            onDelete={onDeleteDiagram ? (anchor) => onDeleteDiagram(d.id, anchor) : undefined}
            onDuplicate={onDuplicateDiagram ? () => onDuplicateDiagram(d.id) : undefined}
            onMoveRequest={
              onMoveDiagramRequest ? (anchor) => onMoveDiagramRequest(d.id, anchor) : undefined
            }
          />
        </DiagramRowShell>
      ))}
    </>
  );
}
