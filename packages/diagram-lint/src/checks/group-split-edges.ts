// `group-split-edges` (info): most of a frame's arrows cross its border. Of the drawable arrows with an end
// on a member, those with exactly one are crossing; it fires on more than half of at least three (LN12).

import { LINT_GROUP_SPLIT_MIN_ARROWS, LINT_GROUP_SPLIT_SHARE } from '../constants';
import { refOf } from '../context';
import { fixes } from '../fixes';
import { framesWithMembers } from '../groups';
import type { Check } from './types';

export const groupSplitEdges: Check = (ctx) =>
  framesWithMembers(ctx).flatMap(({ frame, members }) => {
    const ends = ctx.drawable.map(
      (d) => [d.from?.id, d.to?.id].filter((id) => id !== undefined && members.has(id)).length,
    );
    const total = ends.filter((n) => n > 0).length;
    const crossing = ends.filter((n) => n === 1).length;
    if (total < LINT_GROUP_SPLIT_MIN_ARROWS || crossing <= LINT_GROUP_SPLIT_SHARE * total)
      return [];
    const ref = refOf(ctx, frame.id);
    return [
      {
        code: 'group-split-edges' as const,
        refs: [ref],
        message: `${ref}: ${crossing} of ${total} arrows cross its border`,
        fix: fixes.groupSplitEdges(ctx.source, ref),
        at: { x: frame.x, y: frame.y },
      },
    ];
  });
