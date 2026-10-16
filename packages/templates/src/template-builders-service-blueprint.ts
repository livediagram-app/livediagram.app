// The Service blueprint template (docs/specs/008-canvas/canvas-and-palette.md "Templates"): one Plateful office lunch
// order end to end (template-service-blueprint-data.ts).
//
// Five stages run across under a header row, and five rows run down, each a full-width tinted band named in a left
// rail with what it means: physical evidence, customer actions, frontstage, backstage and support processes. Between
// them the three blueprint lines: interaction (solid), visibility (dashed red, the one that matters) and internal
// interaction (dotted). Each stage's cards are joined top to bottom by arrows, the customer's actions left to right,
// and a face on each customer card says how that stage feels. Fail points (F) and wait points (W) are badges attached
// to the cards they mark, each with its note; a gold star marks the moment of truth. Under it all, a legend and the
// fail point to fix first.
//
// Layers: "Blueprint" holds the bands, rail, stage headers, lines and legend; "Service" the cards, arrows, faces,
// marks and notes.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createArrow,
  createPinnedArrow,
  createShape,
  createText,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';
import { CONTENT, INK, MUTED, SCAFFOLD } from './template-report-kit';
import {
  BLUEPRINT_CAPTION,
  BLUEPRINT_CARDS,
  BLUEPRINT_FEELS,
  BLUEPRINT_FIX,
  BLUEPRINT_MARKS,
  BLUEPRINT_MOMENT,
  BLUEPRINT_ROWS,
  BLUEPRINT_STAGES,
  BLUEPRINT_TITLE,
  type BlueprintRowId,
} from './template-service-blueprint-data';

const RAIL_W = 260;
const COL_W = 300;
const COL_GAP = 24;
const STAGE_H = 52;
const ROW_GAP = 30;
const MARK = 30;
const FACE = 40;
const ROW_H: Record<BlueprintRowId, number> = {
  evidence: 104,
  customer: 136,
  frontstage: 136,
  backstage: 136,
  support: 104,
};
const CARD_PAD = 16;
const LEGEND_H = 120;

const FAIL = { fill: '#dc2626', ink: '#ffffff' };
const WAIT = { fill: '#f59e0b', ink: '#451a03' };
const STAR = '#eab308';

export function buildServiceBlueprint(cx: number, cy: number): Element[] {
  const width = RAIL_W + COL_GAP + BLUEPRINT_STAGES.length * (COL_W + COL_GAP) - COL_GAP;
  const rowsH =
    BLUEPRINT_ROWS.reduce((h, r) => h + ROW_H[r.id], 0) + ROW_GAP * (BLUEPRINT_ROWS.length - 1);
  const height = TECH_HEADER_H + 24 + STAGE_H + 12 + rowsH + 40 + LEGEND_H;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const colX = (i: number) => x0 + RAIL_W + COL_GAP + i * (COL_W + COL_GAP);
  const stagesY = y0 + TECH_HEADER_H + 24;
  let y = stagesY + STAGE_H + 12;

  const out: Element[] = [
    ...techHeader(x0, y0, width, BLUEPRINT_TITLE, BLUEPRINT_CAPTION, {
      title: CONTENT.layerId,
      caption: SCAFFOLD.layerId,
    }),
    ...stageHeaders(colX, stagesY),
  ];
  const cards = new Map<string, ShapeElement>();
  const rowTop = new Map<BlueprintRowId, number>();
  for (const row of BLUEPRINT_ROWS) {
    const h = ROW_H[row.id];
    rowTop.set(row.id, y);
    out.push(...band(x0, y, width, h, row));
    BLUEPRINT_CARDS[row.id].forEach((label, i) => {
      const card: ShapeElement = {
        ...createShape('square', colX(i), y + CARD_PAD),
        width: COL_W,
        height: h - 2 * CARD_PAD,
        label,
        textSize: 'sm',
        textBold: row.id === 'customer',
        textColor: INK,
        fillColor: row.card.fill,
        strokeColor: row.card.stroke,
        strokeWidth: row.id === 'customer' ? 'medium' : 'thin',
        borderRadius: 'md',
        themeLockFill: true,
        ...CONTENT,
      };
      cards.set(`${row.id}:${i}`, card);
      out.push(card);
    });
    if (row.line) out.push(...line(x0, y + h + ROW_GAP / 2, width, row.line));
    y += h + ROW_GAP;
  }
  out.push(...flows(cards), ...feels(cards), ...marks(cards), ...moment(cards));
  out.push(...legend(x0, y + 10, width));
  return out;
}

