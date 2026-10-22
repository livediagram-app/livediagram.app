// The Wardley map template (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Plateful's group lunch orders
// as a value chain (template-wardley-data.ts) mapped on evolution.
//
// The map is a box of four stage bands, Genesis to Commodity, each a faint tint locked against the theme and split
// from the next by a dashed rule; its y axis runs from Visible (top) to Invisible (bottom). The anchor (the user and
// their need) sits at the top, and every component is one chip placed at its evolution and visibility, so dragging it
// carries its name and its lines. Needs are plain lines; a movement is a dashed red arrow to a hollow ghost of where a
// component is heading; inertia is a thick bar in front of a component. Three numbered plays sit on the map and are
// spelt out beside it, over the questions to ask of a map and a legend.
//
// Layers: "Map" holds the bands, rules, axes, stage names, panel headings and legend; "Components" the anchor,
// chips, lines, movements, inertia, plays and their cards.
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
import { anchorToward } from './template-rake';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';
import {
  CONTENT,
  INK,
  INK_SOFT,
  MUTED,
  PAPER,
  SCAFFOLD,
  SECTION_H,
  sectionHeading,
} from './template-report-kit';
import {
  WARDLEY_CAPTION,
  WARDLEY_COMPONENTS,
  WARDLEY_NEEDS,
  WARDLEY_PLAYS,
  WARDLEY_QUESTIONS,
  WARDLEY_STAGES,
  WARDLEY_TITLE,
  WARDLEY_USER,
} from './template-wardley-data';

const MAP_W = 1480;
const MAP_H = 880;
const GUTTER = 104; // the y axis, its title and its Visible / Invisible ends, left of the map
const UNDER_H = 96; // stage names, their traits and the Evolution title
const SIDE_GAP = 56;
const SIDE_W = 440;
const CHIP_H = 34;
const STEP = 30;
const GHOST = 24;

const MOVE = '#dc2626';
const LINE = '#64748b';
const RULE = '#94a3b8';
const INERTIA = '#334155';

// A chip wide enough for its name in small text (about 7.8 px a character) and its padding.
const chipW = (label: string) => Math.round(label.length * 7.8 + 36);

export function buildWardleyMap(cx: number, cy: number): Element[] {
  const width = GUTTER + MAP_W + SIDE_GAP + SIDE_W;
  const height = TECH_HEADER_H + 28 + MAP_H + UNDER_H;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const mapX = x0 + GUTTER;
  const mapY = y0 + TECH_HEADER_H + 28;
  const at = (evolution: number, visibility: number) => ({
    x: mapX + evolution * MAP_W,
    y: mapY + (1 - visibility) * MAP_H,
  });
  const components = chips(at);
  return [
    ...techHeader(x0, y0, width, WARDLEY_TITLE, WARDLEY_CAPTION, {
      title: CONTENT.layerId,
      caption: SCAFFOLD.layerId,
    }),
    ...stages(mapX, mapY),
    ...axes(x0, mapX, mapY),
    ...anchor(at, components.get('need')!),
    ...needs(components),
    ...[...components.values()],
    ...movements(components, at),
    ...inertia(components),
    ...plays(components),
    ...panel(mapX + MAP_W + SIDE_GAP, mapY),
  ];
}

// The four stage bands under everything, their dashed rules, and each stage's name and character under the map.
function stages(mapX: number, mapY: number): Element[] {
  const out: Element[] = [];
  let from = 0;
  for (const stage of WARDLEY_STAGES) {
    const x = mapX + from * MAP_W;
    const w = (stage.to - from) * MAP_W;
    out.push(
      {
        ...createShape('square', x, mapY),
        width: w,
        height: MAP_H,
        label: '',
        fillColor: stage.tint,
        strokeColor: stage.tint,
        themeLockFill: true,
        ...SCAFFOLD,
      },
      {
        ...createText(x, mapY + MAP_H + 14),
        width: w,
        height: 26,
        label: stage.name,
        textSize: 'sm',
        textBold: true,
        ...SCAFFOLD,
      },
      {
        ...createText(x, mapY + MAP_H + 40),
        width: w,
        height: 22,
        label: stage.trait,
        textSize: 'sm',
        textColor: MUTED,
        ...SCAFFOLD,
      },
    );
    if (from > 0)
      out.push({
        ...createArrow(x, mapY, x, mapY + MAP_H),
        arrowEnds: 'none',
        strokeColor: RULE,
        strokeWidth: 1.5,
        strokeStyle: 'dashed',
        ...SCAFFOLD,
      });
    from = stage.to;
  }
  return out;
}

