import {
  dockOf,
  dockedNotesOf,
  eventStormingKindOf,
  findDockCandidate,
  isBoxed,
  type Element,
  type ElementId,
} from '@livediagram/diagram';
import type { ShapeBounds } from '@/lib/canvas';
import type { DockCandidate } from '@/lib/dock-preview';
import type { InsertionGate } from '@/lib/insert-between';

// Magnetic docking during a drag (spec/139 Phase 7), and the one question the
// drag machine has to answer before it: is this gesture about a NOTE?
//
// Pure, for the same reason note-insertion-drag.ts is: the eligibility rules
// are a pile of conditions that belong in a testable answer rather than inside
// a pointer-move handler.

// Everything that travels when this element is dragged as a cluster: a host
// carries what is docked to it. A DOCKED note dragged on its own travels
// alone — pulling it is how you undock it.
export function dragClusterIds(elements: Element[], primaryId: ElementId): Set<ElementId> {
  const ids = new Set<ElementId>([primaryId]);
  for (const el of dockedNotesOf(primaryId, elements)) ids.add(el.id);
  return ids;
}

// Expand a drag set with everything docked to the hosts in it. A docked note
// that is ALREADY in the set (a multi-selection holding both halves) is not
// added twice, so it can never move twice.
export function withDockedNotes(elements: Element[], ids: Set<ElementId>): Set<ElementId> {
  let expanded: Set<ElementId> | null = null;
  for (const id of ids) {
    for (const el of dockedNotesOf(id, elements)) {
      if (ids.has(el.id)) continue;
      expanded ??= new Set(ids);
      expanded.add(el.id);
    }
  }
  return expanded ?? ids;
}

// Is this drag ONE workshop note — alone, or carrying the notes docked to it?
// The note grammar's gestures (insert between, lanes, docking) all ask this
// same question, so they all get the same answer: a multi-selection, a shape,
// an icon or an arrow drags exactly as it does on every other board.
export function isSingleNoteDrag(
  elements: Element[],
  primaryId: ElementId,
  startBounds: ReadonlyMap<string, ShapeBounds>,
): boolean {
  const primary = elements.find((el) => el.id === primaryId);
  if (!primary || primary.type !== 'sticky' || !isBoxed(primary)) return false;
  const cluster = dragClusterIds(elements, primaryId);
  if (startBounds.size !== cluster.size) return false;
  for (const id of startBounds.keys()) if (!cluster.has(id)) return false;
  return true;
}

type DockDragInput = {
  gate: InsertionGate;
  // Free placement (spec/60) and drag-duplicate (spec/80) both suppress
  // docking: one means "put it exactly here", the other already owns the
  // gesture.
  noSnap: boolean;
  shiftHeld: boolean;
  elements: Element[];
  primaryId: ElementId;
  startBounds: ReadonlyMap<string, ShapeBounds>;
  dx: number;
  dy: number;
  inertIds: ReadonlySet<ElementId>;
};

// The dock this drag is offering, or null. Rung 3 of the placement ladder: it
// sits below an open insertion slot and below free placement, and above the
// lanes and the alignment snap.
export function resolveNoteDock({
  gate,
  noSnap,
  shiftHeld,
  elements,
  primaryId,
  startBounds,
  dx,
  dy,
  inertIds,
}: DockDragInput): DockCandidate | null {
  if (!gate.esBoard || gate.readOnly || gate.tabLocked || gate.createBlocked) return null;
  if (noSnap || shiftHeld) return null;
  if (!isSingleNoteDrag(elements, primaryId, startBounds)) return null;
  const note = elements.find((el) => el.id === primaryId);
  const kind = note ? eventStormingKindOf(note) : null;
  const start = startBounds.get(primaryId);
  if (!kind || !start) return null;
  // A note that is HOSTING something cannot itself be docked: the cluster
  // would have two relations to carry and no single answer for where it goes.
  if (dockedNotesOf(primaryId, elements).length > 0) return null;
  return findDockCandidate(
    {
      x: start.x + dx,
      y: start.y + dy,
      width: start.width,
      height: start.height,
      kind,
      id: primaryId,
    },
    elements,
    { inertIds },
  );
}

// What the drop does with a note that WAS docked when the drag began: re-dock
// (possibly to a different face), or let it go. Dragging a docked note away is
// the whole gesture for undocking it, so "no candidate" means exactly that.
export function dockDropAction(
  elements: Element[],
  primaryId: ElementId,
  candidate: DockCandidate | null,
): { kind: 'dock'; hostId: ElementId; side: DockCandidate['side'] } | { kind: 'undock' } | null {
  const note = elements.find((el) => el.id === primaryId);
  const was = note ? dockOf(note) : null;
  if (candidate) {
    // Already exactly where it is: nothing to commit.
    if (was && was.hostId === candidate.hostId && was.side === candidate.side) return null;
    return { kind: 'dock', hostId: candidate.hostId, side: candidate.side };
  }
  return was ? { kind: 'undock' } : null;
}
