// The stakeholder map template (docs/specs/008-canvas/canvas-and-palette.md
// "Templates"): a Mendelow power / interest grid with an engagement plan,
// its worked content in ./template-stakeholders-data.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createArrow,
  createPinnedArrow,
  createShape,
  createSticky,
  createTable,
  createText,
  runsPlainText,
  type Element,
  type ShapeElement,
  type TableCellStyle,
  type TextRun,
} from '@livediagram/document';
import {
  CONTENT,
  MUTED,
  SCAFFOLD,
  SUBTITLE_H,
  TITLE_H,
  titleBlock,
} from './template-discovery-parts';
import {
  MOVE,
  NEXT_STEP,
  PLAN_HEAD,
  PLAN_ROWS,
  QUADRANTS,
  STANCES,
  type Stance,
} from './template-stakeholders-data';

// Who has to come along to launch group ordering, and how. Four tinted
// quadrants carry the engagement each earns, named the way Mendelow named
// them (Keep satisfied, Manage closely, Monitor, Keep informed), each with a
// glyph and a one-line rule. Power climbs the left axis and interest runs
// along the bottom, both arrowed toward "more". Eight people sit where the
// team placed them, each a card with a person glyph, name and role, edged by
// stance (champion green, neutral slate, sceptic rose). A dashed arrow and a
// dashed ghost card show where the team wants its most powerful sceptic by
// launch, and the engagement plan beside the grid turns the picture into
// commitments: what each key person needs, the channel and cadence, and an
// owner, the name cell tinted by stance. The stance key sits under the plan.
// Quadrants, axes, headings and key are the "Grid" scaffold; title, cards,
// the move and the plan ride "Stakeholders".

const INK = '#0f172a';
const WHITE = '#ffffff';

// Geometry, in canvas px.
const CELL_W = 400;
const CELL_H = 320;
const GAP = 12;
const PAD = 18;
const HEADER_H = 40;
const RULE_H = 24;
const ICON = 34;
const CARD_W = 176;
const CARD_H = 60;
const AXIS_GUTTER = 64;
const AXIS_BAND = 56;
const PLAN_GAP = 56;
const PLAN_W = 700;
const PLAN_ROW_H = 52;
const KEY_W = 280;
const KEY_CARD_W = 104;
const KEY_CARD_H = 30;
const KEY_PITCH = 38;

const personRuns = (name: string, role: string): TextRun[] => [
  { text: name, bold: true },
  { text: `\n${role}`, color: MUTED },
];

// A stakeholder: a white card with a person glyph, edged by stance.
function personCard(
  x: number,
  y: number,
  name: string,
  role: string,
  stance: Stance,
): ShapeElement {
  const runs = personRuns(name, role);
  return {
    ...createShape('square', x, y),
    width: CARD_W,
    height: CARD_H,
    label: runsPlainText(runs),
    richText: runs,
    textSize: 'sm',
    textAlignX: 'left',
    iconId: 'user',
    fillColor: WHITE,
    strokeColor: STANCES[stance].edge,
    strokeWidth: 'thick',
    textColor: INK,
    borderRadius: 'md',
    themeLockFill: true,
    ...CONTENT,
  };
}

