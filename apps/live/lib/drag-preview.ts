'use client';

// The drag preview (docs/specs/008-canvas/drag-preview.md): what a move, resize or reshape would make
// of the elements it touches, drawn in place of them while the gesture lasts, without writing the
// document. One local preview (ours) and one per collaborator mid-drag, merged for drawing; the
// local one wins on an element both touch.

import { useSyncExternalStore } from 'react';
import type { Element } from '@livediagram/document';

export type DragOverlay = {
  tabId: string;
  changed: ReadonlyMap<string, Element>;
  removed: ReadonlySet<string>;
  added: readonly { el: Element; after: string | null }[];
};

// A collaborator's preview: the geometry patches they sent, resolved against the elements being drawn
// at read time, so the rest of each element is ours as it is now.
export type PeerPatch = { id: string } & Record<string, unknown>;

let local: DragOverlay | null = null;
const peers = new Map<string, { tabId: string; patches: readonly PeerPatch[] }>();
// One merged preview per tab and per element list a reader draws (Canvas and the element layer read
// different lists): a reader must get the same object back until something changes, or
// useSyncExternalStore re-renders it forever.
let merged = new Map<string, WeakMap<readonly Element[], DragOverlay | null>>();
const listeners = new Set<() => void>();

function changedNow(): void {
  merged = new Map();
  for (const fn of listeners) fn();
}

// The overlay that turns `doc` into `next`, by identity: one linear pass per tick.
export function overlayBetween(
  tabId: string,
  next: readonly Element[],
  doc: readonly Element[],
): DragOverlay {
  const before = new Map(doc.map((el) => [el.id, el] as const));
  const changed = new Map<string, Element>();
  const added: { el: Element; after: string | null }[] = [];
  const present = new Set<string>();
  next.forEach((el, i) => {
    present.add(el.id);
    const was = before.get(el.id);
    if (!was) added.push({ el, after: i > 0 ? next[i - 1]!.id : null });
    else if (was !== el) changed.set(el.id, el);
  });
  const removed = new Set(doc.filter((el) => !present.has(el.id)).map((el) => el.id));
  return { tabId, changed, removed, added };
}

export function setLocalPreview(
  tabId: string,
  next: readonly Element[],
  doc: readonly Element[],
): void {
  local = overlayBetween(tabId, next, doc);
  changedNow();
}

// How our last preview ended: written to the document (`landed`) or dropped (`cancelled`), for the
// end message collaborators get.
let lastEnding: 'landed' | 'cancelled' = 'cancelled';

export function clearLocalPreview(how: 'landed' | 'cancelled' = 'cancelled'): void {
  if (local === null) return;
  local = null;
  lastEnding = how;
  changedNow();
}

export function localPreviewEnding(): 'landed' | 'cancelled' {
  return lastEnding;
}

export function localPreview(): DragOverlay | null {
  return local;
}

export function setPeerPreview(
  presenceId: string,
  tabId: string,
  patches: readonly PeerPatch[],
): void {
  peers.set(presenceId, { tabId, patches });
  changedNow();
}

export function clearPeerPreview(presenceId: string): void {
  if (peers.delete(presenceId)) changedNow();
}

export function peerPreviewIds(): string[] {
  return [...peers.keys()];
}

// The elements with the overlay laid over them: changed elements replaced (only where they still
// exist), removed dropped, added inserted after their neighbour, or at the end when it is gone.
export function applyOverlay(elements: readonly Element[], overlay: DragOverlay): Element[] {
  const out: Element[] = [];
  const pending = new Map<string | null, Element[]>();
  for (const { el, after } of overlay.added)
    pending.set(after, [...(pending.get(after) ?? []), el]);
  const drain = (key: string | null) => {
    const queue = pending.get(key);
    if (!queue) return;
    pending.delete(key);
    for (const el of queue) {
      out.push(el);
      drain(el.id);
    }
  };
  drain(null);
  for (const el of elements) {
    if (overlay.removed.has(el.id)) continue;
    out.push(overlay.changed.get(el.id) ?? el);
    drain(el.id);
  }
  for (const key of [...pending.keys()]) drain(key);
  return out;
}

// Every preview for a tab, merged: collaborators' patches resolved against `elements` (ids it lacks are
// skipped), then ours over them.
function mergedFor(tabId: string, elements: readonly Element[]): DragOverlay | null {
  let forTab = merged.get(tabId);
  if (!forTab) {
    forTab = new WeakMap();
    merged.set(tabId, forTab);
  }
  if (forTab.has(elements)) return forTab.get(elements)!;
  const theirs = [...peers.values()].filter((p) => p.tabId === tabId && p.patches.length > 0);
  const ours = local && local.tabId === tabId ? local : null;
  let overlay: DragOverlay | null = ours;
  if (theirs.length > 0) {
    const byId = new Map(elements.map((el) => [el.id, el] as const));
    const changed = new Map<string, Element>();
    for (const p of theirs)
      for (const patch of p.patches) {
        const base = byId.get(patch.id);
        if (base) changed.set(patch.id, { ...base, ...patch } as Element);
      }
    if (ours) for (const [id, el] of ours.changed) changed.set(id, el);
    overlay =
      changed.size || ours
        ? { tabId, changed, removed: ours?.removed ?? new Set(), added: ours?.added ?? [] }
        : null;
  }
  forTab.set(elements, overlay);
  return overlay;
}

// Called on every change to any preview (the drag hook writes one per frame).
export function subscribeDragPreview(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// The tab's merged preview, for drawing `elements`; null when nobody is dragging there.
export function useDragPreview(tabId: string, elements: readonly Element[]): DragOverlay | null {
  return useSyncExternalStore(
    subscribeDragPreview,
    () => mergedFor(tabId, elements),
    () => null,
  );
}

export function resetDragPreviewForTests(): void {
  local = null;
  peers.clear();
  changedNow();
  listeners.clear();
}