// The y axis (an arrow up the map's left edge, Visible at its head and Invisible at its foot, its title turned to
// read up it) and the x axis (an arrow along the foot, Evolution under it).
function axes(x0: number, mapX: number, mapY: number): Element[] {
  const foot = mapY + MAP_H;
  // Mid slate: it reads on a light canvas and a dark one.
  const axis = { strokeColor: MUTED, strokeWidth: 2, ...SCAFFOLD } as const;
  return [
    { ...createArrow(mapX, foot, mapX, mapY - 6), arrowEnds: 'to', ...axis },
    { ...createArrow(mapX, foot, mapX + MAP_W + 6, foot), arrowEnds: 'to', ...axis },
    {
      ...createText(x0 + 24 - MAP_H / 2, mapY + MAP_H / 2 - 16),
      width: MAP_H,
      height: 32,
      label: 'Value chain',
      textSize: 'md',
      textBold: true,
      rotation: -90,
      ...SCAFFOLD,
    },
    {
      ...createText(x0 + 16, mapY + 4),
      width: GUTTER - 26,
      height: 22,
      label: 'Visible',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'right',
      ...SCAFFOLD,
    },
    {
      ...createText(x0 + 16, foot - 26),
      width: GUTTER - 26,
      height: 22,
      label: 'Invisible',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'right',
      ...SCAFFOLD,
    },
    {
      ...createText(mapX, foot + 66),
      width: MAP_W,
      height: 30,
      label: 'Evolution  →',
      textSize: 'md',
      textBold: true,
      ...SCAFFOLD,
    },
  ];
}

type At = (evolution: number, visibility: number) => { x: number; y: number };

// Every component as a chip centred on its place: white paper and ink, locked so it reads on every canvas.
function chips(at: At): Map<string, ShapeElement> {
  const out = new Map<string, ShapeElement>();
  for (const c of WARDLEY_COMPONENTS) {
    const { x, y } = at(c.evolution, c.visibility);
    const w = chipW(c.label);
    out.set(c.id, {
      ...createShape('stadium', Math.round(x - w / 2), Math.round(y - CHIP_H / 2)),
      width: w,
      height: CHIP_H,
      label: c.label,
      textSize: 'sm',
      textColor: INK,
      fillColor: PAPER,
      strokeColor: c.id === 'need' ? INK : INK_SOFT,
      strokeWidth: c.id === 'need' ? 'thick' : 'medium',
      themeLockFill: true,
      ...CONTENT,
    });
  }
  return out;
}

const centre = (el: { x: number; y: number; width: number; height: number }) => ({
  x: el.x + el.width / 2,
  y: el.y + el.height / 2,
});

// The anchor: the user over their need, joined by a line.
function anchor(at: At, needChip: ShapeElement): Element[] {
  const need = WARDLEY_COMPONENTS.find((c) => c.id === 'need')!;
  const { x } = at(need.evolution, 1);
  const { y } = at(0, 1);
  const user: ShapeElement = {
    ...createShape('actor', Math.round(x - 18), y + 4),
    width: 36,
    height: 48,
    label: '',
    strokeColor: INK,
    ...CONTENT,
  };
  return [
    user,
    {
      ...createPinnedArrow(user.id, 's', needChip.id, 'n'),
      arrowEnds: 'none',
      strokeColor: LINE,
      strokeWidth: 1.5,
      ...CONTENT,
    },
    {
      ...createText(Math.round(x + 26), y + 14),
      width: 200,
      height: 28,
      label: WARDLEY_USER,
      textSize: 'sm',
      textBold: true,
      textColor: INK,
      textAlignX: 'left',
      ...CONTENT,
    },
  ];
}

