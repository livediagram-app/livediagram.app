// The prioritization matrix (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// template-builders-boards.ts (which re-exports it) once the bare crossed
// axes became named quadrants with a facilitation rail.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createArrow,
  createShape,
  createSticky,
  createText,
  type Element,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// An impact / effort matrix a team has just run. The plot is four tinted
// quadrants named for what you do with the work in them, the names every
// product team uses: Quick wins (high impact, low effort) top-left, Big bets
// top-right, Fill-ins bottom-left and Money pits bottom-right, each with a
// glyph and a one-line rule. Impact climbs the left axis and effort runs
// along the bottom, both arrowed toward "more". Eight onboarding ideas sit
// where the team placed them, each a sticky with its dot-vote count on a dark
// disc, so the chart shows the evidence as well as the verdict. A rail on the
// right runs the ritual in order: a 3-dot vote for impact, a T-shirt estimate
// card for effort, and a checklist committing to the quick wins with an owner
// and a date. Quadrants, axes and rail copy are the "Axes" scaffold; title,
// stickies, discs and tools ride "Items" so they stay draggable when locked.
type Quadrant = {
  label: string;
  rule: string;
  icon: string;
  fill: string;
  stroke: string;
  headerColor: string;
  // Items as [label, votes, dx, dy], offsets inside the quadrant's item area
  // so each sits where its impact and effort put it.
  items: [string, number, number, number][];
};

const QUADRANTS: [Quadrant, Quadrant, Quadrant, Quadrant] = [
  {
    label: 'Quick wins',
    rule: 'High impact, low effort: do these now',
    icon: 'zap',
    fill: '#dcfce7',
    stroke: '#86efac',
    headerColor: '#15803d',
    items: [
      ['Sample diagram on first open', 7, 0, 0],
      ['Shortcut cheat sheet', 4, 200, 64],
    ],
  },
  {
    label: 'Big bets',
    rule: 'High impact, high effort: plan them properly',
    icon: 'target',
    fill: '#dbeafe',
    stroke: '#93c5fd',
    headerColor: '#1d4ed8',
    items: [
      ['Guided tour of the editor', 6, 20, 10],
      ['Import boards from Miro', 5, 210, 72],
    ],
  },
  {
    label: 'Fill-ins',
    rule: 'Low impact, low effort: when there’s slack',
    icon: 'clock',
    fill: '#fef3c7',
    stroke: '#fcd34d',
    headerColor: '#b45309',
    items: [
      ['Friendlier empty-state copy', 2, 10, 20],
      ['Confetti on first share', 1, 205, 78],
    ],
  },
  {
    label: 'Money pits',
    rule: 'Low impact, high effort: avoid or rethink',
    icon: 'alert-octagon',
    fill: '#ffe4e6',
    stroke: '#fda4af',
    headerColor: '#be123c',
    items: [
      ['Custom font uploads', 1, 0, 74],
      ['Rebuild the settings page', 2, 222, 8],
    ],
  },
];

// The quick wins, committed: what, who, by when.
const COMMITMENTS = ['Sample diagram · Ana · 4 Oct', 'Cheat sheet · Leo · 11 Oct'];