// The stage names across the top, numbered, each over its column.
function stageHeaders(colX: (i: number) => number, y: number): Element[] {
  return BLUEPRINT_STAGES.flatMap((stage, i): Element[] => [
    {
      ...createShape('stadium', colX(i), y),
      width: COL_W,
      height: STAGE_H,
      label: `${i + 1} · ${stage}`,
      textSize: 'md',
      textBold: true,
      textColor: '#ffffff',
      fillColor: '#334155',
      strokeColor: '#334155',
      themeLockFill: true,
      ...SCAFFOLD,
    },
  ]);
}

// A row's band, its name and meaning in the rail.
function band(
  x: number,
  y: number,
  width: number,
  h: number,
  row: (typeof BLUEPRINT_ROWS)[number],
): Element[] {
  return [
    {
      ...createShape('square', x, y),
      width,
      height: h,
      label: '',
      fillColor: row.tint,
      strokeColor: row.tint,
      borderRadius: 'md',
      themeLockFill: true,
      ...SCAFFOLD,
    },
    {
      ...createText(x + 20, y + h / 2 - 30),
      width: RAIL_W - 32,
      height: 30,
      label: row.name,
      textSize: 'md',
      textBold: true,
      textColor: INK,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
    {
      ...createText(x + 20, y + h / 2),
      width: RAIL_W - 32,
      height: 40,
      label: row.meaning,
      textSize: 'sm',
      textColor: '#475569',
      textAlignX: 'left',
      textAlignY: 'top',
      ...SCAFFOLD,
    },
  ];
}

// One of the blueprint's lines across the gap under a row, its name over its left end.
function line(
  x: number,
  y: number,
  width: number,
  l: NonNullable<(typeof BLUEPRINT_ROWS)[number]['line']>,
): Element[] {
  return [
    {
      ...createArrow(x + RAIL_W - 12, y, x + width, y),
      arrowEnds: 'none',
      strokeColor: l.colour,
      strokeWidth: l.bold ? 3 : 2,
      ...(l.style === 'solid' ? {} : { strokeStyle: l.style }),
      ...SCAFFOLD,
    },
    {
      ...createText(x + 12, y - 11),
      width: RAIL_W - 30,
      height: 22,
      label: l.name,
      textSize: 'sm',
      textBold: true,
      textColor: l.colour === INK ? MUTED : l.colour,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
  ];
}

// The customer's actions left to right; each stage top to bottom, from the action to what serves it.
function flows(cards: Map<string, ShapeElement>): Element[] {
  const out: Element[] = [];
  const order: BlueprintRowId[] = ['customer', 'frontstage', 'backstage', 'support'];
  for (let i = 0; i < BLUEPRINT_STAGES.length; i++) {
    if (i > 0)
      out.push({
        ...createPinnedArrow(
          cards.get(`customer:${i - 1}`)!.id,
          'e',
          cards.get(`customer:${i}`)!.id,
          'w',
        ),
        strokeColor: '#b45309',
        strokeWidth: 2.5,
        ...CONTENT,
      });
    for (let r = 0; r < order.length - 1; r++)
      out.push({
        ...createPinnedArrow(
          cards.get(`${order[r]}:${i}`)!.id,
          's',
          cards.get(`${order[r + 1]}:${i}`)!.id,
          'n',
        ),
        strokeColor: '#64748b',
        strokeWidth: 1.5,
        ...CONTENT,
      });
    out.push({
      ...createPinnedArrow(
        cards.get(`customer:${i}`)!.id,
        'n',
        cards.get(`evidence:${i}`)!.id,
        's',
      ),
      strokeColor: '#94a3b8',
      strokeWidth: 1.5,
      strokeStyle: 'dashed',
      arrowEnds: 'none',
      ...CONTENT,
    });
  }
  return out;
}

// How each stage feels: a face sticker over the middle of the customer's card.
function feels(cards: Map<string, ShapeElement>): Element[] {
  return BLUEPRINT_FEELS.map((face, i): Element => {
    const card = cards.get(`customer:${i}`)!;
    return {
      ...createShape('sticker', card.x + card.width / 2 - FACE / 2, card.y - FACE + 14),
      width: FACE,
      height: FACE,
      stickerId: face,
      ...CONTENT,
    };
  });
}

// The fail and wait points: a badge on the card's top-left, and its note along the card's foot.
function marks(cards: Map<string, ShapeElement>): Element[] {
  return BLUEPRINT_MARKS.flatMap((m): Element[] => {
    const card = cards.get(`${m.row}:${m.stage}`)!;
    const c = m.kind === 'fail' ? FAIL : WAIT;
    return [
      {
        ...createShape('badge', card.x - MARK / 2, card.y - MARK / 2),
        width: MARK,
        height: MARK,
        label: m.kind === 'fail' ? 'F' : 'W',
        textSize: 'sm',
        textBold: true,
        fillColor: c.fill,
        strokeColor: c.fill,
        textColor: c.ink,
        themeLockFill: true,
        attachedTo: card.id,
        attachAt: 'top-left',
        ...CONTENT,
      },
      {
        ...createText(card.x + 10, card.y + card.height - 30),
        width: card.width - 20,
        height: 24,
        label: m.note,
        textSize: 'sm',
        textBold: true,
        textColor: m.kind === 'fail' ? '#b91c1c' : '#92400e',
        ...CONTENT,
      },
    ];
  });
}

// The moment of truth: a gold star on the customer's card at that stage.
function moment(cards: Map<string, ShapeElement>): Element[] {
  const card = cards.get(`customer:${BLUEPRINT_MOMENT}`)!;
  return [
    {
      ...createShape('star', card.x - 22, card.y - 22),
      width: 44,
      height: 44,
      label: '',
      fillColor: STAR,
      strokeColor: '#a16207',
      themeLockFill: true,
      ...CONTENT,
    },
  ];
}

// Under the blueprint: the key to its marks and lines, and the fail point to fix first.
function legend(x: number, y: number, width: number): Element[] {
  const out: Element[] = [];
  const items: { sample: Element; label: string }[] = [];
  const at = (i: number) => x + i * 230;
  const mid = y + 30;
  const chip = (i: number, label: string, c: { fill: string; ink: string }) => ({
    ...createShape('badge', at(i), mid - MARK / 2),
    width: MARK,
    height: MARK,
    label,
    textSize: 'sm' as const,
    textBold: true,
    fillColor: c.fill,
    strokeColor: c.fill,
    textColor: c.ink,
    themeLockFill: true,
    ...SCAFFOLD,
  });
  items.push({ sample: chip(0, 'F', FAIL), label: 'Fail point' });
  items.push({ sample: chip(1, 'W', WAIT), label: 'Wait point' });
  items.push({
    sample: {
      ...createShape('star', at(2), mid - 16),
      width: 32,
      height: 32,
      label: '',
      fillColor: STAR,
      strokeColor: '#a16207',
      themeLockFill: true,
      ...SCAFFOLD,
    },
    label: 'Moment of truth',
  });
  items.forEach(({ sample, label }, i) =>
    out.push(sample, {
      ...createText(at(i) + 44, mid - 14),
      width: 170,
      height: 28,
      label,
      textSize: 'sm',
      textAlignX: 'left',
      ...SCAFFOLD,
    }),
  );
  const fixW = 560;
  const fixX = x + width - fixW;
  out.push(
    {
      ...createShape('square', fixX, y),
      width: fixW,
      height: LEGEND_H - 10,
      label: '',
      fillColor: '#fef2f2',
      strokeColor: '#fca5a5',
      strokeWidth: 'medium',
      borderRadius: 'md',
      themeLockFill: true,
      ...CONTENT,
    },
    {
      ...createText(fixX + 20, y + 12),
      width: fixW - 40,
      height: 28,
      label: BLUEPRINT_FIX.title,
      textSize: 'md',
      textBold: true,
      textColor: '#991b1b',
      textAlignX: 'left',
      ...CONTENT,
    },
    {
      ...createText(fixX + 20, y + 42),
      width: fixW - 40,
      height: LEGEND_H - 60,
      label: BLUEPRINT_FIX.text,
      textSize: 'sm',
      textColor: INK,
      textAlignX: 'left',
      textAlignY: 'top',
      ...CONTENT,
    },
  );
  return out;
}
