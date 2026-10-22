// Conversion-funnel template. Its own file because it is neither a tree nor
// a board: one Funnel element (a Pyramid in its funnel variant) with a rail of
// counts beside it.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[]. See
// docs/specs/008-canvas/canvas-and-palette.md "Templates".

import {
  createCalloutCard,
  createPinnedArrow,
  createShape,
  createText,
  pyramidLayout,
  type Element,
} from '@livedesign/document';
import { CANVAS_TONES } from './template-inks';

// A funnel that tells a conversion story rather than just drawing a shape.
// Four AIDA tiers (Awareness / Interest / Decision / Action) ramp from a
// saturated mouth to a pale tip, the Funnel element's own ramp.
// A rail on the right gives every stage its real number and what counts as
// reaching it ("3,100 · signed up for a free account"), with the
// stage-to-stage conversion between them as a chip. The rates are DERIVED
// from the counts, so editing a count in the builder keeps the maths honest,
// and the weakest step is picked out in rose and wired to a drop-off callout
// that says what is leaking and carries a checklist of experiments to fix it:
// the funnel is only useful for finding where to dig. A pill under the tip
// gives the end-to-end rate.
type Stage = {
  label: string;
  count: number;
  counts: string;
  icon: string;
};

const STAGES: Stage[] = [
  {
    label: 'Awareness',
    count: 12400,
    counts: 'visited freshbox.app',
    icon: 'eye',
  },
  {
    label: 'Interest',
    count: 3100,
    counts: 'signed up for a free account',
    icon: 'user-plus',
  },
  {
    label: 'Decision',
    count: 930,
    counts: 'started a 14-day trial',
    icon: 'cart',
  },
  {
    label: 'Action',
    count: 210,
    counts: 'paid for a first box',
    icon: 'credit-card',
  },
];

// What the weakest step's callout proposes. One owner each, like any action.
const LEAK_EXPERIMENTS = [
  'Show next week’s menu at sign-up · Mia',
  'Day-5 reminder with a £10 code · Raj',
  'Ask every cancel why, in one tap · Ola',
];

const MUTED = '#64748b';
// The funnel's ramp: the accent at the mouth (row one) mixing toward a pale tip.
const FUNNEL_TIP = '#0284c7';
const FUNNEL_MOUTH = '#e0f2fe';

