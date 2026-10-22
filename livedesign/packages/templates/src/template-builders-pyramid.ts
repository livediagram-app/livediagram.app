// The strategy pyramid template builder, split out of template-builders-diagrams
// (which re-exports it) once the titled, card-railed redesign outgrew a shared
// file. Pure: (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md
// "Templates".
import {
  conceptRamp,
  createArrow,
  createShape,
  createText,
  pyramidLayout,
  type Element,
} from '@livepages/document';

const MUTED = '#64748b';
// The pyramid's ramp: deep violet at the peak toward a pale wash at the base.
const ACCENT = '#6d28d9';
const PALE = '#ecfdf5';

type Tier = {
  label: string;
  question: string;
  answer: string;
  icon: string;
  // The deep ink for the card's border and the pale tint it sits on.
  deep: string;
  tint: string;
};

// Tandem's strategy on a page, peak to base: why, where, how, what this year,
// what now. Each tier's card wears its own hue, violet to green, beside the pyramid's ramp.
const TIERS: Tier[] = [
  {
    label: 'Purpose',
    question: 'Why do we exist?',
    answer: 'Help households share one list they trust',
    icon: 'heart',
    deep: '#5b21b6',
    tint: '#f5f3ff',
  },
  {
    label: 'Vision',
    question: 'Where are we going?',
    answer: 'The list app every home opens daily, by 2028',
    icon: 'eye',
    deep: '#3730a3',
    tint: '#eef2ff',
  },
  {
    label: 'Strategy',
    question: 'How will we win?',
    answer: 'Free to start, a joy to share, works offline',
    icon: 'target',
    deep: '#1d4ed8',
    tint: '#eff6ff',
  },
  {
    label: 'Goals',
    question: 'What will we hit this year?',
    answer: '50k weekly households, day-30 retention 60%',
    icon: 'trending-up',
    deep: '#0f766e',
    tint: '#f0fdfa',
  },
  {
    label: 'Initiatives',
    question: 'What are we doing now?',
    answer: 'Guided first list, offline sync, Android widget',
    icon: 'zap',
    deep: '#15803d',
    tint: '#f0fdf4',
  },
];

// One Pyramid element (docs/specs/009-elements/concept-graphics.md) holding the five tiers, Purpose at the peak down
// to Initiatives at the base, laid out by its own pure layout so a resize or a sixth tier never has to be re-cut by
// hand. Its rows ramp from violet to pale, theme-locked, so the reading order survives a theme switch. A dotted
// leader runs from each tier's slanted edge to a Card on the right rail (docs/specs/009-elements/card.md): the tier's
// glyph in a tile, its guiding question as the title and Tandem's worked answer as the body, edged in the tier's
// hue. A bold title and a one-line how-to sit above, so the template teaches the model while it scaffolds a real
// strategy.
export function buildPyramid(cx: number, cy: number): Element[] {
  const baseW = 880;
  const tierH = 108;
  const H = TIERS.length * tierH;
  const railGap = 56;
  const cardW = 440;
  const cardH = 92;
  const headH = 96;
  const totalW = baseW + railGap + cardW;
  const left = cx - totalW / 2;
  const top = cy - (H + headH) / 2 + headH;
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

  const pyramid: Element = {
    ...createShape('pyramid', left, top),
    width: baseW,
    height: H,
    conceptRows: TIERS.map((t) => ({ label: t.label })),
    strokeColor: ACCENT,
    fillColor: PALE,
    // The ramp is the reading order (peak = most enduring), so it survives a theme switch.
    themeLockFill: true,
  };
  const layout = pyramidLayout(baseW, H, TIERS.length, 'pyramid');
  const ramp = conceptRamp(TIERS.length, ACCENT, PALE);

  const rail: Element[] = [];
  TIERS.forEach((t, i) => {
    // The tier's middle, and its slanted right-hand edge there.
    const ys = layout.tiers[i]!.points.map((p) => p.y);
    const midY = top + (Math.min(...ys) + Math.max(...ys)) / 2;
    const edgeX = left + baseW / 2 + ((midY - top) / H) * (baseW / 2);
    rail.push({
      ...createArrow(edgeX + 12, midY, railX - 10, midY),
      arrowEnds: 'none',
      strokeStyle: 'dotted',
      strokeColor: t.deep,
      routeBehind: false,
    });
    rail.push({
      ...createShape('card', railX, midY - cardH / 2),
      width: cardW,
      height: cardH,
      cardMedia: 'tile',
      iconId: t.icon,
      pageTitle: t.question,
      pageSubtitle: undefined,
      tags: undefined,
      label: t.answer,
      textSize: 'sm',
      fillColor: t.tint,
      strokeColor: t.deep,
      textColor: '#334155',
      accentEdge: 'left',
      accentEdgeColor: ramp[i]!.fill,
      themeLockFill: true,
    });
  });
  return [...head, pyramid, ...rail];
}
