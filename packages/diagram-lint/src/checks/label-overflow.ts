// `label-overflow` (warning): a box's label wraps to more lines than the box holds, measured as every
// headless render measures it (LN4 to LN7, N9 to N11).

import {
  drawsStandardLabel,
  estimatedLabelMeasure,
  fontSizeFor,
  LABEL_LINE_HEIGHT,
  labelRoom,
  wrapLabel,
} from '@livediagram/document';
import { refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

export const labelOverflow: Check = (ctx) =>
  ctx.boxes.flatMap((box) => {
    const label: unknown = Reflect.get(box, 'label');
    if (typeof label !== 'string' || label.trim() === '') return [];
    if (box.textSize === 'scale' || !drawsStandardLabel(box)) return [];
    const px = fontSizeFor(box.textSize, box.type === 'sticky');
    const room = labelRoom(box);
    const lines = wrapLabel(label, room.width, estimatedLabelMeasure(px), true).length;
    const holds = Math.max(1, Math.floor(room.height / (px * LABEL_LINE_HEIGHT)));
    if (lines <= holds) return [];
    const ref = refOf(ctx, box.id);
    const larger = box.textSize === 'md' || box.textSize === 'lg';
    return [
      {
        code: 'label-overflow' as const,
        refs: [ref],
        message: `${ref} needs ${lines} lines, holds ${holds}`,
        fix: fixes.labelOverflow(ctx.source, ref, larger),
        at: { x: box.x, y: box.y },
      },
    ];
  });