const pct = (a: number, b: number) => (a / b) * 100;
// Thousands separators without Intl, so the output is locale-proof.
const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function buildFunnel(cx: number, cy: number): Element[] {
  const tierH = 112;
  const tierGap = 36;
  const topW = 760;
  const railGap = 56;
  const railW = 300;
  const calloutGap = 64;
  const calloutW = 360;
  const titleH = 48;
  const captionH = 28;
  const headGap = 36;
  const pillGap = 28;
  const pillH = 40;

  const funnelH = STAGES.length * tierH + (STAGES.length - 1) * tierGap;
  const totalW = topW + railGap + railW + calloutGap + calloutW;
  const totalH = titleH + captionH + headGap + funnelH + pillGap + pillH;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const top = y0 + titleH + captionH + headGap;
  const railX = x0 + topW + railGap;
  const calloutX = railX + railW + calloutGap;

  const elements: Element[] = [
    {
      ...createText(x0, y0),
      width: totalW,
      height: titleH,
      label: 'Q3 sign-up funnel · FreshBox',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(x0, y0 + titleH),
      width: totalW,
      height: captionH,
      label:
        'Count every stage over the same window. The smallest step is where to dig first, so start with the red one.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];

  // The weakest step: the lowest stage-to-stage conversion.
  let worst = 1;
  for (let i = 2; i < STAGES.length; i++) {
    if (
      pct(STAGES[i]!.count, STAGES[i - 1]!.count) <
      pct(STAGES[worst]!.count, STAGES[worst - 1]!.count)
    )
      worst = i;
  }

  // One Funnel element (docs/specs/009-elements/concept-graphics.md): a Pyramid in its funnel variant, its bands
  // laid out and tapered by its own layout. Theme-locked, so the mouth-to-tip ramp (the reading order) survives a
  // theme switch.
  elements.push({
    ...createShape('pyramid', x0, top),
    width: topW,
    height: funnelH,
    pyramidVariant: 'funnel',
    conceptRows: STAGES.map((stage) => ({ label: stage.label })),
    strokeColor: FUNNEL_TIP,
    fillColor: FUNNEL_MOUTH,
    themeLockFill: true,
  });
  const layout = pyramidLayout(topW, funnelH, STAGES.length, 'funnel');
  const midOf = (i: number) => top + layout.tiers[i]!.label.y + layout.tiers[i]!.label.height / 2;

  let worstChip: Element | undefined;
  STAGES.forEach((stage, i) => {
    const midY = midOf(i);
    // Rail: the stage glyph, the count, and what counts as reaching it.
    const iconSize = 36;
    elements.push(
      {
        ...createShape('icon', railX, midY - iconSize / 2),
        width: iconSize,
        height: iconSize,
        iconId: stage.icon,
        strokeColor: '#0284c7',
      },
      {
        ...createText(railX + iconSize + 14, midY - 34),
        width: railW - iconSize - 14,
        height: 40,
        label: withCommas(stage.count),
        textSize: 'lg',
        textBold: true,
        textAlignX: 'left',
      },
      {
        ...createText(railX + iconSize + 14, midY + 6),
        width: railW - iconSize - 14,
        height: 26,
        label: stage.counts,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
      },
    );

    // The step INTO this stage, as a chip halfway between it and the stage above.
    if (i > 0) {
      const rate = Math.round(pct(stage.count, STAGES[i - 1]!.count));
      const isWorst = i === worst;
      const chipH = 30;
      const chip: Element = {
        ...createShape('stadium', railX, (midOf(i - 1) + midY) / 2 - chipH / 2),
        width: 170,
        height: chipH,
        label: `↓ ${rate}% move on`,
        textSize: 'sm',
        textBold: true,
        fillColor: isWorst ? '#ffe4e6' : '#f1f5f9',
        strokeColor: isWorst ? '#fb7185' : '#cbd5e1',
        textColor: isWorst ? '#be123c' : '#475569',
        themeLockFill: true,
      };
      elements.push(chip);
      if (isWorst) worstChip = chip;
    }
  });

  // End-to-end rate under the tip.
  const first = STAGES[0]!;
  const last = STAGES[STAGES.length - 1]!;
  const pillW = 360;
  elements.push({
    ...createShape('stadium', x0 + topW / 2 - pillW / 2, top + funnelH + pillGap),
    width: pillW,
    height: pillH,
    label: `${pct(last.count, first.count).toFixed(1)}% of visitors become customers`,
    textSize: 'sm',
    textBold: true,
    colorPreset: 'soft',
  });

  // The drop-off, level with the weakest step (clamped inside the composition): a Callout
  // (docs/specs/009-elements/card.md) with a warning badge, and the experiments to try as a checklist under it, wired
  // to its chip with a dashed pointer.
  const cardH = 132;
  const listGap = 12;
  const checklistH = LEAK_EXPERIMENTS.length * 30 + 22;
  const blockH = cardH + listGap + 26 + checklistH;
  const prev = STAGES[worst - 1]!;
  const lost = Math.round(100 - pct(STAGES[worst]!.count, prev.count));
  const chipMidY = (midOf(worst - 1) + midOf(worst)) / 2;
  const calloutY = Math.min(
    Math.max(chipMidY - cardH / 2, top),
    top + funnelH + pillGap + pillH - blockH,
  );
  const callout: Element = {
    ...createCalloutCard(calloutX, calloutY),
    width: calloutW,
    height: cardH,
    iconId: 'alert-triangle',
    pageTitle: 'Biggest drop-off',
    label: `${lost}% of people who reach ${prev.label} never get to ${STAGES[worst]!.label}. Most leave before their first box arrives.`,
    fillColor: '#fff1f2',
    strokeColor: '#e11d48',
    textColor: '#4c0519',
    themeLockFill: true,
  };
  elements.push(
    callout,
    {
      ...createText(calloutX, calloutY + cardH + listGap),
      width: calloutW,
      height: 26,
      label: 'Experiments to try',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
      // A heading on the canvas: a red that reads in either half.
      textColor: CANVAS_TONES.red,
    },
    {
      ...createShape('checklist', calloutX, calloutY + cardH + listGap + 26),
      width: calloutW,
      height: checklistH,
      checklistItems: LEAK_EXPERIMENTS.map((text) => ({ text, done: false })),
    },
  );
  if (worstChip) {
    elements.push({
      ...createPinnedArrow(worstChip.id, 'e', callout.id, 'w'),
      strokeStyle: 'dashed',
      strokeColor: '#fb7185',
    });
  }

  return elements;
}
