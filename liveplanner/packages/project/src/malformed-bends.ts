// An arrow's bends that are not bends, dropped where stored elements enter (./stored-elements): from
// storage, a peer, a paste, a file or an agent's write. Every arrow renderer (the canvas, every
// export, the lint and the agents' views) walks `curvePoints` as a list of { dx, dy } and reads the
// two offsets' dx and dy, so a list that is not one, or a point without finite deltas, threw in all
// of them. The arrow then draws with its default bend, as if it had none
// (docs/specs/008-canvas/arrow-bending.md "Stored bends").

import type { Element } from './index';
import { isRecord } from '@liveworkspace/document-core/is-record';
/** The most bend points an arrow holds: far past any drawn curve, short of an abuse payload. */
export const MAX_CURVE_POINTS = 5_000;

/** Whether a value is one bend: finite dx and dy. */
export function isBendDelta(v: unknown): v is { dx: number; dy: number } {
  return isRecord(v) && Number.isFinite(v.dx) && Number.isFinite(v.dy);
}

/** Whether a value is an arrow's bend points: at most MAX_CURVE_POINTS bends. */
export function isCurvePoints(v: unknown): v is { dx: number; dy: number }[] {
  return Array.isArray(v) && v.length <= MAX_CURVE_POINTS && v.every(isBendDelta);
}

const BEND_FIELDS = [
  ['curvePoints', isCurvePoints],
  ['curveOffset', isBendDelta],
  ['elbowOffset', isBendDelta],
] as const;

/** The elements with every malformed bend field taken off their arrows; the same array when none
 *  had one. */
export function dropMalformedBends(elements: Element[]): Element[] {
  let out: Element[] | null = null;
  elements.forEach((el, i) => {
    if (el.type !== 'arrow') return;
    const raw = el as unknown as Record<string, unknown>;
    const bad = BEND_FIELDS.filter(([k, ok]) => raw[k] !== undefined && !ok(raw[k]));
    if (bad.length === 0) return;
    const next = { ...raw };
    for (const [k] of bad) delete next[k];
    out ??= elements.slice();
    out[i] = next as unknown as Element;
  });
  return out ?? elements;
}
