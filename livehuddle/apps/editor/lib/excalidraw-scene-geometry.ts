// Excalidraw linear geometry to absolute scene points: element-relative points offset by the
// element's position, its `angle` baked in about its centre (as Excalidraw draws it), and loop
// closure by where the ends lie.

import type { ScenePoint } from './board-scene/scene';
import type { ExcalidrawElement } from './excalidraw-types';

/** Ends this close are one point: our exporter repeats the first point exactly; 1 px is float noise. */
export const EXCALIDRAW_CLOSE_EPSILON_PX = 1;

const isFinitePair = (p: unknown): p is [number, number] =>
  Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * The element's points in canvas px. `pressures`, when given, attach per point (clamped to 0..1).
 * Malformed points are dropped.
 */
export function absolutePoints(el: ExcalidrawElement, pressures?: number[]): ScenePoint[] {
  const x = num(el.x);
  const y = num(el.y);
  const angle = num(el.angle);
  const cx = x + num(el.width) / 2;
  const cy = y + num(el.height) / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const out: ScenePoint[] = [];
  (Array.isArray(el.points) ? el.points : []).forEach((raw, i) => {
    if (!isFinitePair(raw)) return;
    let px = x + raw[0];
    let py = y + raw[1];
    if (angle !== 0) {
      const dx = px - cx;
      const dy = py - cy;
      px = cx + dx * cos - dy * sin;
      py = cy + dx * sin + dy * cos;
    }
    const point: ScenePoint = { x: px, y: py };
    const p = pressures?.[i];
    if (typeof p === 'number' && Number.isFinite(p)) point.p = Math.min(1, Math.max(0, p));
    out.push(point);
  });
  return out;
}

const coincide = (a: ScenePoint, b: ScenePoint) =>
  Math.hypot(a.x - b.x, a.y - b.y) <= EXCALIDRAW_CLOSE_EPSILON_PX;

/**
 * A loop: 3+ points whose ends coincide, the repeated end dropped. `force` closes regardless
 * (an Excalidraw polygon), still dropping a repeated end.
 */
export function closeIfLoop(
  points: ScenePoint[],
  force = false,
): { points: ScenePoint[]; closed: boolean } {
  const first = points[0];
  const last = points[points.length - 1];
  const repeats = points.length >= 3 && !!first && !!last && coincide(first, last);
  if (repeats) return { points: points.slice(0, -1), closed: true };
  return { points, closed: force };
}
