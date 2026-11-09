// `node-isolated` (warning): a shape no arrow touches, on a tab that is otherwise a graph: at least two
// connected boxes, at least half of all boxes (LN11). An unlabelled shape is decoration (a key's sample, the card
// behind a block of text), never a node left out.

import type { ElementId } from '@livediagram/document';
import { createRingTest } from '@liveworkspace/diagram-lint/ring';
import { LINT_GRAPH_MIN_CONNECTED, LINT_GRAPH_MIN_SHARE } from '../constants';
import { refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

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
  // A box at the hub of a ring of connected boxes is a cycle's theme, by design (@liveworkspace/diagram-lint/ring).
  const ringed = createRingTest(ctx.boxes.filter((b) => connected.has(b.id)));
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
        fix: fixes.nodeIsolated(ctx.source, ref),
        at: { x: box.x, y: box.y },
      };
    });
};
