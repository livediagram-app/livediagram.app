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

let local: DragOverlay | null = null;
const peers = new Map<string, DragOverlay>();
let version = 0;
const merged = new Map<string, { version: number; overlay: DragOverlay | null }>();
const listeners = new Set<() => void>();

function changedNow(): void {
  version += 1;
  merged.clear();
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

export function clearLocalPreview(): void {
  if (local === null) return;
  local = null;
  changedNow();
}

export function localPreview(): DragOverlay | null {
  return local;
}

export function setPeerPreview(presenceId: string, overlay: DragOverlay): void {
  peers.set(presenceId, overlay);
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

// Every overlay for a tab, merged: peers in arrival order, then ours over them.
function mergedFor(tabId: string): DragOverlay | null {
  const hit = merged.get(tabId);
  if (hit && hit.version === version) return hit.overlay;
  const parts = [...peers.values(), ...(local ? [local] : [])].filter((o) => o.tabId === tabId);
  let overlay: DragOverlay | null = null;
  if (parts.length === 1) overlay = parts[0]!;
  else if (parts.length > 1) {
    const changed = new Map<string, Element>();
    const removed = new Set<string>();
    const added: { el: Element; after: string | null }[] = [];
    for (const p of parts) {
      for (const [id, el] of p.changed) changed.set(id, el);
      for (const id of p.removed) removed.add(id);
      added.push(...p.added);
    }
    overlay = { tabId, changed, removed, added };
  }
  merged.set(tabId, { version, overlay });
  return overlay;
}

// Called on every change to any preview (the drag hook writes one per frame).
export function subscribeDragPreview(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useDragPreview(tabId: string): DragOverlay | null {
  return useSyncExternalStore(
    subscribeDragPreview,
    () => mergedFor(tabId),
    () => null,
  );
}

export function resetDragPreviewForTests(): void {
  local = null;
  peers.clear();
  changedNow();
  listeners.clear();
}
