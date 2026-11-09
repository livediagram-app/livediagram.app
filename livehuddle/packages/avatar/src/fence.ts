// Fence (docs/specs/009-elements/fence.md): the geometry of the one straight run an element draws.
//
// Both renderers paint a fence from `fenceParts` (the editor's FenceView and the headless
// svg-render-faces), and Avatar mode blocks characters on `fenceLine`, so the posts you see and the
// line you bump into are worked out in one place. Pure: no React, no DOM, safe in a worker.

export type FencePoint = { x: number; y: number };

type FenceBox = { x: number; y: number; width: number; height: number; rotation?: number };

// A new fence: a short run across the canvas, thin enough to read as a barrier.
export const FENCE_DEFAULT_SIZE = { width: 240, height: 24 };

// Roughly how far apart the posts stand along the run, in canvas px. The real spacing is stretched
// so the posts divide the run evenly, end post to end post.
export const FENCE_POST_SPACING = 40;

// Post and rail sizes as fractions of the fence's thickness (its shorter side), so a fence drawn
// thicker draws chunkier timber rather than the same thin lines in a wider box.
const FENCE_POST_WIDTH = 0.5;
const FENCE_RAIL_HEIGHT = 0.16;
// Where each rail's top edge sits, across the thickness.
const FENCE_RAIL_TOPS = [0.26, 0.58] as const;
// The rails sit behind the posts, a shade lighter, so the posts read as the uprights.
export const FENCE_RAIL_OPACITY = 0.78;

// An unstyled fence's colour: a wood brown on light paper, a lighter one on dark paper.
export const FENCE_WOOD = { light: '#8a5a33', dark: '#c08a5b' } as const;

/**
 * Which way the run goes and how big it is. The run lies along the longer side: a wide fence runs
 * across, a tall one runs down, and a square one runs across.
 */
export function fenceRun(box: { width: number; height: number }): {
  horizontal: boolean;
  length: number;
  thickness: number;
} {
  const horizontal = box.width >= box.height;
  return {
    horizontal,
    length: horizontal ? box.width : box.height,
    thickness: horizontal ? box.height : box.width,
  };
}

/**
 * Where the posts stand along the run, from its start. The end posts sit half the thickness in from
 * each end, so two fences whose boxes share a corner put their end posts on the same spot.
 */
export function fencePostCentres(length: number, thickness: number): number[] {
  const inset = Math.min(thickness / 2, length / 2);
  const span = length - inset * 2;
  if (span <= 0) return [length / 2];
  const gaps = Math.max(1, Math.round(span / FENCE_POST_SPACING));
  return Array.from({ length: gaps + 1 }, (_, i) => inset + (span * i) / gaps);
}

type FencePart = {
  role: 'post' | 'rail';
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
};

/**
 * The drawing, in the element's own box (0,0 at its top-left), rails first so the posts paint over
 * them. The rails run the full length, end to end, so a fence placed against the end of another
 * carries its rails straight on.
 */
export function fenceParts(width: number, height: number): FencePart[] {
  const { horizontal, length, thickness } = fenceRun({ width, height });
  const parts: FencePart[] = [];
  // Built along a horizontal run, then turned onto the vertical one by swapping axes.
  const place = (along: number, across: number, alongSize: number, acrossSize: number) =>
    horizontal
      ? { x: along, y: across, width: alongSize, height: acrossSize }
      : { x: across, y: along, width: acrossSize, height: alongSize };
  const railHeight = thickness * FENCE_RAIL_HEIGHT;
  for (const top of FENCE_RAIL_TOPS) {
    parts.push({
      role: 'rail',
      ...place(0, thickness * top, length, railHeight),
      rx: railHeight / 2,
    });
  }
  const postWidth = thickness * FENCE_POST_WIDTH;
  for (const centre of fencePostCentres(length, thickness)) {
    parts.push({
      role: 'post',
      ...place(centre - postWidth / 2, 0, postWidth, thickness),
      rx: postWidth * 0.2,
    });
  }
  return parts;
}

/**
 * The line a fence blocks, in canvas coordinates: the centre line along the run, end to end, turned
 * with the element's rotation (clockwise degrees about the box centre, as the canvas draws it).
 */
export function fenceLine(box: FenceBox): { a: FencePoint; b: FencePoint } {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const { horizontal, length } = fenceRun(box);
  const half = length / 2;
  const ends: [FencePoint, FencePoint] = horizontal
    ? [
        { x: -half, y: 0 },
        { x: half, y: 0 },
      ]
    : [
        { x: 0, y: -half },
        { x: 0, y: half },
      ];
  const turn = ((box.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const [a, b] = ends.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
  return { a: a!, b: b! };
}
