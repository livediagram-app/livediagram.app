// `node-isolated` (warning): a shape no arrow touches, on a tab that is otherwise a graph: at least two
// connected boxes, at least half of all boxes (LN11).

import type { ElementId } from '@livediagram/document';
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
  return ctx.boxes
    .filter((box) => box.type === 'shape' && !touched.has(box.id))
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
