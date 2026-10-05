// `arrow-dangling` (error): an arrow pinned to a missing element. It takes part in nothing else (N3).
// A line with both ends free is a drawing, never reported.

import { endpointPosition } from '@livediagram/document';
import { refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

export const arrowDangling: Check = (ctx) =>
  ctx.dangling.map((arrow) => {
    const ref = refOf(ctx, arrow.id);
    return {
      code: 'arrow-dangling' as const,
      refs: [ref],
      message: `${ref} points at a missing element`,
      fix: fixes.arrowDangling(ctx.source, ref),
      at: endpointPosition(arrow.from, ctx.index),
    };
  });
