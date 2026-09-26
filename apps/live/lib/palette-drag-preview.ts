'use client';

import { useSyncExternalStore } from 'react';
import type { ShapeKind } from '@livediagram/diagram';

// Shared, transient state for the palette drag-to-add ghost (docs/specs/010-palette/palette-drag-ghost.md). A
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
  // This will land as a sticky NOTE, whatever the ghost draws. A note has no
  // shape kind of its own, so a note drag publishes a square footprint at the
  // note's real size; this says what it will actually become. Insert between
  // (docs/specs/021-event-storming/event-storming.md) is a gesture about the note grammar, so it reads this rather
  // than the drawing kind.
  note?: boolean;
  // The note is a WORKSHOP note (the tile has an event-storming kind), which
  // always lands on a lane (docs/specs/021-event-storming/event-storming.md "Always on a lane").
  workshop?: boolean;
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

// The live snap offset for the in-flight palette drag (docs/specs/021-event-storming/event-storming.md): canvas-unit
// dx/dy the dragged footprint has latched onto its neighbours. Published by
// the one owner that computes it (usePaletteDragGuides, which also produces
// the guide lines), read by the ghost (so it DRAWS snapped) and by the drop
// (so it LANDS snapped). Module-level for the same reason as the preview
// above: a drag is global, single-at-a-time and transient.
let snap: { dx: number; dy: number } | null = null;
const snapListeners = new Set<() => void>();

export function setPaletteDragSnap(next: { dx: number; dy: number } | null): void {
  if (snap?.dx === next?.dx && snap?.dy === next?.dy) return;
  snap = next;
  for (const l of snapListeners) l();
}

export function getPaletteDragSnap(): { dx: number; dy: number } | null {
  return snap;
}

function subscribeSnap(l: () => void): () => void {
  snapListeners.add(l);
  return () => {
    snapListeners.delete(l);
  };
}

export function usePaletteDragSnap(): { dx: number; dy: number } | null {
  return useSyncExternalStore(
    subscribeSnap,
    () => snap,
    () => null,
  );
}
