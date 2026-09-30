// Shape recognition on a whiteboard (docs/specs/023-whiteboard/whiteboard.md "Shape recognition"):
// the one test a stroke passes to become a clean shape, shared by the preview shown while the pen
// holds still and the commit on release, so the preview is exactly what lands.
import {
  penStrokeCentreline,
  recogniseShape,
  type PenStroke,
  type RecognisedShape,
} from '@livediagram/document';

type Point = { x: number; y: number };

// The Shape Pen's bar (docs/specs/008-canvas/two-pens.md): choosing recognition is the opt-in.
export const RECOGNITION_THRESHOLD = 0.4;
// How long the pen holds still, still pressed, before the shape shows: long enough that a
// pause mid-letter does not trigger it, short enough to feel like an answer. Procreate's
// QuickShape and GoodNotes' shape snapping sit around half a second.
export const RECOGNITION_PREVIEW_DWELL_MS = 500;
// "Still", in SCREEN px: a resting hand wobbles a little at any zoom.
export const RECOGNITION_PREVIEW_STILL_PX = 4;

/** The shape a pen stroke reads as, or null: read off its streamlined centre line. */
export function recogniseBoardStroke(stroke: PenStroke): RecognisedShape | null {
  const detected = recogniseShape(penStrokeCentreline(stroke));
  return detected && detected.confidence >= RECOGNITION_THRESHOLD ? detected : null;
}

/** Whether every sample from `from` up to `count` stays within the still radius of `anchor`, on screen. */
export function stillSince(
  sample: (i: number) => Point,
  from: number,
  count: number,
  anchor: Point,
  zoom: number,
): boolean {
  const r = RECOGNITION_PREVIEW_STILL_PX / (zoom || 1);
  for (let i = Math.max(0, from); i < count; i++) {
    const p = sample(i);
    if (Math.hypot(p.x - anchor.x, p.y - anchor.y) > r) return false;
  }
  return true;
}
