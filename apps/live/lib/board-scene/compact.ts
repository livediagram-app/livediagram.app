// Compact output (docs/specs/020-import-export/board-scene.md "Compact output"): a landed board
// writes no more than the drawing needs, so a board of thousands of strokes fits one tab. Points
// are rounded to the error nobody can see at each element's own size, pressures to a thousandth,
// boxes to a hundredth of a pixel, and no field the renderer would read as its default anyway.
import type { Element, PathPoint } from '@livediagram/document';

// The largest position error rounding may add, in canvas px: a twentieth of a pixel stays under a
// screen pixel at the canvas's 5x zoom ceiling. Safe range 0.01 to 0.2.
export const LANDED_POINT_TOLERANCE_PX = 0.05;
// More decimals than a double carries meaningfully at any canvas size.
export const MAX_POINT_DECIMALS = 12;
// Pens report pressure in steps of 1/1024 at best.
export const PRESSURE_DECIMALS = 3;
// Boxes and free arrow ends: 0.005 px.
export const BOX_DECIMALS = 2;

/** `v` to `d` decimals, half away from zero, never -0. */
export function roundTo(v: number, d: number): number {
  const f = 10 ** d;
  const r = (Math.sign(v) * Math.round(Math.abs(v) * f)) / f;
  return r === 0 ? 0 : r;
}

const within = (d: number, size: number) => 0.5 * 10 ** -d * size <= LANDED_POINT_TOLERANCE_PX;

/**
 * The fewest decimals a normalised coordinate needs so that, at an element `size` px across, its
 * rounding moves the point by at most LANDED_POINT_TOLERANCE_PX.
 */
export function pointDecimals(size: number): number {
  if (!Number.isFinite(size)) return MAX_POINT_DECIMALS;
  if (size <= 0) return 0;
  let d = Math.max(0, Math.ceil(Math.log10(size / (2 * LANDED_POINT_TOLERANCE_PX))));
  // log10 can land a hair either side of an exact power: settle on the fewest that hold.
  while (d > 0 && within(d - 1, size)) d--;
  while (d < MAX_POINT_DECIMALS && !within(d, size)) d++;
  return Math.min(d, MAX_POINT_DECIMALS);
}

const roundPoint = <P extends PathPoint>(p: P, d: number): P => ({
  ...p,
  nx: roundTo(p.nx, d),
  ny: roundTo(p.ny, d),
});

type Boxed = { x: number; y: number; width: number; height: number };

function roundBox<T extends Boxed>(el: T): T {
  return {
    ...el,
    x: roundTo(el.x, BOX_DECIMALS),
    y: roundTo(el.y, BOX_DECIMALS),
    width: roundTo(el.width, BOX_DECIMALS),
    height: roundTo(el.height, BOX_DECIMALS),
  };
}

// Fields the renderer reads as these values when absent: writing them changes nothing drawn.
function dropDefaults<T extends Element>(el: T): T {
  const out = { ...el } as Record<string, unknown>;
  if (out.opacity === 1) delete out.opacity;
  if (el.type === 'freehand' && out.streamline === 0) delete out.streamline;
  return out as T;
}

/** One landed element written compactly; the drawing is unchanged within the tolerance. */
export function compactElement(el: Element): Element {
  if (el.type === 'arrow') {
    const end = (e: typeof el.from) =>
      e.kind === 'free'
        ? { ...e, x: roundTo(e.x, BOX_DECIMALS), y: roundTo(e.y, BOX_DECIMALS) }
        : e;
    return dropDefaults({
      ...el,
      from: end(el.from),
      to: end(el.to),
      ...(el.curvePoints
        ? {
            curvePoints: el.curvePoints.map((c) => ({
              dx: roundTo(c.dx, BOX_DECIMALS),
              dy: roundTo(c.dy, BOX_DECIMALS),
            })),
          }
        : {}),
    });
  }
  if (el.type === 'freehand') {
    // The decimals follow the size the points are drawn at, read before the box is rounded.
    const d = pointDecimals(Math.max(el.width, el.height));
    return dropDefaults({
      ...roundBox(el),
      points: el.points.map((p) => roundPoint(p, d)),
      ...(el.pressures
        ? { pressures: el.pressures.map((p) => roundTo(p, PRESSURE_DECIMALS)) }
        : {}),
    });
  }
  if (el.type === 'path') {
    const d = pointDecimals(Math.max(el.width, el.height));
    return dropDefaults({
      ...roundBox(el),
      nodes: el.nodes.map((n) => ({
        ...roundPoint(n, d),
        ...(n.handleIn ? { handleIn: roundPoint(n.handleIn, d) } : {}),
        ...(n.handleOut ? { handleOut: roundPoint(n.handleOut, d) } : {}),
      })),
    });
  }
  return 'x' in el && 'width' in el
    ? dropDefaults(roundBox(el as Element & Boxed))
    : dropDefaults(el);
}

/** Every landed element written compactly. */
export function compactLanded(elements: readonly Element[]): Element[] {
  return elements.map(compactElement);
}
