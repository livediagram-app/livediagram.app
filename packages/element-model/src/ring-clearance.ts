// How far out a radial layout's ring must sit for its boxes to clear each other: the Auto Layout
// mindmap style (auto-layout-mindmap.ts, docs/specs/008-canvas/layout-cleanup.md "Layout styles") and
// a bubble mind map (mind-layout.ts, docs/specs/009-elements/mind-node.md). Both put each node at the
// middle of a wedge sized by leaf count, not at an even spread, so a ring sized only by its
// circumference packed a bushy branch's nodes on top of each other.

export type RingNode = { angle: number; w: number; h: number };

/**
 * The least radius at which no two of a ring's boxes, centred at their angles, overlap with `gap`
 * between them. Two boxes clear each other when either their x or their y centres are far enough
 * apart, and both grow with the radius, so each pair needs the smaller of the two radii. Sorted by
 * angle, each node looks ahead only while a pair that far round could still need more than the ring
 * already has (any pair `delta` apart is at least 2r sin(delta / 2) / sqrt 2 apart on one axis), so a
 * crowded ring costs about one look per neighbour, not one per pair.
 */
export function ringClearRadius(ring: readonly RingNode[], gap: number): number {
  if (ring.length < 2) return 0;
  const turn = 2 * Math.PI;
  const nodes = ring
    .map((n) => ({ a: ((n.angle % turn) + turn) % turn, w: n.w, h: n.h }))
    .sort((p, q) => p.a - q.a);
  let reach = 0;
  for (const n of nodes) reach = Math.max(reach, n.w, n.h);
  reach += gap;
  let r = 0;
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i]!;
    for (let k = 1; k < nodes.length; k++) {
      const q = nodes[(i + k) % nodes.length]!;
      const delta = (q.a - p.a + turn) % turn;
      if (delta > Math.PI) break;
      const chord = 2 * Math.sin(delta / 2);
      if (chord > 0 && (reach * Math.SQRT2) / chord <= r) break;
      const dx = Math.abs(Math.cos(p.a) - Math.cos(q.a));
      const dy = Math.abs(Math.sin(p.a) - Math.sin(q.a));
      const need = Math.min(
        dx > 0 ? ((p.w + q.w) / 2 + gap) / dx : Infinity,
        dy > 0 ? ((p.h + q.h) / 2 + gap) / dy : Infinity,
      );
      if (Number.isFinite(need)) r = Math.max(r, need);
    }
  }
  return r;
}