// What needs what: plain lines from the facing sides, no arrowheads (Wardley draws needs so).
function needs(components: Map<string, ShapeElement>): Element[] {
  return WARDLEY_NEEDS.map(([from, to]) => {
    const a = components.get(from)!;
    const b = components.get(to)!;
    return {
      ...createPinnedArrow(
        a.id,
        anchorToward(centre(a), centre(b)),
        b.id,
        anchorToward(centre(b), centre(a)),
      ),
      arrowEnds: 'none',
      strokeColor: LINE,
      strokeWidth: 1.5,
      ...CONTENT,
    };
  });
}

// Each movement: a hollow dashed ghost where the component is heading, a dashed red arrow to it, captioned.
function movements(components: Map<string, ShapeElement>, at: At): Element[] {
  const out: Element[] = [];
  for (const c of WARDLEY_COMPONENTS) {
    if (!c.heading) continue;
    const chip = components.get(c.id)!;
    const to = at(c.heading.evolution, c.visibility);
    const ghost: ShapeElement = {
      ...createShape('circle', Math.round(to.x - GHOST / 2), Math.round(to.y - GHOST / 2)),
      width: GHOST,
      height: GHOST,
      label: '',
      fillColor: PAPER,
      strokeColor: MOVE,
      strokeWidth: 'medium',
      strokeStyle: 'dashed',
      themeLockFill: true,
      ...CONTENT,
    };
    out.push(ghost, {
      ...createPinnedArrow(chip.id, 'e', ghost.id, 'w'),
      label: c.heading.caption,
      strokeColor: MOVE,
      arrowheadColor: MOVE,
      strokeWidth: 2.5,
      strokeStyle: 'dashed',
      routeBehind: false,
      ...CONTENT,
    });
  }
  return out;
}

// A thick bar in front of a component held back by inertia, its cause under it.
function inertia(components: Map<string, ShapeElement>): Element[] {
  const out: Element[] = [];
  for (const c of WARDLEY_COMPONENTS) {
    if (!c.inertia) continue;
    const chip = components.get(c.id)!;
    const x = chip.x + chip.width + 16;
    out.push(
      {
        ...createShape('square', x, chip.y - 8),
        width: 10,
        height: CHIP_H + 16,
        label: '',
        fillColor: INERTIA,
        strokeColor: INERTIA,
        themeLockFill: true,
        ...CONTENT,
      },
      {
        ...createText(x - 24, chip.y - 34),
        width: 230,
        height: 22,
        label: `Inertia: ${c.inertia.toLowerCase()}`,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
        ...CONTENT,
      },
    );
  }
  return out;
}

// A red numbered marker on each play's component, attached to its top-right corner so it travels with it.
function plays(components: Map<string, ShapeElement>): Element[] {
  return WARDLEY_COMPONENTS.flatMap((c): Element[] => {
    if (!c.play) return [];
    const chip = components.get(c.id)!;
    return [
      {
        ...createShape('step', chip.x + chip.width - STEP / 2, chip.y - STEP / 2),
        width: STEP,
        height: STEP,
        label: String(c.play),
        textBold: true,
        chipLook: 'solid',
        fillColor: MOVE,
        strokeColor: MOVE,
        textColor: PAPER,
        themeLockFill: true,
        attachedTo: chip.id,
        attachAt: 'top-right',
        ...CONTENT,
      },
    ];
  });
}

