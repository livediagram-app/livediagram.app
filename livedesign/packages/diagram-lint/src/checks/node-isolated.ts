// `node-isolated` (warning): a shape no arrow touches, on a tab that is otherwise a graph: at least two
// connected boxes, at least half of all boxes (LN11). An unlabelled shape is decoration (a key's sample, the card
// behind a block of text), never a node left out.

import type { BoxedElement, ElementId } from '@livedesign/document';
import { LINT_GRAPH_MIN_CONNECTED, LINT_GRAPH_MIN_SHARE, LINT_RING_SPREAD } from '../constants';
import { refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

// Whether a box is the hub of a ring: three or more connected boxes around its centre, every one within
// LINT_RING_SPREAD of their mean distance from it (a cycle's theme at its centre, by design).
function connectedRing(connected: readonly BoxedElement[]): (box: BoxedElement) => boolean {
  return (box) => {
    if (connected.length < 3) return false;
    const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const d = connected.map((b) => Math.hypot(b.x + b.width / 2 - c.x, b.y + b.height / 2 - c.y));
    const mean = d.reduce((s, x) => s + x, 0) / d.length;
    if (mean <= 0 || d.some((x) => Math.abs(x - mean) > mean * LINT_RING_SPREAD)) return false;
    const around = (sx: number, sy: number) =>
      connected.some((b) => (b.x + b.width / 2 - c.x) * sx + (b.y + b.height / 2 - c.y) * sy > 0);
    return around(1, 0) && around(-1, 0) && around(0, 1) && around(0, -1);
  };
}

export const nodeIsolated: Check = (ctx) => {
  const connected = new Set<ElementId>(ctx.connecting.flatMap((d) => [d.from!.id, d.to!.id]));
  if (
    connected.size < LINT_GRAPH_MIN_CONNECTED ||
    connected.size < LINT_GRAPH_MIN_SHARE * ctx.boxes.length
  )
    return [];
  const touched = new Set<ElementId>(
    ctx.drawable.flatMap((d) =>
      [d.from?.id, d.to?.id].filter((id): id is ElementId => id !== undefined),
    ),
  );
  const ringed = connectedRing(ctx.boxes.filter((b) => connected.has(b.id)));
  return ctx.boxes
    .filter(
      (box) => box.type === 'shape' && !touched.has(box.id) && (box.label ?? '').trim() !== '',
    )
    .filter((box) => !ringed(box))
    .map((box) => {
      const ref = refOf(ctx, box.id);
      return {
        code: 'node-isolated' as const,
        refs: [ref],
        message: `${ref} has no arrows`,
        fix: fixes.nodeIsolated(ref),
        at: { x: box.x, y: box.y },
      };
    });
};
