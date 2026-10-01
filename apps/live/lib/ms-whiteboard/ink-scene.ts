// Ink groups to scene ink (docs/specs/020-import-export/blueprints/ms-whiteboard-import.md "To
// scene"): each stroke placed by its group's position, scale and rotation, its pressure kept, its
// colour normalised; preset inks carry their colour stops; an arrowhead is redrawn as an open V.
import type { SceneAppearance, SceneColour, SceneInk, ScenePoint } from '@/lib/board-scene/scene';
import { lineColour } from './colours';
import type { WbInk, WbStroke } from './elements';

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

// The redrawn arrowhead: arms this many stroke widths long, this far either side of the line,
// along the direction of the stroke's last few px (ignoring the pen's final wobble).
export const ARROWHEAD_LENGTH_FACTOR = 4;
export const ARROWHEAD_ANGLE_DEG = 30;
export const ARROWHEAD_TANGENT_PX = 6;

export type InkNotes = { invisible: number; arrowheads: number; unreadable: number };

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

/** An open V at the end of `points`, or null when the stroke has no direction. */
export function arrowheadAt(points: readonly ScenePoint[], widthPx: number): ScenePoint[] | null {
  const tip = points[points.length - 1];
  if (!tip) return null;
  let from: ScenePoint | undefined;
  for (let i = points.length - 2; i >= 0; i--) {
    from = points[i];
    if (Math.hypot(tip.x - from!.x, tip.y - from!.y) >= ARROWHEAD_TANGENT_PX) break;
  }
  if (!from || (from.x === tip.x && from.y === tip.y)) return null;
  const back = Math.atan2(from.y - tip.y, from.x - tip.x);
  const length = ARROWHEAD_LENGTH_FACTOR * widthPx;
  const arm = (side: number) => {
    const a = back + (side * ARROWHEAD_ANGLE_DEG * Math.PI) / 180;
    return { x: tip.x + Math.cos(a) * length, y: tip.y + Math.sin(a) * length };
  };
  return [arm(1), { x: tip.x, y: tip.y }, arm(-1)];
}

function strokeColour(stroke: WbStroke, ctx: Context): SceneColour | 'ink' | 'skip' {
  if (stroke.preset === 'rainbow') return RAINBOW_STOPS[0]!;
  if (stroke.preset === 'galaxy') return GALAXY_STOPS[0]!;
  return lineColour(stroke.colour ?? { hex: '#000000' }, ctx.appearance, ctx.background);
}

/** An ink group's strokes as scene ink, back to front; `key` prefixes each item's key. */
export function inkToScene(group: WbInk, key: string, ctx: Context): SceneInk[] {
  ctx.notes.unreadable += group.unreadable;
  const placed = group.strokes.map((s) => ({
    stroke: s,
    points: s.stroke.points.map<ScenePoint>((p) => ({
      x: group.x + group.scale * (p.x * s.stroke.unitScale + s.dx),
      y: group.y + group.scale * (p.y * s.stroke.unitScale + s.dy),
      ...(p.p !== undefined ? { p: p.p } : {}),
    })),
    widthPx: s.stroke.width * s.stroke.unitScale * group.scale * s.widthFactor,
  }));
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
  placed.forEach(({ stroke, points: raw, widthPx }, i) => {
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
      key: `${key}-${i}`,
      kind: 'ink',
      points: points.every((p) => p.p !== undefined)
        ? points
        : points.map(({ x, y }) => ({ x, y })),
      stroke: { colour, widthPx, ...(multicolour ? { stops: [...multicolour] } : {}) },
      ...(stroke.preset === 'highlighter' ? { highlighter: true } : {}),
    };
    items.push(ink);
    if (stroke.arrowhead) {
      const head = arrowheadAt(points, widthPx);
      if (head) {
        ctx.notes.arrowheads++;
        items.push({
          key: `${key}-${i}-head`,
          kind: 'ink',
          points: head,
          stroke: { ...ink.stroke },
        });
      }
    }
  });
  return items;
}
