// Now / Next / Later roadmap template. The strategic sibling of the
// date-driven Gantt (template-builders-gantt.ts): three tinted horizon
// lanes of initiative cards, each card carrying a theme chip, so the
// board communicates sequencing without committing to dates.
//
// The builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so the template is
// self-describing. See spec/09 "Templates" for the catalogue.

import { createShape, createText, type Element } from '@livediagram/diagram';

// Theme chips reuse the conventional tint pairs the retro / SWOT
// boards established (green / blue / amber), keyed by workstream so
// the same stream reads consistently across horizons. Chip tints are
// intrinsic (not theme-derived) the way the retro column tints are.
const CHIP_TINTS: Record<string, { fill: string; stroke: string; text: string }> = {
  Growth: { fill: '#dcfce7', stroke: '#86efac', text: '#15803d' },
  Platform: { fill: '#dbeafe', stroke: '#93c5fd', text: '#1d4ed8' },
  Quality: { fill: '#fef3c7', stroke: '#fcd34d', text: '#a16207' },
};

export function buildRoadmap(cx: number, cy: number): Element[] {
  const laneW = 470;
  const laneGap = 36;
  const lanePad = 24;
  const headerH = 46;
  const subtitleH = 30;
  const cardW = laneW - lanePad * 2;
  const cardH = 116;
  const cardGap = 20;
  const titleH = 56;
  const titleGap = 40;

  type Initiative = { label: string; chip: keyof typeof CHIP_TINTS };
  type Lane = {
    label: string;
    subtitle: string;
    fill: string;
    stroke: string;
    cards: Initiative[];
  };

  // Three horizons, each with believable product initiatives so the
  // board reads as a working roadmap rather than empty lanes. The lane
  // tints step from warm certainty to cool distance: what's shipping
  // now feels closest.
  const lanes: Lane[] = [
    {
      label: 'Now',
      subtitle: 'Shipping this cycle',
      fill: '#dcfce7',
      stroke: '#86efac',
      cards: [
        { label: 'Onboarding checklist for new workspaces', chip: 'Growth' },
        { label: 'Realtime cursors in shared diagrams', chip: 'Platform' },
        { label: 'Fix blurry image exports', chip: 'Quality' },
      ],
    },
    {
      label: 'Next',
      subtitle: 'Up next, roughly scoped',
      fill: '#dbeafe',
      stroke: '#93c5fd',
      cards: [
        { label: 'Team template gallery', chip: 'Growth' },
        { label: 'Comment notifications', chip: 'Platform' },
        { label: 'Accessibility audit + fixes', chip: 'Quality' },
      ],
    },
    {
      label: 'Later',
      subtitle: 'On the horizon',
      fill: '#e2e8f0',
      stroke: '#cbd5e1',
      cards: [
        { label: 'AI diagram assistant', chip: 'Growth' },
        { label: 'Offline editing + sync', chip: 'Platform' },
        { label: 'Public template marketplace', chip: 'Growth' },
      ],
    },
  ];

  const cardsPerLane = Math.max(...lanes.map((l) => l.cards.length));
  const laneH =
    lanePad +
    headerH +
    subtitleH +
    16 +
    cardsPerLane * cardH +
    (cardsPerLane - 1) * cardGap +
    lanePad;
  const totalW = lanes.length * laneW + (lanes.length - 1) * laneGap;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + titleGap + laneH) / 2;
  const lanesTop = y0 + titleH + titleGap;

  const elements: Element[] = [];

  elements.push({
    ...createText(x0, y0),
    width: totalW,
    height: titleH,
    label: 'Product roadmap · H2 2027',
    textSize: 'lg',
    textBold: true,
  });

  lanes.forEach((lane, i) => {
    const laneX = x0 + i * (laneW + laneGap);
    // Lane container first so header / cards layer above it.
    elements.push({
      ...createShape('square', laneX, lanesTop),
      width: laneW,
      height: laneH,
      fillColor: lane.fill,
      strokeColor: lane.stroke,
      textSize: 'md',
    });
    elements.push({
      ...createText(laneX + lanePad, lanesTop + lanePad),
      width: cardW,
      height: headerH,
      label: lane.label,
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    });
    elements.push({
      ...createText(laneX + lanePad, lanesTop + lanePad + headerH),
      width: cardW,
      height: subtitleH,
      label: lane.subtitle,
      textSize: 'sm',
      textAlignX: 'left',
      textColor: '#64748b',
    });

    const cardsTop = lanesTop + lanePad + headerH + subtitleH + 16;
    lane.cards.forEach((card, j) => {
      const cardY = cardsTop + j * (cardH + cardGap);
      const tint = CHIP_TINTS[card.chip]!;
      // Card body adopts the theme; the chip keeps its workstream tint.
      elements.push({
        ...createShape('square', laneX + lanePad, cardY),
        width: cardW,
        height: cardH,
        textSize: 'md',
      });
      elements.push({
        ...createText(laneX + lanePad + 14, cardY + 10),
        width: cardW - 28,
        height: 56,
        label: card.label,
        textSize: 'sm',
        textAlignX: 'left',
      });
      elements.push({
        ...createShape('stadium', laneX + lanePad + 14, cardY + cardH - 40),
        width: 118,
        height: 28,
        label: card.chip,
        textSize: 'sm',
        fillColor: tint.fill,
        strokeColor: tint.stroke,
        textColor: tint.text,
        themeLockFill: true,
      });
    });
  });

  return elements;
}
