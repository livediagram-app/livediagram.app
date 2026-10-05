// `arrow-dangling` (error): an arrow pinned to a missing element, or free at both ends. It takes part in
// nothing else (N3).

import { endpointPosition } from '@livediagram/document';
import { refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

export const arrowDangling: Check = (ctx) =>
  ctx.dangling.map((arrow) => {
    const ref = refOf(ctx, arrow.id);
    const free = arrow.from.kind === 'free' && arrow.to.kind === 'free';
    return {
      code: 'arrow-dangling' as const,
      refs: [ref],
      message: free ? `${ref} is free at both ends` : `${ref} points at a missing element`,
      fix: fixes.arrowDangling(ctx.source, ref),
      at: endpointPosition(arrow.from, ctx.index),
    };
  });
