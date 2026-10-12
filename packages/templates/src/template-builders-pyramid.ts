// The strategy pyramid template builder, split out of template-builders-diagrams
// (which re-exports it) once the titled, card-railed redesign outgrew a shared
// file. Pure: (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md
// "Templates".
import {
  createArrow,
  createShape,
  createText,
  runsPlainText,
  type Element,
  type TextRun,
} from '@livediagram/document';

const MUTED = '#64748b';
const INK = '#0f172a';

type Tier = {
  label: string;
  question: string;
  answer: string;
  icon: string;
  // Band fill (graded down the pyramid), the deep ink for the card's
  // question and border, and the pale tint the card sits on.
  fill: string;
  deep: string;
  tint: string;
};

// Tandem's strategy on a page, peak to base: why, where, how, what this year,
// what now. The hue walks violet to green so each tier is its own colour while
// the ramp still reads as one pyramid.
const TIERS: Tier[] = [
  {
    label: 'Purpose',
    question: 'Why do we exist?',
    answer: 'Help households share one list they trust',
    icon: 'heart',
    fill: '#a78bfa',
    deep: '#5b21b6',
    tint: '#f5f3ff',
  },
  {
    label: 'Vision',
    question: 'Where are we going?',
    answer: 'The list app every home opens daily, by 2028',
    icon: 'eye',
    fill: '#818cf8',
    deep: '#3730a3',
    tint: '#eef2ff',
  },
  {
    label: 'Strategy',
    question: 'How will we win?',
    answer: 'Free to start, a joy to share, works offline',
    icon: 'target',
    fill: '#60a5fa',
    deep: '#1d4ed8',
    tint: '#eff6ff',
  },
  {
    label: 'Goals',
    question: 'What will we hit this year?',
    answer: '50k weekly households, day-30 retention 60%',
    icon: 'trending-up',
    fill: '#5eead4',
    deep: '#0f766e',
    tint: '#f0fdfa',
  },
  {
    label: 'Initiatives',
    question: 'What are we doing now?',
    answer: 'Guided first list, offline sync, Android widget',
    icon: 'zap',
    fill: '#86efac',
    deep: '#15803d',
    tint: '#f0fdf4',
  },
];

// A true pyramid: one clean triangle banded into five tiers (Purpose at the
// peak down to Initiatives at the base). Each band is a triangle sharing the
// apex and the slope, drawn largest first, so every smaller one covers the
// top of the one behind it and what shows is exactly that tier's band; the
// slanted sides line up by construction. Each tier has its own hue (graded
// violet to green, light enough for dark ink, theme-locked), and a dotted
// leader runs from its slanted edge to a card on the right rail: the tier's
// glyph, its guiding question in the tier's deep ink and Tandem's worked
// answer. A bold title and a one-line how-to sit above, so the template
// teaches the model while it scaffolds a real strategy.
export function buildPyramid(cx: number, cy: number): Element[] {
  const baseW = 880;
  const tierH = 108;
  const H = TIERS.length * tierH;
  const railGap = 56;
  const cardW = 440;
  const cardH = 84;
  const headH = 96;
  const totalW = baseW + railGap + cardW;
  const left = cx - totalW / 2;
  // Apex x: the pyramid's own centre on the left of the composition.
  const px = left + baseW / 2;
  const top = cy - (H + headH) / 2 + headH;
  // Half-width of the triangle at a given y.
  const half = (y: number) => ((y - top) / H) * (baseW / 2);
  // The triangle silhouette spans 2..98% of its box on both axes, so a band
  // whose visible triangle is h tall and w wide needs a box 1/0.96 larger,
  // nudged up and left by the 2% inset.
  const inset = 0.96;
  const railX = left + baseW + railGap;

  const head: Element[] = [
    {
      ...createText(left, top - headH),
      width: totalW,
      height: 44,
      label: 'Tandem · strategy on a page',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top - headH + 44),
      width: totalW,
      height: 28,
      label:
        'Each tier answers the question beside it. Read down for why, up for how; every initiative should trace back to the purpose.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];

  const bands: Element[] = [];
  const labels: Element[] = [];
  TIERS.forEach((t, i) => {
    const y1 = top + (i + 1) * tierH;
    const visW = half(y1) * 2;
    const visH = y1 - top;
    const boxW = visW / inset;
    const boxH = visH / inset;
    bands.push({
      ...createShape('triangle', px - boxW / 2, top - boxH * 0.02),
      width: boxW,
      height: boxH,
      label: '',
      fillColor: t.fill,
      strokeColor: '#ffffff',
      // The ramp is the reading order (peak = most enduring), so it
      // survives a theme switch.
      themeLockFill: true,
    });

    // Tier names are overlay text (the funnel's convention): a shape's own
    // label centres on its box, which here is the whole triangle above the
    // band. The apex name sits in its lower, wider half.
    const y0 = y1 - tierH;
    const nameY = i === 0 ? y1 - 42 : (y0 + y1) / 2 - 18;
    labels.push({
      ...createText(px - 120, nameY),
      width: 240,
      height: 36,
      label: t.label,
      textSize: 'md',
      textBold: true,
      textAlignX: 'center',
      textColor: INK,
    });

    // Rail: a dotted leader from the band's slanted edge to the tier's card.
    const midY = (y0 + y1) / 2;
    labels.push({
      ...createArrow(px + half(midY) + 12, midY, railX - 10, midY),
      arrowEnds: 'none',
      strokeStyle: 'dotted',
      strokeColor: t.deep,
      routeBehind: false,
    });
    const runs: TextRun[] = [
      { text: t.question, bold: true, color: t.deep },
      { text: `\n${t.answer}`, size: 'sm', color: '#334155' },
    ];
    labels.push({
      ...createShape('square', railX, midY - cardH / 2),
      width: cardW,
      height: cardH,
      label: runsPlainText(runs),
      richText: runs,
      textSize: 'md',
      textAlignX: 'left',
      iconId: t.icon,
      fillColor: t.tint,
      strokeColor: t.deep,
      textColor: t.deep,
      themeLockFill: true,
    });
  });
  // Largest band first, so each smaller one paints over the top of it.
  return [...head, ...bands.reverse(), ...labels];
}