export function buildPrioritizationMatrix(cx: number, cy: number): Element[] {
  const cellW = 440;
  const cellH = 290;
  const gap = 12;
  const pad = 18;
  const headerH = 40;
  const ruleH = 24;
  const iconSize = 34;
  const itemW = 180;
  const itemH = 76;
  const disc = 32;
  const axisGutter = 64; // left of the plot: the Impact label and its arrow
  const axisBand = 56; // under the plot: the Effort arrow and its label
  const railGap = 48;
  const railW = 330;
  const titleH = 52;
  const subtitleH = 30;
  const headGap = 28;
  const plotW = cellW * 2 + gap;
  const plotH = cellH * 2 + gap;
  const totalW = axisGutter + plotW + railGap + railW;
  const totalH = titleH + subtitleH + headGap + plotH + axisBand;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const plotX = x0 + axisGutter;
  const plotY = y0 + titleH + subtitleH + headGap;

  const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
  const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };
  const muted = '#64748b';
  const elements: Element[] = [
    {
      ...createText(x0, y0),
      width: totalW,
      height: titleH,
      label: 'Impact vs effort · Onboarding fixes for Q4',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(x0, y0 + titleH),
      width: totalW,
      height: subtitleH,
      label:
        'Dot-vote impact, size effort together, then drag each idea into its quadrant. Start top-left.',
      textSize: 'sm',
      textColor: muted,
      textAlignX: 'left',
      ...scaffold,
    },
  ];

  QUADRANTS.forEach((q, i) => {
    const x = plotX + (i % 2) * (cellW + gap);
    const y = plotY + Math.floor(i / 2) * (cellH + gap);
    elements.push(
      {
        ...createShape('square', x, y),
        width: cellW,
        height: cellH,
        fillColor: q.fill,
        strokeColor: q.stroke,
        ...scaffold,
      },
      {
        ...createShape('icon', x + pad, y + pad + (headerH - iconSize) / 2),
        width: iconSize,
        height: iconSize,
        iconId: q.icon,
        strokeColor: q.headerColor,
        ...scaffold,
      },
      {
        ...createText(x + pad + iconSize + 10, y + pad),
        width: cellW - pad * 2 - iconSize - 10,
        height: headerH,
        label: q.label,
        textSize: 'lg',
        textAlignX: 'left',
        textColor: q.headerColor,
        ...scaffold,
      },
      {
        ...createText(x + pad, y + pad + headerH),
        width: cellW - pad * 2,
        height: ruleH,
        label: q.rule,
        textSize: 'sm',
        textColor: muted,
        textAlignX: 'left',
        ...scaffold,
      },
    );
    const areaY = y + pad + headerH + ruleH + 16;
    for (const [label, votes, dx, dy] of q.items) {
      const ix = x + pad + dx;
      const iy = areaY + dy;
      elements.push(
        {
          ...createSticky(ix, iy),
          width: itemW,
          height: itemH,
          label,
          textSize: 'sm',
          fillColor: '#fde68a',
          textColor: '#451a03',
          ...content,
        },
        // The dot-vote tally, pinned to the note's top-right corner.
        {
          ...createShape('circle', ix + itemW - disc / 2 - 4, iy - disc / 2 + 4),
          width: disc,
          height: disc,
          label: String(votes),
          textSize: 'sm',
          textBold: true,
          padding: 'none',
          // The Inked preset: a dark disc with light text under every theme.
          fillColor: '#0f172a',
          strokeColor: '#334155',
          textColor: '#f8fafc',
          strokeWidth: 'medium',
          colorPreset: 'inked',
          ...content,
        },
      );
    }
  });

  // Axes: impact up the left, effort along the bottom, each arrowed toward
  // "more", with Low / High at the ends and the axis name in the middle.
  const axis = (x1: number, y1: number, x2: number, y2: number): Element => ({
    ...createArrow(x1, y1, x2, y2),
    strokeColor: '#475569',
    strokeWidth: 3,
    ...scaffold,
  });
  const axisX = plotX - 20;
  const axisY = plotY + plotH + 20;
  elements.push(axis(axisX, plotY + plotH, axisX, plotY), axis(plotX, axisY, plotX + plotW, axisY));
  const axisText = (
    x: number,
    y: number,
    w: number,
    label: string,
    bold: boolean,
    alignX: 'left' | 'center' | 'right',
    rotation?: number,
  ): Element => ({
    ...createText(x, y),
    width: w,
    height: 28,
    label,
    textSize: 'sm',
    textBold: bold,
    textColor: bold ? '#334155' : muted,
    textAlignX: alignX,
    ...(rotation ? { rotation } : {}),
    ...scaffold,
  });
  // Rotated labels: an unrotated w x 28 box centred on the gutter, turned -90.
  const vertical = (
    centreY: number,
    w: number,
    label: string,
    bold: boolean,
    align: 'left' | 'center' | 'right',
  ) => axisText(axisX - 22 - w / 2, centreY - 14, w, label, bold, align, -90);
  elements.push(
    vertical(plotY + plotH / 2, 200, 'Impact', true, 'center'),
    vertical(plotY + 40, 80, 'High', false, 'right'),
    vertical(plotY + plotH - 40, 80, 'Low', false, 'left'),
    axisText(plotX + plotW / 2 - 100, axisY + 6, 200, 'Effort', true, 'center'),
    axisText(plotX, axisY + 6, 80, 'Low', false, 'left'),
    axisText(plotX + plotW - 80, axisY + 6, 80, 'High', false, 'right'),
  );

  // The rail runs the session in order: vote, size, commit.
  const railX = plotX + plotW + railGap;
  const step = (y: number, label: string): Element => ({
    ...createText(railX, y),
    width: railW,
    height: 30,
    label,
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
    ...scaffold,
  });
  const voteY = plotY;
  elements.push(step(voteY, '1. Dot-vote the impact'), {
    ...createShape('session-button', railX, voteY + 40),
    width: 152,
    height: 96,
    session: { tool: 'vote', dots: 3 },
    ...content,
  });
  elements.push({
    ...createText(railX + 168, voteY + 40),
    width: railW - 168,
    height: 96,
    label: 'Three dots each. The tally goes on the note.',
    textSize: 'sm',
    textColor: muted,
    textAlignX: 'left',
    textAlignY: 'middle',
    ...scaffold,
  });
  const sizeY = voteY + 40 + 96 + 24;
  const estimateH = 220;
  elements.push(step(sizeY, '2. Size the effort together'), {
    ...createShape('estimate', railX, sizeY + 40),
    width: railW,
    height: estimateH,
    label: 'How big is the guided tour?',
    estimateScale: 'tshirt',
    ...content,
  });
  const commitY = sizeY + 40 + estimateH + 24;
  elements.push(step(commitY, '3. Commit to the quick wins'), {
    ...createShape('checklist', railX, commitY + 40),
    width: railW,
    height: COMMITMENTS.length * 40 + 24,
    checklistItems: COMMITMENTS.map((text) => ({ text, done: false })),
    ...content,
  });

  return elements;
}
