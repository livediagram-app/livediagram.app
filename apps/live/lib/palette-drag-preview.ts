'use client';

import { useSyncExternalStore } from 'react';
import type { ShapeKind } from '@livediagram/diagram';
import type { InsertionSlot } from '@/lib/insert-between';

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

// The live snap offset for the in-flight palette drag (spec/139): canvas-unit
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

// The insertion slot the in-flight drag is offering on an event-storming
// board (spec/139): the gap it would open, and which elements slide right to
// open it. THIS CHANNEL NEVER TOUCHES THE DOCUMENT — the canvas renders the
// ripple as a CSS transform and the drop is the first thing that writes, so a
// hover can't reach the undo stack, autosave, or a peer's screen.
//
// Same module-level store as the two channels above, and for the same reason.
// The drag owns it: whoever computes it publishes, and the drop consumes it
// with `takeInsertionSlot`.
let insertion: InsertionSlot | null = null;
const insertionListeners = new Set<() => void>();

// Cheap value equality so a dragover that re-resolves the same slot doesn't
// re-render every element view at pointer rate.
function sameSlot(a: InsertionSlot | null, b: InsertionSlot | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.atX === b.atX &&
    a.atY === b.atY &&
    a.shiftDx === b.shiftDx &&
    a.rightId === b.rightId &&
    a.shiftedIds.length === b.shiftedIds.length &&
    a.shiftedIds.every((id, i) => id === b.shiftedIds[i])
  );
}

export function setInsertionSlot(next: InsertionSlot | null): void {
  if (sameSlot(insertion, next)) return;
  insertion = next;
  for (const l of insertionListeners) l();
}

export function getInsertionSlot(): InsertionSlot | null {
  return insertion;
}

// Read and clear in one step, for the drop: the slot has done its job the
// moment it is committed, and a slot left behind would ripple the next drag.
export function takeInsertionSlot(): InsertionSlot | null {
  const slot = insertion;
  setInsertionSlot(null);
  return slot;
}

function subscribeInsertion(l: () => void): () => void {
  insertionListeners.add(l);
  return () => {
    insertionListeners.delete(l);
  };
}

export function useInsertionSlot(): InsertionSlot | null {
  return useSyncExternalStore(
    subscribeInsertion,
    () => insertion,
    () => null,
  );
}
