// `duplicate-label` (info): boxes sharing a label once trimmed, whitespace collapsed and lower-cased;
// blank never matches; one finding a label (LN14).

import type { BoxedElement } from '@livehuddle/document';
import { refOf } from '../context';
import { fixes } from '../fixes';
import { quoteLabel } from '@liveworkspace/diagram-lint/quote';
import type { Check } from './types';

const keyOf = (label: string) => label.trim().replace(/\s+/g, ' ').toLowerCase();

export const duplicateLabel: Check = (ctx) => {
  const groups = new Map<string, { label: string; boxes: BoxedElement[] }>();
  for (const box of ctx.boxes) {
    const label: unknown = Reflect.get(box, 'label');
    if (typeof label !== 'string' || label.trim() === '') continue;
    const key = keyOf(label);
    const group = groups.get(key) ?? { label, boxes: [] };
    group.boxes.push(box);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter(({ boxes }) => boxes.length > 1)
    .map(({ label, boxes }) => {
      const refs = boxes.map((box) => refOf(ctx, box.id));
      return {
        code: 'duplicate-label' as const,
        refs,
        message: `${refs.join(', ')} share ${quoteLabel(label)}`,
        fix: fixes.duplicateLabel(refs[1]!),
        at: { x: boxes[0]!.x, y: boxes[0]!.y },
      };
    });
};
