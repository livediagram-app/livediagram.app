// The incident postmortem's timeline (template-builders-postmortem.ts): five
// phase columns of timestamped cards, red through to green, and under them
// the time-to-detect / mitigate / resolve spans, each measured from the
// moment impact began. Split out of the builder so the report's root stays
// an orchestration of its sections.
//
// Pure: every call returns fresh elements.

import { createArrow, createShape, createText, type Element } from '@livediagram/document';
import { PM_PHASES, PM_SPANS } from './template-postmortem-data';
import { CONTENT, HEADING_GAP, SCAFFOLD, SECTION_H, sectionHeading } from './template-report-kit';

// Five phase columns of timestamped cards, then the three spans measured
// from the moment impact began, each ending under the card that closed it.
export function postmortemTimeline(
  x0: number,
  width: number,
  top: number,
  headH: number,
  cardH: number,
  cardGap: number,
  spanPitch: number,
): Element[] {
  const gap = 20;
  const colW = (width - gap * (PM_PHASES.length - 1)) / PM_PHASES.length;
  const colX = (i: number) => x0 + i * (colW + gap);
  const headTop = top + SECTION_H + HEADING_GAP;
  const cardsTop = headTop + headH;
  const pad = 16;
  const elements: Element[] = sectionHeading(
    x0,
    top,
    width,
    'clock',
    'Timeline',
    'Thu 14 Aug, all times BST. Impact ran from 18:05 to 19:26.',
  );

  PM_PHASES.forEach((phase, i) => {
    const x = colX(i);
    elements.push(
      {
        ...createShape('icon', x, headTop + 2),
        width: 26,
        height: 26,
        iconId: phase.icon,
        strokeColor: phase.hue.mid,
        ...SCAFFOLD,
      },
      {
        ...createText(x + 36, headTop - 2),
        width: colW - 36,
        height: 32,
        label: phase.name,
        textSize: 'md',
        textBold: true,
        textColor: phase.hue.mid,
        textAlignX: 'left',
        ...SCAFFOLD,
      },
      {
        ...createShape('square', x, headTop + 38),
        width: colW,
        height: 6,
        fillColor: phase.hue.deep,
        strokeColor: phase.hue.deep,
        borderRadius: 'full',
        themeLockFill: true,
        ...SCAFFOLD,
      },
    );
    phase.events.forEach((event, j) => {
      const y = cardsTop + j * (cardH + cardGap);
      elements.push(
        {
          ...createShape('square', x, y),
          width: colW,
          height: cardH,
          fillColor: phase.hue.soft,
          strokeColor: phase.hue.line,
          borderRadius: 'md',
          themeLockFill: true,
          ...CONTENT,
        },
        {
          ...createText(x + pad, y + 10),
          width: colW - pad * 2,
          height: 26,
          label: event.time,
          textSize: 'sm',
          textBold: true,
          textColor: phase.hue.deep,
          textAlignX: 'left',
          ...CONTENT,
        },
        {
          ...createText(x + pad, y + 38),
          width: colW - pad * 2,
          height: cardH - 38 - 10,
          label: event.text,
          textSize: 'sm',
          textColor: phase.hue.ink,
          textAlignX: 'left',
          textAlignY: 'top',
          ...CONTENT,
        },
      );
    });
  });

  // The spans: dimension lines from the 18:05 card's timestamp to the
  // timestamp of the card that ended each span, stepped so they nest.
  const cardsBottom = cardsTop + 2 * cardH + cardGap;
  const firstSpan = cardsBottom + 36;
  const startX = colX(0) + pad;
  const impact = PM_PHASES[0]!.hue.mid;
  elements.push({
    ...createArrow(startX, cardsBottom, startX, firstSpan + 2 * spanPitch + 12),
    arrowEnds: 'none',
    strokeColor: impact,
    strokeStyle: 'dashed',
    strokeWidth: 2,
    ...CONTENT,
  });
  PM_SPANS.forEach((span, k) => {
    const y = firstSpan + k * spanPitch;
    const endX = colX(span.to) + pad;
    const color = PM_PHASES[span.to]!.hue.mid;
    elements.push(
      {
        ...createArrow(startX, y, endX, y),
        arrowEnds: 'both',
        arrowheadShape: 'line',
        strokeColor: color,
        strokeWidth: 2,
        label: span.label,
        textSize: 'md',
        textBold: true,
        textColor: color,
        ...CONTENT,
      },
      {
        ...createArrow(endX, y - 12, endX, y + 12),
        arrowEnds: 'none',
        strokeColor: color,
        strokeWidth: 2,
        ...CONTENT,
      },
    );
  });
  return elements;
}
