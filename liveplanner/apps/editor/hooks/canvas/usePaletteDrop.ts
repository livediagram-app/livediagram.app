'use client';

// A file dropped on the canvas, lifted out of Canvas: converts the drop point to world-space canvas coords and
// dispatches onDropFile. Returns the onDragOver / onDrop handlers to spread onto the canvas <main>.

import type { DragEvent as ReactDragEvent, RefObject } from 'react';
import { pointerToCanvas } from '@/lib/canvas';
import { overFloatingPanel } from '@liveworkspace/workbench/lib/canvas-pointer';

type PaletteDropDeps = {
  viewportZoom: number;
  // The TRANSFORMED canvas wrapper (scale + translate applied), same as the
  // double-click add path: its rect already bakes in zoom, pan AND the
  // origin-center pivot, so dividing by zoom yields world coords directly.
  wrapperRef: RefObject<HTMLElement | null>;
  // A file dropped on the canvas, with the canvas point it was released at
  // (docs/specs/008-canvas/canvas-and-palette.md). Absent where the canvas takes no files.
  onDropFile?: (file: File, at: { x: number; y: number }) => void;
};

export function usePaletteDrop({ viewportZoom, wrapperRef, onDropFile }: PaletteDropDeps) {
  const onDragOver = (e: ReactDragEvent<HTMLElement>) => {
    // Something inside the canvas already took this drag (a folder in the Explorer panel taking a dragged
    // project, docs/specs/013-workspace/folders.md "Drag-and-drop"): it is that target's, so the guard below must
    // not turn its accepted drop into a no-drop and cancel it.
    if (e.defaultPrevented) return;
    // A drag back over a floating panel is a "changed my mind": show no-drop and don't let the drop below add
    // anything. The dragover events still bubble here from the panel, so check the target.
    if (overFloatingPanel(e.target)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    // A file is accepted, so the cursor says it will land rather than showing the no-drop sign.
    if (onDropFile && e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (e: ReactDragEvent<HTMLElement>) => {
    // Handled by a target inside the canvas (as above).
    if (e.defaultPrevented) return;
    // Dropped back onto a floating panel: cancel, so nothing lands behind it.
    if (overFloatingPanel(e.target)) return;
    const file = onDropFile ? e.dataTransfer.files?.[0] : undefined;
    if (!file) return;
    e.preventDefault();
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    onDropFile?.(file, pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom));
  };
  return { onDragOver, onDrop };
}
