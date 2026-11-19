// A figure cannot forget the `connector` mark (livehuddle's liveworkspace/docs/specs/016-help/help-centre.md "A figure cannot forget the
// mark", Work Tracker 790). livehuddle's help app draws no connector between elements (`stickyOnly`), and an `Arrow`
// is left out only when its scene marks it `connector`, by hand. This guard draws scenes with `Shape` and `Arrow`
// recorded (a test swaps them for `withRecording`'s), and finds every `Arrow` whose two ends each land on a different
// `Shape` and that is not marked: the arrow a sticky-only figure would still draw between two stickies. An arrow with an
// end in open space (a gesture trail, a step from one part of the interface to the next) or both ends on one shape is
// not a connector, so the guard never asks for those to go. An arrow between two shapes that is something else (a sync
// link from a cloud to the devices, a flow between two app windows) says so with `connector={false}`, written out.
//
// For tests only: it imports nothing from the primitives, so a test can mock them with it.

import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

type Point = [number, number];

/** A `Shape` as drawn: its box. */
export type DrawnShape = { x: number; y: number; w: number; h: number };
/** An `Arrow` as drawn: its two ends and its `connector` mark (undefined when the scene left it out). */
export type DrawnArrow = { from: Point; to: Point; connector?: boolean };

/** How far outside a shape's box an arrow's end may stop and still join it, in scene units. */
export const CONNECTOR_REACH = 8;

// `Shape`'s own defaults (primitives-canvas.tsx), for a scene that leaves them out.
const SHAPE_W = 72;
const SHAPE_H = 44;

let drawn: { shapes: DrawnShape[]; arrows: DrawnArrow[] } = { shapes: [], arrows: [] };

type Props = Record<string, unknown>;
type Primitives = { Shape: ComponentType<never>; Arrow: ComponentType<never> };

/** `actual` (the primitives module) with `Shape` and `Arrow` noting what they draw, for a test's `vi.mock`. */
export function withRecording<M extends Primitives>(actual: M): M {
  const Shape = actual.Shape as unknown as ComponentType<Props>;
  const Arrow = actual.Arrow as unknown as ComponentType<Props>;
  const RecordedShape = (props: Props) => {
    drawn.shapes.push({
      x: props.x as number,
      y: props.y as number,
      w: (props.w as number | undefined) ?? SHAPE_W,
      h: (props.h as number | undefined) ?? SHAPE_H,
    });
    return createElement(Shape, props);
  };
  const RecordedArrow = (props: Props) => {
    drawn.arrows.push({
      from: props.from as Point,
      to: props.to as Point,
      ...(typeof props.connector === 'boolean' ? { connector: props.connector } : {}),
    });
    return createElement(Arrow, props);
  };
  return { ...actual, Shape: RecordedShape, Arrow: RecordedArrow };
}

// The shape an end lands on: the index of the nearest whose box is within the reach of it (0 inside it); -1 for open
// space. The nearest, so a short arrow between two close shapes lands on both rather than twice on the first.
function shapeAt([px, py]: Point, shapes: readonly DrawnShape[]): number {
  let best = -1;
  let bestDistance = Infinity;
  shapes.forEach((s, i) => {
    const dx = Math.max(s.x - px, 0, px - (s.x + s.w));
    const dy = Math.max(s.y - py, 0, py - (s.y + s.h));
    const distance = Math.hypot(dx, dy);
    if (distance <= CONNECTOR_REACH && distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

/** The arrows that join two different shapes and say neither `connector` nor `connector={false}`. */
export function unmarkedConnectors(
  shapes: readonly DrawnShape[],
  arrows: readonly DrawnArrow[],
): DrawnArrow[] {
  return arrows.filter((a) => {
    if (a.connector !== undefined) return false;
    const from = shapeAt(a.from, shapes);
    const to = shapeAt(a.to, shapes);
    return from >= 0 && to >= 0 && from !== to;
  });
}

/** One unmarked connector found in a scene. */
export type ConnectorFinding = { scene: string; from: Point; to: Point };

/**
 * Draws every component each module exports (a capitalised function, given no props) with the recording primitives,
 * and answers how many drew at least one shape and every unmarked connector among them. A component that needs props
 * and throws without them is skipped; the scenes and figures need none.
 */
export function scanScenes(modules: Record<string, Record<string, unknown>>): {
  scanned: number;
  findings: ConnectorFinding[];
} {
  let scanned = 0;
  const findings: ConnectorFinding[] = [];
  for (const [file, exports] of Object.entries(modules)) {
    for (const [name, value] of Object.entries(exports)) {
      if (typeof value !== 'function' || !/^[A-Z]/.test(name)) continue;
      drawn = { shapes: [], arrows: [] };
      try {
        renderToStaticMarkup(createElement(value as ComponentType));
      } catch {
        continue;
      }
      if (drawn.shapes.length === 0) continue;
      scanned++;
      for (const a of unmarkedConnectors(drawn.shapes, drawn.arrows))
        findings.push({ scene: `${file} ${name}`, from: a.from, to: a.to });
    }
  }
  return { scanned, findings };
}
