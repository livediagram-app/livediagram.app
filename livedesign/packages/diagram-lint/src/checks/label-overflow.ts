// `label-overflow` (warning): a box's label wraps to more lines than the box holds, measured as every
// headless render measures it (LN4 to LN7, N9 to N11); or a card's title or subtitle is longer than its line holds, so
// the render cuts it with an ellipsis ("ElastiCa…"), counted as the render counts it (lineChars).

import {
  cardLayout,
  cardSlotsOf,
  drawsStandardLabel,
  lineChars,
  type ShapeElement,
  estimatedLabelMeasure,
  fontSizeFor,
  LABEL_LINE_HEIGHT,
  labelRoom,
  wrapLabel,
} from '@livedesign/document';
import { refOf } from '../context';
import { fixes } from '../fixes';
import type { Check } from './types';

// A card's title and subtitle the render would cut: each with the card width that holds it.
function cardCuts(card: ShapeElement): { line: 'title' | 'subtitle'; width: number }[] {
  const l = cardLayout(card.width, card.height, cardSlotsOf(card));
  return (
    [
      ['title', card.pageTitle, l.title, l.titlePx],
      ['subtitle', card.pageSubtitle, l.meta, l.metaPx],
    ] as const
  ).flatMap(([line, text, rect, px]) => {
    if (!text || !rect || text.length <= lineChars(rect.width, px)) return [];
    // The slot widens with the card, so the card grows by what the slot lacks.
    return [{ line, width: Math.ceil(card.width + text.length * px * 0.56 - rect.width) + 1 }];
  });
}

export const labelOverflow: Check = (ctx) =>
  ctx.boxes.flatMap((box) => {
    if (box.type === 'shape' && box.shape === 'card') {
      const cuts = cardCuts(box);
      if (cuts.length === 0) return [];
      const ref = refOf(ctx, box.id);
      const width = Math.max(...cuts.map((c) => c.width));
      return [
        {
          code: 'label-overflow' as const,
          refs: [ref],
          message: `${ref} ${cuts.map((c) => c.line).join(' and ')} cut short`,
          fix: fixes.cardTextCut(ctx.source, ref, width),
          at: { x: box.x, y: box.y },
        },
      ];
    }
    const label: unknown = Reflect.get(box, 'label');
    if (typeof label !== 'string' || label.trim() === '') return [];
    if (box.textSize === 'scale' || !drawsStandardLabel(box)) return [];
    const px = fontSizeFor(box.textSize, box.type === 'sticky');
    const room = labelRoom(box);
    const lines = wrapLabel(label, room.width, estimatedLabelMeasure(px), true).length;
    const holds = Math.max(1, Math.floor(room.height / (px * LABEL_LINE_HEIGHT)));
    if (lines <= holds) return [];
    const ref = refOf(ctx, box.id);
    // Bigger than Small (a preset or an exact px), so dropping to Small is a fix worth offering.
    const larger = px > fontSizeFor('sm', box.type === 'sticky');
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
