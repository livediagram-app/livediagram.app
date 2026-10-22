// `duplicate-label` (info): boxes sharing a label once trimmed, whitespace collapsed and lower-cased;
// blank never matches; one finding a label (LN14). A card's title and subtitle are part of what it says, so two
// mirrored cards (an AZ A and an AZ B service with one body) differ.

import type { BoxedElement } from '@livedocuments/document';
import { refOf } from '../context';
import { fixes } from '../fixes';
import { quoteLabel } from '../quote';
import type { Check } from './types';

const keyOf = (label: string) => label.trim().replace(/\s+/g, ' ').toLowerCase();

export const duplicateLabel: Check = (ctx) => {
  const groups = new Map<string, { label: string; boxes: BoxedElement[] }>();
  for (const box of ctx.boxes) {
    const label: unknown = Reflect.get(box, 'label');
    if (typeof label !== 'string' || label.trim() === '') continue;
    const heads = ['pageTitle', 'pageSubtitle'].map((k): unknown => Reflect.get(box, k) ?? '');
    const key = [...heads, label].map((t) => keyOf(String(t))).join('\n');
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