export function buildStakeholderMap(cx: number, cy: number): Element[] {
  const headGap = 28;
  const plotW = CELL_W * 2 + GAP;
  const plotH = CELL_H * 2 + GAP;
  const totalW = AXIS_GUTTER + plotW + PLAN_GAP + PLAN_W;
  const totalH = TITLE_H + SUBTITLE_H + headGap + plotH + AXIS_BAND;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const plotX = x0 + AXIS_GUTTER;
  const plotY = y0 + TITLE_H + SUBTITLE_H + headGap;

  const elements: Element[] = titleBlock(
    x0,
    y0,
    totalW,
    'Plateful · Launching group ordering',
    'Place each person by power and interest, edge them by stance, then plan how each one hears from us.',
  );
  const cards = new Map<string, ShapeElement>();
  let ghost: ShapeElement | undefined;

  QUADRANTS.forEach((q, i) => {
    const x = plotX + (i % 2) * (CELL_W + GAP);
    const y = plotY + Math.floor(i / 2) * (CELL_H + GAP);
    elements.push(
      {
        ...createShape('square', x, y),
        width: CELL_W,
        height: CELL_H,
        fillColor: q.fill,
        strokeColor: q.stroke,
        themeLockFill: true,
        ...SCAFFOLD,
      },
      {
        ...createShape('icon', x + PAD, y + PAD + (HEADER_H - ICON) / 2),
        width: ICON,
        height: ICON,
        iconId: q.icon,
        strokeColor: q.ink,
        ...SCAFFOLD,
      },
      {
        ...createText(x + PAD + ICON + 10, y + PAD),
        width: CELL_W - PAD * 2 - ICON - 10,
        height: HEADER_H,
        label: q.label,
        textSize: 'lg',
        textAlignX: 'left',
        textColor: q.ink,
        ...SCAFFOLD,
      },
      {
        ...createText(x + PAD, y + PAD + HEADER_H),
        width: CELL_W - PAD * 2,
        height: RULE_H,
        label: q.rule,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
        ...SCAFFOLD,
      },
    );
    const areaX = x + PAD;
    const areaY = y + PAD + HEADER_H + RULE_H + 16;
    for (const p of q.people) {
      const c = personCard(areaX + p.dx, areaY + p.dy, p.name, p.role, p.stance);
      cards.set(p.name, c);
      elements.push(c);
    }
    // The ghost of the sceptic we are moving, where we want them by launch.
    if (q.label === 'Manage closely') {
      const [first] = MOVE.who.split(' ');
      const runs = personRuns(first!, 'By launch');
      ghost = {
        ...createShape('square', areaX + MOVE.dx, areaY + MOVE.dy),
        width: CARD_W,
        height: CARD_H,
        label: runsPlainText(runs),
        richText: runs,
        textSize: 'sm',
        textAlignX: 'left',
        iconId: 'user',
        fillColor: q.fill,
        strokeColor: STANCES.sceptic.edge,
        strokeWidth: 'thick',
        strokeStyle: 'dashed',
        textColor: INK,
        borderRadius: 'md',
        themeLockFill: true,
        ...CONTENT,
      };
      elements.push(ghost);
    }
  });

  // The move: a dashed arrow from the sceptic to their ghost.
  const from = cards.get(MOVE.who)!;
  elements.push({
    ...createPinnedArrow(from.id, 'e', ghost!.id, 'w'),
    label: MOVE.label,
    strokeColor: STANCES.sceptic.edge,
    strokeWidth: 3,
    strokeStyle: 'dashed',
    ...CONTENT,
  });

  // Axes: power up the left, interest along the bottom, each arrowed toward
  // "more", with Low / High at the ends and the axis name in the middle.
  const axis = (x1: number, y1: number, x2: number, y2: number): Element => ({
    ...createArrow(x1, y1, x2, y2),
    strokeColor: '#64748b',
    strokeWidth: 3,
    ...SCAFFOLD,
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
    textColor: MUTED,
    textAlignX: alignX,
    ...(rotation ? { rotation } : {}),
    ...SCAFFOLD,
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
    vertical(plotY + plotH / 2, 200, 'Power', true, 'center'),
    vertical(plotY + 40, 80, 'High', false, 'right'),
    vertical(plotY + plotH - 40, 80, 'Low', false, 'left'),
    axisText(plotX + plotW / 2 - 100, axisY + 6, 200, 'Interest', true, 'center'),
    axisText(plotX, axisY + 6, 80, 'Low', false, 'left'),
    axisText(plotX + plotW - 80, axisY + 6, 80, 'High', false, 'right'),
  );

  // The engagement plan: one row per key stakeholder, the name tinted by
  // stance so the plan and the grid agree at a glance.
  const planX = plotX + plotW + PLAN_GAP;
  const stanceOf = new Map(
    QUADRANTS.flatMap((q) => q.people.map((p) => [p.name, STANCES[p.stance]] as const)),
  );
  const head: TableCellStyle = { bg: '#e2e8f0', textColor: INK, bold: true, alignX: 'left' };
  const LEFT: TableCellStyle = { alignX: 'left' };
  const cellStyles = [PLAN_HEAD, ...PLAN_ROWS].map((row, r) =>
    row.map((cell, c): TableCellStyle | null => {
      if (r === 0) return head;
      const s = c === 0 ? stanceOf.get(cell) : undefined;
      return s ? { bg: s.tint, textColor: s.ink, bold: true, alignX: 'left' } : LEFT;
    }),
  );
  const tableTop = plotY + 76;
  const tableH = (PLAN_ROWS.length + 1) * PLAN_ROW_H;
  elements.push(
    {
      ...createText(planX, plotY),
      width: PLAN_W,
      height: 36,
      label: 'Engagement plan',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
    {
      ...createText(planX, plotY + 36),
      width: PLAN_W,
      height: 28,
      label:
        'Everyone we manage closely or keep satisfied, plus the loudest voice we keep informed.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
    {
      ...createTable(planX, tableTop),
      width: PLAN_W,
      height: tableH,
      cells: [PLAN_HEAD, ...PLAN_ROWS].map((row) => [...row]),
      cellStyles,
      headerRow: true,
      colWidths: [150, 250, 220, null],
      ...CONTENT,
    },
  );

  // The foot of the plan: the next step with the sceptic on a pinned
  // sticky, and the stance key beside it, a mini card per stance with what
  // it means, then what the dashed arrow means.
  const footY = tableTop + tableH + 32;
  const keyX = planX + PLAN_W - KEY_W;
  const noteW = PLAN_W - KEY_W - 40;
  elements.push(
    {
      ...createSticky(planX, footY + 8),
      width: noteW,
      height: plotY + plotH - footY - 8,
      label: NEXT_STEP,
      textSize: 'lg',
      fillColor: '#fde68a',
      textColor: '#451a03',
      rotation: -1.5,
      ...CONTENT,
    },
    {
      ...createShape('sticker', planX + noteW / 2 - 18, footY - 10),
      width: 36,
      height: 36,
      stickerId: 'emoji-pushpin',
      ...CONTENT,
    },
    {
      ...createText(keyX, footY),
      width: KEY_W,
      height: 28,
      label: 'Stance',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
  );
  const keyRow = (i: number) => footY + 36 + i * KEY_PITCH;
  const keyText = (i: number, label: string): Element => ({
    ...createText(keyX + KEY_CARD_W + 14, keyRow(i)),
    width: KEY_W - KEY_CARD_W - 14,
    height: KEY_CARD_H,
    label,
    textSize: 'sm',
    textColor: MUTED,
    textAlignX: 'left',
    ...SCAFFOLD,
  });
  (Object.keys(STANCES) as Stance[]).forEach((stance, i) => {
    const s = STANCES[stance];
    elements.push(
      {
        ...createShape('square', keyX, keyRow(i)),
        width: KEY_CARD_W,
        height: KEY_CARD_H,
        label: s.label,
        textSize: 'sm',
        textBold: true,
        padding: 'none',
        fillColor: WHITE,
        strokeColor: s.edge,
        strokeWidth: 'thick',
        textColor: s.ink,
        borderRadius: 'md',
        themeLockFill: true,
        ...SCAFFOLD,
      },
      keyText(i, s.meaning),
    );
  });
  const arrowY = keyRow(3) + KEY_CARD_H / 2;
  elements.push(
    {
      ...createArrow(keyX + 8, arrowY, keyX + KEY_CARD_W - 8, arrowY),
      strokeColor: STANCES.sceptic.edge,
      strokeWidth: 3,
      strokeStyle: 'dashed',
      ...SCAFFOLD,
    },
    keyText(3, 'Where we want them'),
  );

  return elements;
}
