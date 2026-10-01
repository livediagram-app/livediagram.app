// Compact output (docs/specs/020-import-export/board-scene.md "Compact output"): a landed board
// writes no more than the drawing needs. A stroke's points are the stroke points codec's own
// (packFreehandPoints quantises them, docs/specs/006-document/stroke-points.md), and the landing
// writes no field at its default; what is left here is the boxes and arrow ends, kept to a
// hundredth of a canvas px rather than a full double.
import type { Element } from '@livediagram/document';

// Boxes, free arrow ends and arrow bends: 0.005 px at most.
export const BOX_DECIMALS = 2;

/** `v` to `d` decimals, half away from zero, never -0. */
export function roundTo(v: number, d: number): number {
  const f = 10 ** d;
  const r = (Math.sign(v) * Math.round(Math.abs(v) * f)) / f;
  return r === 0 ? 0 : r;
}

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

/** One landed element written compactly; the drawing is unchanged within 0.005 px. */
export function compactElement(el: Element): Element {
  if (el.type === 'arrow') {
    const end = (e: typeof el.from) =>
      e.kind === 'free'
        ? { ...e, x: roundTo(e.x, BOX_DECIMALS), y: roundTo(e.y, BOX_DECIMALS) }
        : e;
    return {
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
    };
  }
  // A stroke's box is the codec's (whole canvas px): its block is laid out in exactly that box.
  if (el.type === 'freehand') return el;
  return 'x' in el && 'width' in el ? roundBox(el as Element & Boxed) : el;
}

/** Every landed element written compactly. */
export function compactLanded(elements: readonly Element[]): Element[] {
  return elements.map(compactElement);
}