// Beside the map: the plays spelt out, the questions to ask of a map, and the legend.
function panel(x: number, y: number): Element[] {
  const out: Element[] = [...sectionHeading(x, y, SIDE_W, 'flag', 'Plays', 'What we do next')];
  const cardH = 96;
  let top = y + SECTION_H + 12;
  WARDLEY_PLAYS.forEach((p, i) => {
    out.push(
      {
        ...createShape('square', x, top),
        width: SIDE_W,
        height: cardH,
        label: '',
        fillColor: '#fef2f2',
        strokeColor: '#fecaca',
        borderRadius: 'md',
        themeLockFill: true,
        ...CONTENT,
      },
      {
        ...createShape('step', x + 16, top + 16),
        width: STEP,
        height: STEP,
        label: String(i + 1),
        textBold: true,
        chipLook: 'solid',
        fillColor: MOVE,
        strokeColor: MOVE,
        textColor: PAPER,
        themeLockFill: true,
        ...CONTENT,
      },
      {
        ...createText(x + 60, top + 12),
        width: SIDE_W - 76,
        height: 28,
        label: p.verb,
        textSize: 'md',
        textBold: true,
        textColor: '#991b1b',
        textAlignX: 'left',
        ...CONTENT,
      },
      {
        ...createText(x + 60, top + 40),
        width: SIDE_W - 76,
        height: cardH - 48,
        label: p.text,
        textSize: 'sm',
        textColor: INK,
        textAlignX: 'left',
        textAlignY: 'top',
        ...CONTENT,
      },
    );
    top += cardH + 12;
  });
  top += 20;
  out.push(...sectionHeading(x, top, SIDE_W, 'help-circle', 'Questions', 'Ask them often'));
  top += SECTION_H + 8;
  const checksH = WARDLEY_QUESTIONS.length * 32 + 24;
  out.push({
    ...createShape('checklist', x, top),
    width: SIDE_W,
    height: checksH,
    checklistItems: WARDLEY_QUESTIONS.map((q) => ({ text: q.text, done: !!q.done })),
    // Its own paper and ink, so it reads the same on a dark canvas.
    fillColor: PAPER,
    strokeColor: '#cbd5e1',
    textColor: INK,
    themeLockFill: true,
    ...CONTENT,
  });
  top += checksH + 28;
  out.push(...sectionHeading(x, top, SIDE_W, 'map', 'Key', 'How to read it'));
  top += SECTION_H + 8;
  out.push(...legend(x, top));
  return out;
}

// The notation, one row each: a component, a need, a movement, inertia and a play.
function legend(x: number, y: number): Element[] {
  const rowH = 40;
  const sampleW = 96;
  const textX = x + sampleW + 20;
  const rows = [
    'Component',
    'Needs (a line to what it depends on)',
    'Evolving to',
    'Inertia',
    'Play',
  ];
  const out: Element[] = rows.map((label, i) => ({
    ...createText(textX, y + i * rowH),
    width: SIDE_W - sampleW - 20,
    height: rowH,
    label,
    textSize: 'sm',
    textAlignX: 'left' as const,
    ...SCAFFOLD,
  }));
  const mid = (i: number) => y + i * rowH + rowH / 2;
  out.push(
    {
      ...createShape('stadium', x, mid(0) - 13),
      width: sampleW,
      height: 26,
      label: 'Name',
      textSize: 'sm',
      textColor: INK,
      fillColor: PAPER,
      strokeColor: INK_SOFT,
      themeLockFill: true,
      ...SCAFFOLD,
    },
    {
      ...createArrow(x, mid(1), x + sampleW, mid(1)),
      arrowEnds: 'none',
      strokeColor: LINE,
      strokeWidth: 1.5,
      ...SCAFFOLD,
    },
    {
      ...createArrow(x, mid(2), x + sampleW, mid(2)),
      strokeColor: MOVE,
      arrowheadColor: MOVE,
      strokeWidth: 2.5,
      strokeStyle: 'dashed',
      ...SCAFFOLD,
    },
    {
      ...createShape('square', x + sampleW / 2 - 5, mid(3) - 15),
      width: 10,
      height: 30,
      label: '',
      fillColor: INERTIA,
      strokeColor: INERTIA,
      themeLockFill: true,
      ...SCAFFOLD,
    },
    {
      ...createShape('step', x + sampleW / 2 - 13, mid(4) - 13),
      width: 26,
      height: 26,
      label: '1',
      textBold: true,
      chipLook: 'solid',
      fillColor: MOVE,
      strokeColor: MOVE,
      textColor: PAPER,
      themeLockFill: true,
      ...SCAFFOLD,
    },
  );
  return out;
}
