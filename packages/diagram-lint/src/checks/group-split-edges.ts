// `group-split-edges` (info): most of a frame's arrows cross its border. Of the drawable arrows with an end
// on a member, those with exactly one are crossing; it fires on more than half of at least three (LN12), and only
// when some arrow runs inside the frame: a frame none of whose arrows do is a role group (a services tier, a CI
// stage of parallel steps), split by design, and unwrapping it, as the fix said, made the drawing worse. Quiet too on
// a stage the flow passes through (a pipeline's stage): every arrow in from wholly before the frame, every arrow out
// to wholly after it, down the page or across it. Its crossings are the flow, not a split.

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
    if (
      total < LINT_GROUP_SPLIT_MIN_ARROWS ||
      crossing <= LINT_GROUP_SPLIT_SHARE * total ||
      crossing === total
    )
      return [];
    const crossings = ctx.drawable.filter((_, i) => ends[i] === 1);
    const into = (d: (typeof crossings)[number]) => !!d.to && members.has(d.to.id);
    // Flow both in and out: a frame whose arrows only leave it, to one side, is split, not passed through.
    const both = crossings.some(into) && crossings.some((d) => !into(d));
    const passesThrough = (down: boolean) =>
      both &&
      crossings.every((d) => {
        const inward = into(d);
        const other = inward ? d.from : d.to;
        if (!other) return false;
        const [lo, hi] = down
          ? [frame.y, frame.y + frame.height]
          : [frame.x, frame.x + frame.width];
        const [o0, o1] = down
          ? [other.y, other.y + other.height]
          : [other.x, other.x + other.width];
        return inward ? o1 <= lo : o0 >= hi;
      });
    if (passesThrough(true) || passesThrough(false)) return [];
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
