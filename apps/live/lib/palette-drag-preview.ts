'use client';

import { useSyncExternalStore } from 'react';
import type { ShapeKind } from '@livediagram/diagram';

// Shared, transient state for the palette drag-to-add ghost (spec/58). A
// palette tile publishes what it's dragging on `dragstart` so the canvas's
// PaletteDragGhost can preview it — `dataTransfer.getData()` is unreadable
// during `dragover` (browser security), so the source has to hand it over.
// Module-level because a drag is global, single-at-a-time, and transient; it
// would be awkward to thread through the editor's prop tree.

type PaletteDragPreview = {
  kind: ShapeKind;
  iconId?: string;
  // The shape's default footprint (canvas units); the ghost scales it by zoom.
  width: number;
  height: number;
};

let current: PaletteDragPreview | null = null;
const listeners = new Set<() => void>();

export function setPaletteDragPreview(next: PaletteDragPreview | null): void {
  current = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function usePaletteDragPreview(): PaletteDragPreview | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

// Replace the browser's default drag image (a snapshot of the dragged tile)
// with a 1×1 transparent pixel, so the only thing the user sees while dragging
// is the canvas ghost. A detached data-URI <img> works across engines.
let transparentImg: HTMLImageElement | null = null;
export function suppressNativeDragImage(e: { dataTransfer: DataTransfer | null }): void {
  if (!e.dataTransfer || typeof Image === 'undefined') return;
  if (!transparentImg) {
    transparentImg = new Image();
    transparentImg.src =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
  try {
    e.dataTransfer.setDragImage(transparentImg, 0, 0);
  } catch {
    // Non-DnD contexts / older engines: harmless to skip.
  }
}
