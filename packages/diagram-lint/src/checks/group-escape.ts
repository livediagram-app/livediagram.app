// `group-escape` (warning): a box reaches past its frame by more than LINT_CONTAIN_TOLERANCE_PX on a side,
// measured on its bounds as drawn (LN13).

import { boxBounds } from '../boxes';
import { LINT_CONTAIN_TOLERANCE_PX } from '../constants';
import { refOf } from '../context';
import { fixes } from '../fixes';
import { frameOf } from '../groups';
import type { Check } from './types';

export const groupEscape: Check = (ctx) =>
  ctx.boxes.flatMap((box) => {
    const frame = frameOf(ctx, box);
    if (!frame) return [];
    const b = boxBounds(box);
    const t = LINT_CONTAIN_TOLERANCE_PX;
    const out =
      b.x < frame.x - t ||
      b.y < frame.y - t ||
      b.x + b.width > frame.x + frame.width + t ||
      b.y + b.height > frame.y + frame.height + t;
    if (!out) return [];
    const [ref, frameRef] = [refOf(ctx, box.id), refOf(ctx, frame.id)];
    return [
      {
        code: 'group-escape' as const,
        refs: [ref, frameRef],
        message: `${ref} sticks out of ${frameRef}`,
        fix: fixes.groupEscape(ctx.source, ref, frameRef),
        at: { x: box.x, y: box.y },
      },
    ];
  });
