// Conversion-funnel template. Its own file because it is neither a tree nor
// a board: a stacked-silhouette diagram like the pyramid, built from flipped
// trapezoids so each tier genuinely tapers.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[]. See
// docs/specs/008-canvas/canvas-and-palette.md "Templates".

import { createPinnedArrow, createShape, createText, type Element } from '@livediagram/document';

// A funnel that tells a conversion story rather than just drawing a shape.
// Four AIDA tiers (Awareness / Interest / Decision / Action) ramp from a pale
// mouth to a saturated tip, so the eye falls to the customers at the bottom.
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
  fill: string;
};

const STAGES: Stage[] = [
  {
    label: 'Awareness',
    count: 12400,
    counts: 'visited freshbox.app',
    icon: 'eye',
    fill: '#e0f2fe',
  },
  {
    label: 'Interest',
    count: 3100,
    counts: 'signed up for a free account',
    icon: 'user-plus',
    fill: '#bae6fd',
  },
  {
    label: 'Decision',
    count: 930,
    counts: 'started a 14-day trial',
    icon: 'cart',
    fill: '#7dd3fc',
  },
  {
    label: 'Action',
    count: 210,
    counts: 'paid for a first box',
    icon: 'credit-card',
    fill: '#38bdf8',
  },
];

// What the weakest step's callout proposes. One owner each, like any action.
const LEAK_EXPERIMENTS = [
  'Show next week’s menu at sign-up · Mia',
  'Day-5 reminder with a £10 code · Raj',
  'Ask every cancel why, in one tap · Ola',
];

const MUTED = '#64748b';
const INK = '#0c4a6e';

const pct = (a: number, b: number) => (a / b) * 100;
// Thousands separators without Intl, so the output is locale-proof.
const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function buildFunnel(cx: number, cy: number): Element[] {
  // The trapezoid renders narrow-top / wide-bottom (22..78 over 2..98 in its
  // 100-unit box), so each tier is rotated 180° to taper downward. Rotation
  // flips the label too, so tiers stay unlabelled and a separate text element
  // carries each stage name. Chaining the widths so one tier's bottom edge
  // (56% of its box) meets the next tier's top edge (96% of its box) makes
  // the silhouette read as one continuous funnel: nextW = W * 0.56 / 0.96.
  const tierH = 112;
  const tierGap = 36;
  const topW = 760;
  const taper = 0.56 / 0.96;
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
  const fx = x0 + topW / 2;
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

  let tierW = topW;
  let worstChip: Element | undefined;
  STAGES.forEach((stage, i) => {
    const y = top + i * (tierH + tierGap);
    const midY = y + tierH / 2;
    elements.push({
      ...createShape('trapezoid', fx - tierW / 2, y),
      width: tierW,
      height: tierH,
      rotation: 180,
      fillColor: stage.fill,
      // The ramp is the reading order (pale mouth to the prize at the
      // tip), so it survives a theme switch; the dark ink stays legible on
      // every step of it.
      themeLockFill: true,
    });
    elements.push({
      ...createText(fx - 110, midY - 20),
      width: 220,
      height: 40,
      label: stage.label,
      textSize: 'md',
      textBold: true,
      textAlignX: 'center',
      textColor: INK,
    });

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

    // The step INTO this stage, as a chip in the gap above it.
    if (i > 0) {
      const rate = Math.round(pct(stage.count, STAGES[i - 1]!.count));
      const isWorst = i === worst;
      const chipH = 30;
      const chip: Element = {
        ...createShape('stadium', railX, y - tierGap / 2 - chipH / 2),
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
    tierW *= taper;
  });

  // End-to-end rate under the tip.
  const first = STAGES[0]!;
  const last = STAGES[STAGES.length - 1]!;
  const pillW = 360;
  elements.push({
    ...createShape('stadium', fx - pillW / 2, top + funnelH + pillGap),
    width: pillW,
    height: pillH,
    label: `${pct(last.count, first.count).toFixed(1)}% of visitors become customers`,
    textSize: 'sm',
    textBold: true,
    colorPreset: 'soft',
  });

  // The drop-off callout, level with the weakest step (clamped inside the
  // composition), wired to its chip with a dashed pointer.
  const pad = 20;
  const headerH = 36;
  const bodyH = 56;
  const listLabelH = 26;
  const checklistH = LEAK_EXPERIMENTS.length * 30 + 22;
  const calloutH = pad + headerH + 8 + bodyH + 12 + listLabelH + 8 + checklistH + pad;
  const prev = STAGES[worst - 1]!;
  const lost = Math.round(100 - pct(STAGES[worst]!.count, prev.count));
  const chipMidY = top + worst * (tierH + tierGap) - tierGap / 2;
  const calloutY = Math.min(
    Math.max(chipMidY - calloutH / 2, top),
    top + funnelH + pillGap + pillH - calloutH,
  );
  const callout: Element = {
    ...createShape('square', calloutX, calloutY),
    width: calloutW,
    height: calloutH,
    fillColor: '#fff1f2',
    strokeColor: '#fda4af',
  };
  elements.push(callout);
  const iconSize = 32;
  elements.push(
    {
      ...createShape('icon', calloutX + pad, calloutY + pad + (headerH - iconSize) / 2),
      width: iconSize,
      height: iconSize,
      iconId: 'alert-triangle',
      strokeColor: '#be123c',
    },
    {
      ...createText(calloutX + pad + iconSize + 12, calloutY + pad),
      width: calloutW - pad * 2 - iconSize - 12,
      height: headerH,
      label: 'Biggest drop-off',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      textColor: '#be123c',
    },
    {
      ...createText(calloutX + pad, calloutY + pad + headerH + 8),
      width: calloutW - pad * 2,
      height: bodyH,
      label: `${lost}% of people who reach ${prev.label} never get to ${STAGES[worst]!.label}. Most leave before their first box arrives.`,
      textSize: 'sm',
      textColor: '#4c0519',
      textAlignX: 'left',
      textAlignY: 'top',
    },
    {
      ...createText(calloutX + pad, calloutY + pad + headerH + 8 + bodyH + 12),
      width: calloutW - pad * 2,
      height: listLabelH,
      label: 'Experiments to try',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
      textColor: '#be123c',
    },
    {
      ...createShape(
        'checklist',
        calloutX + pad,
        calloutY + pad + headerH + 8 + bodyH + 12 + listLabelH + 8,
      ),
      width: calloutW - pad * 2,
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
