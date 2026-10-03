// Board templates lifted out of template-builders.ts. The SWOT lives here;
// the retrospective, Kanban and prioritization matrix each outgrew the shared
// file and live in their own modules, re-exported below so build-template
// keeps importing every board from one place.
//
// Each builder is pure: takes a centre (cx, cy), returns a fresh Element[].
// See docs/specs/008-canvas/canvas-and-palette.md "Templates" for the catalogue.

import { createShape, createSticky, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

export { buildRetrospective } from './template-builders-retrospective';
export { buildKanban } from './template-builders-kanban';
export { buildPrioritizationMatrix } from './template-builders-prioritization';

// SWOT for one named decision, not "our business" in the abstract: Brightside
// Coffee weighing a fourth café in a new city. The 2x2 carries its two axes
// out loud, Helpful / Harmful across the top and Internal / External down the
// side, because that is what makes a Strength different from an Opportunity
// and newcomers mix them up. Each quadrant is a tinted container with a
// deep-hue header, a role glyph and a prompt question, and its evidence sits
// on three sticky notes in the quadrant's own hue (a SWOT is filled in as a
// group, on stickies). Under the grid, a "So what?" strip turns the pairings
// into moves (the TOWS follow-through: S+O, W+O, S+T, W+T), since a SWOT that
// stops at four lists changes nothing. Quadrants, axis labels and the strip's
// frame are the "Quadrants" scaffold; title, stickies and moves ride "Notes".
type SwotQuadrant = {
  label: string;
  prompt: string;
  icon: string;
  fill: string;
  stroke: string;
  headerColor: string;
  sticky: { fill: string; text: string };
  notes: [string, string, string];
};

const SWOT_QUADRANTS: [SwotQuadrant, SwotQuadrant, SwotQuadrant, SwotQuadrant] = [
  {
    label: 'Strengths',
    prompt: 'What do we do better than anyone?',
    icon: 'award',
    fill: '#dcfce7',
    stroke: '#86efac',
    headerColor: '#15803d',
    sticky: { fill: '#bbf7d0', text: '#052e16' },
    notes: [
      'Regulars visit four times a week',
      'Own roastery keeps margins at 68%',
      '9,000 members on the loyalty app',
    ],
  },
  {
    label: 'Weaknesses',
    prompt: 'Where do we fall short?',
    icon: 'trending-down',
    fill: '#ffe4e6',
    stroke: '#fda4af',
    headerColor: '#be123c',
    sticky: { fill: '#fecdd3', text: '#4c0519' },
    notes: [
      'Only Jo can train new baristas',
      'Never run a café outside Leeds',
      'Weekend queues top 15 minutes',
    ],
  },
  {
    label: 'Opportunities',
    prompt: 'What could we take advantage of?',
    icon: 'sun',
    fill: '#dbeafe',
    stroke: '#93c5fd',
    headerColor: '#1d4ed8',
    sticky: { fill: '#bae6fd', text: '#082f49' },
    notes: [
      'York’s new station quarter opens in May',
      'Offices back three days a week',
      'Oat-milk orders up 40% this year',
    ],
  },
  {
    label: 'Threats',
    prompt: 'What could hurt us?',
    icon: 'alert-octagon',
    fill: '#fef3c7',
    stroke: '#fcd34d',
    headerColor: '#b45309',
    sticky: { fill: '#fde68a', text: '#451a03' },
    notes: [
      'A national chain is opening two doors down',
      'Green bean prices up 30%',
      'City-centre rents rising again',
    ],
  },
];

// The moves, one per pairing. The chip names the pairing and the verb.
const SWOT_MOVES: { chip: string; move: string }[] = [
  { chip: 'S + O · Grow', move: 'Open next to York station with the loyalty app on day one' },
  { chip: 'W + O · Fix', move: 'Hire a head trainer before the lease is signed' },
  { chip: 'S + T · Defend', move: 'Lock in regulars with a roastery-only subscription' },
  { chip: 'W + T · Avoid', move: 'Trial a pop-up for three months before a full site' },
];

export function buildSwot(cx: number, cy: number): Element[] {
  const cellW = 620;
  const gap = 24;
  const pad = 20;
  const headerH = 44;
  const promptH = 26;
  const iconSize = 40;
  const stickyGap = 14;
  const stickyW = (cellW - pad * 2 - stickyGap * 2) / 3;
  const stickyH = 112;
  const cellH = pad + headerH + promptH + stickyGap + stickyH + pad;
  const axisW = 44; // the Internal / External gutter down the left
  const axisH = 34; // the Helpful / Harmful band across the top
  const titleH = 52;
  const subtitleH = 30;
  const headGap = 20;
  const movesGap = 36;
  const moveH = 112;
  const movesH = pad + headerH + moveH + pad;
  const gridW = cellW * 2 + gap;
  const totalW = axisW + gridW;
  const totalH = titleH + subtitleH + headGap + axisH + cellH * 2 + gap + movesGap + movesH;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const gridX = x0 + axisW;
  const gridY = y0 + titleH + subtitleH + headGap + axisH;

  const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
  const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };
  const muted = '#64748b';
  const elements: Element[] = [
    {
      ...createText(x0, y0),
      width: totalW,
      height: titleH,
      label: 'SWOT · Should Brightside Coffee open in York?',
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
        'Inside the business on top, the world outside below. One fact per sticky, then turn the pairings into moves.',
      textSize: 'sm',
      textColor: muted,
      textAlignX: 'left',
      ...scaffold,
    },
  ];

  // The two axes, named where they apply: columns across the top, rows down
  // the left (rotated so each label runs along its row).
  const axisLabel = (x: number, y: number, w: number, label: string, rotation?: number) =>
    elements.push({
      ...createText(x, y),
      width: w,
      height: axisH - 6,
      label,
      textSize: 'sm',
      textBold: true,
      textColor: muted,
      textAlignX: 'center',
      ...(rotation ? { rotation } : {}),
      ...scaffold,
    });
  axisLabel(gridX, gridY - axisH, cellW, 'Helpful');
  axisLabel(gridX + cellW + gap, gridY - axisH, cellW, 'Harmful');
  const rowLabel = (rowY: number, label: string) =>
    axisLabel(
      x0 + axisW / 2 - cellH / 2 - 3,
      rowY + cellH / 2 - (axisH - 6) / 2,
      cellH,
      label,
      -90,
    );
  rowLabel(gridY, 'Internal');
  rowLabel(gridY + cellH + gap, 'External');

  SWOT_QUADRANTS.forEach((q, i) => {
    const x = gridX + (i % 2) * (cellW + gap);
    const y = gridY + Math.floor(i / 2) * (cellH + gap);
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
        ...createText(x + pad, y + pad),
        width: cellW - pad * 2 - iconSize,
        height: headerH,
        label: q.label,
        textSize: 'lg',
        textAlignX: 'left',
        textColor: q.headerColor,
        ...scaffold,
      },
      {
        ...createShape('icon', x + cellW - pad - iconSize, y + pad + (headerH - iconSize) / 2),
        width: iconSize,
        height: iconSize,
        iconId: q.icon,
        strokeColor: q.headerColor,
        ...scaffold,
      },
      {
        ...createText(x + pad, y + pad + headerH),
        width: cellW - pad * 2,
        height: promptH,
        label: q.prompt,
        textSize: 'sm',
        textColor: muted,
        textAlignX: 'left',
        ...scaffold,
      },
    );
    q.notes.forEach((note, j) => {
      elements.push({
        ...createSticky(
          x + pad + j * (stickyW + stickyGap),
          y + pad + headerH + promptH + stickyGap,
        ),
        width: stickyW,
        height: stickyH,
        label: note,
        textSize: 'sm',
        fillColor: q.sticky.fill,
        textColor: q.sticky.text,
        ...content,
      });
    });
  });

  // "So what?": the strip that turns the four lists into four moves. Neutral
  // paper with a thick border, like the retro's Action items, so it reads as
  // the board's output rather than a fifth quadrant.
  const movesY = gridY + cellH * 2 + gap + movesGap;
  elements.push(
    {
      ...createShape('square', gridX, movesY),
      width: gridW,
      height: movesH,
      fillColor: '#f8fafc',
      strokeColor: '#94a3b8',
      strokeWidth: 'thick',
      ...scaffold,
    },
    {
      ...createShape('icon', gridX + pad, movesY + pad + (headerH - iconSize) / 2),
      width: iconSize,
      height: iconSize,
      iconId: 'target',
      strokeColor: '#0f172a',
      ...scaffold,
    },
    {
      ...createText(gridX + pad + iconSize + 12, movesY + pad),
      width: 220,
      height: headerH,
      label: 'So what?',
      textSize: 'lg',
      textAlignX: 'left',
      ...scaffold,
    },
    {
      ...createText(gridX + pad + iconSize + 12 + 220, movesY + pad),
      width: gridW - pad * 2 - iconSize - 12 - 220,
      height: headerH,
      label: 'Pair a row with a column, and write the move it suggests.',
      textSize: 'sm',
      textColor: muted,
      textAlignX: 'right',
      ...scaffold,
    },
  );
  const moveGap = 16;
  const moveW = (gridW - pad * 2 - moveGap * (SWOT_MOVES.length - 1)) / SWOT_MOVES.length;
  SWOT_MOVES.forEach((m, i) => {
    const x = gridX + pad + i * (moveW + moveGap);
    const y = movesY + pad + headerH;
    elements.push(
      {
        ...createShape('square', x, y),
        width: moveW,
        height: moveH,
        fillColor: '#ffffff',
        strokeColor: '#cbd5e1',
        ...content,
      },
      {
        ...createShape('stadium', x + 12, y + 12),
        width: 150,
        height: 28,
        label: m.chip,
        textSize: 'sm',
        textBold: true,
        colorPreset: 'bold',
        ...content,
      },
      {
        ...createText(x + 12, y + 48),
        width: moveW - 24,
        height: moveH - 56,
        label: m.move,
        textSize: 'sm',
        textAlignX: 'left',
        textAlignY: 'top',
        ...content,
      },
    );
  });

  return elements;
}
