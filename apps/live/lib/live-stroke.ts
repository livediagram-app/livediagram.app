// The stroke being drawn with a whiteboard pen (docs/specs/023-whiteboard/whiteboard.md "Pens";
// blueprint whiteboard-round-one "Live stroke pipeline"). One object per stroke, made on the press:
// its smoother (the pure pipeline in @livediagram/document) and the subscribers that draw it, so the
// input handler can push samples and have the ink redrawn at once, without a React render.

import {
  STROKE_SMOOTHING,
  createStrokeSmoother,
  strokePointerKind,
  type StrokePointerKind,
  type StrokeSmoother,
} from '@livediagram/document';

export type LiveStroke = {
  readonly smoother: StrokeSmoother;
  readonly pointer: StrokePointerKind;
  /** The pointer that started the stroke; undefined when the press did not say. */
  readonly pointerId: number | undefined;
  /** Calls `listener` on every `notify()` until the returned function is called. */
  subscribe(listener: () => void): () => void;
  /** Tells the subscribers the stroke changed: once per input event, after its samples. */
  notify(): void;
};

/** A live stroke for a press by `pointerType` at `zoom` (the zoom scales its screen-px settings). */
export function createLiveStroke(
  pointerType: string | undefined,
  pointerId: number | undefined,
  zoom: number,
): LiveStroke {
  const pointer = strokePointerKind(pointerType);
  const listeners = new Set<() => void>();
  return {
    smoother: createStrokeSmoother(STROKE_SMOOTHING[pointer], zoom),
    pointer,
    pointerId,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of listeners) listener();
    },
  };
}

/**
 * Every sample the browser gathered for this move (`getCoalescedEvents`), or the event itself where
 * the method is missing (insecure contexts, older engines) or returns nothing.
 */
export function coalescedSamples(e: PointerEvent): PointerEvent[] {
  const samples = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
  return samples.length > 0 ? samples : [e];
}

/** An event's time in ms on the page clock, or now when it carries none. */
export function eventTime(e: { timeStamp?: number }): number {
  return typeof e.timeStamp === 'number' && Number.isFinite(e.timeStamp)
    ? e.timeStamp
    : performance.now();
}
