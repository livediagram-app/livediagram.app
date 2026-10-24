// A Decision's steps sit beyond its corners (docs/specs/009-elements/flowchart.md "The layout"; blueprint
// flowchart.md "Layout", step 3).
//
// The layered layout places a Decision's targets wherever crossing reduction leaves them, and when two
// of them land inside the Decision's width both exits leave by the same point. On a chart without
// lanes there is room to fix that: the first target (left flowing down, top flowing right) moves out
// past the first corner and the last past the other, each with the steps only it leads to, so every
// exit leaves by its own corner and turns once.

import { SIBLING_GAP, type Pt } from './auto-layout-shared';
import type { FlowchartDirection } from './flowchart';
import type { ArrowElement, ElementId, ShapeElement } from './index';
import type { Rect } from '@liveworkspace/document-core/geometry-primitives';

/** Between a Decision's corner and its side step's centre, across the flow (blueprint D175). */
export const FLOWCHART_CORNER_CLEARANCE = 32;

/**
 * Shift `pos` (top-lefts of the laid-out steps, changed in place) so each Decision's first and last
 * targets lie beyond its corners. `arrows` are the forward connectors (loops already set apart).
 */
export function spreadDecisionExits(
  pos: Map<ElementId, Pt>,
  steps: readonly ShapeElement[],
  arrows: readonly ArrowElement[],
  dir: FlowchartDirection,
  referenceId: ElementId,
): void {
  const down = dir === 'down';
  const byId = new Map(steps.map((s) => [s.id, s]));
  const boxOf = (id: ElementId): Rect | undefined => {
    const p = pos.get(id);
    const s = byId.get(id);
    return p && s ? { x: p.x, y: p.y, width: s.width, height: s.height } : undefined;
  };
  const crossCentre = (b: Rect) => (down ? b.x + b.width / 2 : b.y + b.height / 2);
  const mainCentre = (b: Rect) => (down ? b.y + b.height / 2 : b.x + b.width / 2);
  const crossHalf = (b: Rect) => (down ? b.width / 2 : b.height / 2);

  const exits = new Map<ElementId, ElementId[]>();
  for (const a of arrows) {
    if (a.from.kind !== 'pinned' || a.to.kind !== 'pinned') continue;
    const from = a.from.elementId;
    const to = a.to.elementId;
    if (from === to || !pos.has(from) || !pos.has(to)) continue;
    const list = exits.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    exits.set(from, list);
  }
  const reach = (roots: readonly ElementId[]): Set<ElementId> => {
    const seen = new Set<ElementId>(roots);
    const stack = [...roots];
    while (stack.length > 0)
      for (const next of exits.get(stack.pop()!) ?? [])
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
    return seen;
  };

  // Earlier Decisions first, so a later one sees where its own steps were moved to.
  const decisions = steps
    .filter((s) => s.shape === 'diamond' && (exits.get(s.id)?.length ?? 0) >= 2)
    .map((s) => s.id)
    .sort((a, b) => {
      const ba = boxOf(a)!;
      const bb = boxOf(b)!;
      return mainCentre(ba) - mainCentre(bb) || crossCentre(ba) - crossCentre(bb);
    });

  for (const d of decisions) {
    const targets = exits.get(d)!;
    const ends = [...targets].sort((a, b) => crossCentre(boxOf(a)!) - crossCentre(boxOf(b)!));
    const first = ends[0]!;
    const last = ends[ends.length - 1]!;
    for (const [target, side] of [
      [first, -1],
      [last, 1],
    ] as const) {
      const box = boxOf(d)!;
      const corner = crossCentre(box) + side * crossHalf(box);
      const at = crossCentre(boxOf(target)!);
      const want = corner + side * FLOWCHART_CORNER_CLEARANCE;
      const shortfall = side < 0 ? Math.min(0, want - at) : Math.max(0, want - at);
      if (shortfall === 0) continue;
      // The target with the steps only it leads to: a step the Decision's other exits also reach
      // (a merge further on) stays where it is.
      const shared = reach(targets.filter((t) => t !== target));
      const moved = [...reach([target])].filter((id) => !shared.has(id) && id !== d);
      if (moved.includes(referenceId)) continue;
      const movedSet = new Set(moved);
      const shifted = (b: Rect): Rect =>
        down ? { ...b, x: b.x + shortfall } : { ...b, y: b.y + shortfall };
      const clash = moved.some((id) => {
        const b = shifted(boxOf(id)!);
        for (const [other] of pos) {
          if (movedSet.has(other)) continue;
          if (near(b, boxOf(other)!, SIBLING_GAP)) return true;
        }
        return false;
      });
      if (clash) continue;
      for (const id of moved) {
        const p = pos.get(id)!;
        pos.set(id, down ? { x: p.x + shortfall, y: p.y } : { x: p.x, y: p.y + shortfall });
      }
    }
  }
}

// Two boxes closer than `gap` on both axes (touching or overlapping included).
function near(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  );
}
