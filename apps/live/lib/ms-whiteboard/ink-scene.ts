// Ink groups to scene ink (docs/specs/020-import-export/blueprints/ms-whiteboard-import.md "To
// scene"): each stroke placed by its group's position, scale and rotation, its pressure kept, its
// colour normalised; preset inks carry their colour stops; an arrowhead is its own small stroke.
import type { SceneAppearance, SceneColour, SceneInk, ScenePoint } from '@/lib/board-scene/scene';
import { lineColour } from './colours';
import type { WbInk, WbStroke } from './elements';
import type { PenStroke } from './pen-stroke';

// The preset inks' colours, measured on real boards' screenshots: rainbow spreads its spectrum
// left to right, galaxy blends purple into teal.
export const RAINBOW_STOPS: readonly SceneColour[] = [
  '#e71224',
  '#f6630c',
  '#ffc114',
  '#02a556',
  '#0069bf',
  '#8a2be2',
].map((hex) => ({ hex }));
export const GALAXY_STOPS: readonly SceneColour[] = ['#881f7c', '#3a9fb4'].map((hex) => ({ hex }));

export type InkNotes = { invisible: number; unreadable: number };

type Context = { appearance: SceneAppearance; background?: SceneColour; notes: InkNotes };

function rotateAbout(points: ScenePoint[], deg: number, cx: number, cy: number): ScenePoint[] {
  if (!deg) return points;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { ...p, x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

function strokeColour(stroke: WbStroke, ctx: Context): SceneColour | 'ink' | 'skip' {
  if (stroke.preset === 'rainbow') return RAINBOW_STOPS[0]!;
  if (stroke.preset === 'galaxy') return GALAXY_STOPS[0]!;
  return lineColour(stroke.colour ?? { hex: '#000000' }, ctx.appearance, ctx.background);
}

/** An ink group's strokes as scene ink, back to front; `key` prefixes each item's key. */
export function inkToScene(group: WbInk, key: string, ctx: Context): SceneInk[] {
  ctx.notes.unreadable += group.unreadable;
  // A stroke's points in canvas px: its origin and units, then the stroke's move and the group's
  // place and scale. An arrowhead is a stroke of its own, drawn with its stroke.
  const place = (s: WbStroke, pen: PenStroke): ScenePoint[] =>
    pen.points.map((p) => ({
      x: group.x + group.scale * (pen.originPx.x + p.x * pen.unitScale + s.dx),
      y: group.y + group.scale * (pen.originPx.y + p.y * pen.unitScale + s.dy),
      ...(p.p !== undefined ? { p: p.p } : {}),
    }));
  const widthOf = (s: WbStroke, pen: PenStroke) =>
    pen.width * pen.unitScale * group.scale * s.widthFactor;
  const placed = group.strokes.flatMap((s) => {
    ctx.notes.unreadable += s.unreadableArrowheads;
    return [s.stroke, ...s.arrowheads].map((pen, i) => ({
      stroke: s,
      head: i > 0,
      points: place(s, pen),
      widthPx: widthOf(s, pen),
    }));
  });
  let cx = 0;
  let cy = 0;
  if (group.rotationDeg) {
    const all = placed.flatMap((p) => p.points);
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  }
  const items: SceneInk[] = [];
  placed.forEach(({ stroke, head, points: raw, widthPx }, i) => {
    const colour = strokeColour(stroke, ctx);
    if (colour === 'skip') {
      ctx.notes.invisible++;
      return;
    }
    const points = rotateAbout(raw, group.rotationDeg, cx, cy);
    const multicolour =
      stroke.preset === 'rainbow'
        ? RAINBOW_STOPS
        : stroke.preset === 'galaxy'
          ? GALAXY_STOPS
          : null;
    const ink: SceneInk = {
      key: `${key}-${i}${head ? '-head' : ''}`,
      kind: 'ink',
      points: points.every((p) => p.p !== undefined)
        ? points
        : points.map(({ x, y }) => ({ x, y })),
      stroke: { colour, widthPx, ...(multicolour ? { stops: [...multicolour] } : {}) },
      ...(stroke.preset === 'highlighter' ? { highlighter: true } : {}),
    };
    items.push(ink);
  });
  return items;
}
