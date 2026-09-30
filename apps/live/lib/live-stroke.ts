// The stroke being drawn with a whiteboard pen (docs/specs/023-whiteboard/whiteboard.md "Pens";
// blueprint whiteboard-round-one "Pen ink"). One object per stroke, made on the press: its raw
// samples in canvas px (only exact repeats dropped, as Excalidraw does), a pressure per sample when
// the pointer is a pen, the streamline its pointer draws with, and the subscribers that draw it, so
// the input handler can add a sample and have the ink redrawn at once, without a React render.

import {
  PEN_STREAMLINE,
  penPointerKind,
  type PenPointerKind,
  type PenStroke,
  type RecognisedShape,
} from '@livediagram/document';
import { adjustRecognised } from './recognition-preview';

type Point = { x: number; y: number };

export type LiveStroke = {
  readonly pointer: PenPointerKind;
  /** The pointer that started the stroke; undefined when the press did not say. */
  readonly pointerId: number | undefined;
  readonly streamline: number;
  /** Raw samples, canvas px, append-only. */
  readonly points: readonly Point[];
  /** One per sample for a pen; null for a pointer without pressure (a constant width). */
  readonly pressures: readonly number[] | null;
  /** Adds a sample; false when it repeats the previous one exactly. */
  push(x: number, y: number, pressure?: number): boolean;
  /** The stroke as perfect-freehand input, for a pen of `width`. */
  ink(width: number): PenStroke;
  /** Calls `listener` on every `notify()` until the returned function is called. */
  subscribe(listener: () => void): () => void;
  /** Tells the subscribers the stroke changed: once per input event. */
  notify(): void;
  /**
   * Locks the stroke to the shape it was recognised as, with the pen where it is now: from then on
   * the stroke IS that shape, and dragging on reshapes it (docs/specs/023-whiteboard/whiteboard.md
   * "Shape recognition").
   */
  snapTo(shape: RecognisedShape): void;
  /** The locked shape as the pen has reshaped it so far; null until the stroke is locked. */
  shaped(): RecognisedShape | null;
};

/** A live stroke for a press by `pointerType`: a pen records pressure, anything else does not. */
export function createLiveStroke(
  pointerType: string | undefined,
  pointerId: number | undefined,
): LiveStroke {
  const pointer = penPointerKind(pointerType);
  const streamline = PEN_STREAMLINE[pointer];
  const points: Point[] = [];
  const pressures: number[] | null = pointer === 'pen' ? [] : null;
  const listeners = new Set<() => void>();
  let snap: { shape: RecognisedShape; grab: Point } | null = null;
  return {
    pointer,
    pointerId,
    streamline,
    points,
    pressures,
    push(x, y, pressure) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      const last = points[points.length - 1];
      if (last && last.x === x && last.y === y) return false;
      points.push({ x, y });
      if (pressures) {
        const p = pressure ?? pressures[pressures.length - 1] ?? 0.5;
        pressures.push(Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0.5)));
      }
      return true;
    },
    ink: (width) => ({ points, pressures: pressures ?? undefined, width, streamline }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of listeners) listener();
    },
    snapTo(shape) {
      const grab = points[points.length - 1];
      if (grab) snap = { shape, grab };
    },
    shaped() {
      const pointer = points[points.length - 1];
      return snap && pointer ? adjustRecognised(snap.shape, snap.grab, pointer) : null;
    },
  };
}
