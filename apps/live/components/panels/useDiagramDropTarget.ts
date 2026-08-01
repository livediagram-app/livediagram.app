'use client';

import { useState } from 'react';
import { DIAGRAM_DRAG_MIME } from './explorer-drag-mime';

// A folder row that accepts a diagram dragged onto it (spec/15): the
// hover-highlight flag plus the three drag handlers the row spreads onto its
// element.
//
// The sidebar tree has two node types that do this — a real folder and the
// synthetic Unsorted bucket — and they carried the same twenty lines twice.
// The copy even said so ("Same drop wiring as FolderNode but the move callback
// gets a null folderId"), which is the whole difference: `targetFolderId` is
// the folder's id, or null for Unsorted, where a diagram lands when it has no
// folder.
//
// Two details worth keeping in one place rather than remembering twice:
// dataTransfer.types is consulted on enter, so a stray text drag from another
// application never triggers our hover styling; and dropEffect is set to
// 'move' so the pointer shows a move cursor rather than the no-entry slash.
export function useDiagramDropTarget(
  targetFolderId: string | null,
  onMoveDiagramToFolder?: (diagramId: string, folderId: string | null) => void,
): {
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
} {
  const [isDragOver, setIsDragOver] = useState(false);

  const acceptsDrop = (e: React.DragEvent) =>
    !!onMoveDiagramToFolder && e.dataTransfer.types.includes(DIAGRAM_DRAG_MIME);

  return {
    isDragOver,
    onDragOver: (e) => {
      if (!acceptsDrop(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!isDragOver) setIsDragOver(true);
    },
    onDragLeave: () => {
      if (isDragOver) setIsDragOver(false);
    },
    onDrop: (e) => {
      if (!acceptsDrop(e)) return;
      e.preventDefault();
      const id = e.dataTransfer.getData(DIAGRAM_DRAG_MIME);
      setIsDragOver(false);
      if (id && onMoveDiagramToFolder) onMoveDiagramToFolder(id, targetFolderId);
    },
  };
}
