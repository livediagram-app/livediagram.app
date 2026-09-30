// The incident postmortem's five whys (template-builders-postmortem.ts): five
// numbered question-and-answer cards chained down to the systemic root
// cause. Split out of the builder so the report's root stays an
// orchestration of its sections.
//
// Pure: every call returns fresh elements.

import { createPinnedArrow, createShape, createText, type Element } from '@livediagram/document';
import { PM_ROOT_CAUSE, PM_WHYS } from './template-postmortem-data';
import {
  CONTENT,
  HEADING_GAP,
  INK,
  INK_SOFT,
  PAPER,
  RULE,
  SECTION_H,
  sectionHeading,
} from './template-report-kit';

// Five whys, each a numbered card of question and answer, chained down to
// the systemic root cause. The gaps stretch so the chain ends level with
// the action items beside it.
export function postmortemFiveWhys(x0: number, top: number, w: number, h: number): Element[] {
  const elements: Element[] = sectionHeading(
    x0,
    top,
    w,
    'search',
    'Five whys',
    'Ask why until the answer is the system',
  );
  const whyH = 84;
  const rootH = 140;
  const bodyTop = top + SECTION_H + HEADING_GAP;
  const bodyH = h - SECTION_H - HEADING_GAP;
  const gap = (bodyH - rootH - PM_WHYS.length * whyH) / PM_WHYS.length;
  const disc = 36;
  const textX = x0 + 16 + disc + 16;
  const textW = w - (textX - x0) - 16;
  const cards: string[] = [];
  PM_WHYS.forEach((why, i) => {
    const y = bodyTop + i * (whyH + gap);
    const card = {
      ...createShape('square', x0, y),
      width: w,
      height: whyH,
      fillColor: PAPER,
      strokeColor: RULE,
      borderRadius: 'md' as const,
      ...CONTENT,
    };
    cards.push(card.id);
    elements.push(
      card,
      {
        ...createShape('circle', x0 + 16, y + (whyH - disc) / 2),
        width: disc,
        height: disc,
        label: String(i + 1),
        textSize: 'sm',
        textBold: true,
        fillColor: '#f1f5f9',
        strokeColor: '#94a3b8',
        textColor: INK,
        themeLockFill: true,
        ...CONTENT,
      },
      {
        ...createText(textX, y + 10),
        width: textW,
        height: 26,
        label: why.q,
        textSize: 'sm',
        textBold: true,
        textColor: INK,
        textAlignX: 'left',
        ...CONTENT,
      },
      {
        ...createText(textX, y + 36),
        width: textW,
        height: whyH - 36 - 8,
        label: why.a,
        textSize: 'sm',
        textColor: INK_SOFT,
        textAlignX: 'left',
        textAlignY: 'top',
        ...CONTENT,
      },
    );
  });

  const rootTop = bodyTop + bodyH - rootH;
  const root = {
    ...createShape('square', x0, rootTop),
    width: w,
    height: rootH,
    fillColor: '#fff1f2',
    strokeColor: '#e11d48',
    strokeWidth: 'thick' as const,
    borderRadius: 'md' as const,
    themeLockFill: true,
    ...CONTENT,
  };
  cards.push(root.id);
  elements.push(
    root,
    {
      ...createShape('icon', x0 + 20, rootTop + 20),
      width: 30,
      height: 30,
      iconId: 'target',
      strokeColor: '#be123c',
      ...CONTENT,
    },
    {
      ...createText(x0 + 62, rootTop + 16),
      width: w - 82,
      height: 38,
      label: PM_ROOT_CAUSE.title,
      textSize: 'md',
      textBold: true,
      textColor: '#9f1239',
      textAlignX: 'left',
      ...CONTENT,
    },
    {
      ...createText(x0 + 20, rootTop + 62),
      width: w - 40,
      height: rootH - 62 - 14,
      label: PM_ROOT_CAUSE.text,
      textSize: 'sm',
      textColor: '#4c0519',
      textAlignX: 'left',
      textAlignY: 'top',
      ...CONTENT,
    },
  );
  for (let i = 0; i < cards.length - 1; i++) {
    elements.push({
      ...createPinnedArrow(cards[i]!, 's', cards[i + 1]!, 'n'),
      strokeColor: '#94a3b8',
      strokeWidth: 2,
      ...CONTENT,
    });
  }
  return elements;
}
