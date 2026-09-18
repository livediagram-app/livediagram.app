'use client';

import { useSyncExternalStore } from 'react';
import type { EsDockSide } from '@livediagram/diagram';

// Two transient facts about anchor docking (spec/139 Phase 7), published the
// way every other in-flight canvas preview is: module-level stores read with
// `useSyncExternalStore`. NEITHER touches the document — the drop and the
// click are the first things that write.
//
// They live together, like the insertion slot and its drag-in-hand flag, for
// the same reason: one feature, two transient facts, both global and
// single-at-a-time, and threading either through the editor's prop tree would
// be all cost and no meaning.

// ---------------------------------------------------------------------------
// The dock a drag is OFFERING: which host, which face, and the bounds the
// note would land in. The seam dots light in the guides' accent while it is
// live — the magnets saying "let go here".
// ---------------------------------------------------------------------------

export type DockCandidate = {
  hostId: string;
  side: EsDockSide;
  bounds: { x: number; y: number; width: number; height: number };
};

let candidate: DockCandidate | null = null;
const candidateListeners = new Set<() => void>();

function sameCandidate(a: DockCandidate | null, b: DockCandidate | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.hostId === b.hostId && a.side === b.side && a.bounds.x === b.bounds.x;
}

export function setDockCandidate(next: DockCandidate | null): void {
  if (sameCandidate(candidate, next)) return;
  candidate = next;
  for (const l of candidateListeners) l();
}

export function getDockCandidate(): DockCandidate | null {
  return candidate;
}

// Read and clear in one step, for the drop: a candidate left behind would
// re-dock the next drag.
export function takeDockCandidate(): DockCandidate | null {
  const held = candidate;
  setDockCandidate(null);
  return held;
}

export function useDockCandidate(): DockCandidate | null {
  return useSyncExternalStore(
    (l) => {
      candidateListeners.add(l);
      return () => {
        candidateListeners.delete(l);
      };
    },
    () => candidate,
    () => null,
  );
}

// ---------------------------------------------------------------------------
// The note the pointer is OVER, so a host can offer its free faces on hover as
// well as on selection. Published from the note itself (it already tracks
// enter / leave) rather than tracked canvas-wide: a pointer-move listener over
// the whole board, at pointer rate, to answer a question one element already
// knows the answer to would be the expensive way round.
// ---------------------------------------------------------------------------

let hoveredId: string | null = null;
const hoverListeners = new Set<() => void>();

export function setDockHoveredId(next: string | null): void {
  if (hoveredId === next) return;
  hoveredId = next;
  for (const l of hoverListeners) l();
}

// Clear only if this note is still the one being reported — a leave that
// arrives AFTER the next note's enter must not blank its neighbour.
export function clearDockHoveredId(id: string): void {
  if (hoveredId === id) setDockHoveredId(null);
}

export function useDockHoveredId(): string | null {
  return useSyncExternalStore(
    (l) => {
      hoverListeners.add(l);
      return () => {
        hoverListeners.delete(l);
      };
    },
    () => hoveredId,
    () => null,
  );
}
