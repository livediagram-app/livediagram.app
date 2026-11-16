// What a recording writes down besides its sound (liveworkspace/docs/specs/006-media/walkthroughs.md "The events"): the
// camera and the pointer sampled at most every SAMPLE_MS, presses, tabs and slides as they happen. A sample that
// arrives too soon waits as the pending one, so the last position before a pause is always kept (`tick` writes it).
// A hidden element is never written: a press on one is dropped, and the pointer over one reads as off the canvas.

import { WALKTHROUGH_EVENTS_MAX, type WalkthroughEvent } from '@liveworkspace/media/walkthrough';
import type { Point, RecordedView } from './timeline';

/** The least gap between two camera or two pointer samples: ten a second, about 25 KB a minute moving. */
export const SAMPLE_MS = 100;

type Sampled<T> = { last: number; pending: { t: number; value: T } | null; sent: string };

export type EventLog = {
  view: (now: number, view: RecordedView) => void;
  cursor: (now: number, at: Point | null) => void;
  point: (now: number, id: string) => void;
  tab: (now: number, tab: string) => void;
  slide: (now: number, slide: string | null, label?: string) => void;
  /** Writes a sample that has waited long enough. Called on the recording's clock. */
  tick: (now: number) => void;
  /** Whether the log is at its most events (the recording stops writing; the sound goes on). */
  full: () => boolean;
  /** Every event, pending samples written, in time order relative to the start. */
  finish: () => WalkthroughEvent[];
};

export function createEventLog(start: number, hidden: () => ReadonlySet<string>): EventLog {
  const events: WalkthroughEvent[] = [];
  const at = (now: number) => Math.max(0, Math.round(now - start));
  const push = (event: WalkthroughEvent) => {
    if (events.length < WALKTHROUGH_EVENTS_MAX) events.push(event);
  };
  const viewOf = (t: number, v: RecordedView): WalkthroughEvent => ({ t, k: 'view', ...v });
  const cursorOf = (t: number, p: Point | null): WalkthroughEvent =>
    p ? { t, k: 'cursor', x: Math.round(p.x), y: Math.round(p.y) } : { t, k: 'cursor-out' };
  const views: Sampled<RecordedView> = { last: -Infinity, pending: null, sent: '' };
  const cursors: Sampled<Point | null> = { last: -Infinity, pending: null, sent: '' };

  // A sample goes now when it is SAMPLE_MS since the last and differs from it; else it waits, replacing any waiting.
  const sample = <T>(
    state: Sampled<T>,
    now: number,
    value: T,
    make: (t: number, value: T) => WalkthroughEvent,
    force = false,
  ) => {
    const key = JSON.stringify(make(0, value));
    if (key === state.sent) {
      state.pending = null;
      return;
    }
    if (force || now - state.last >= SAMPLE_MS) {
      push(make(at(now), value));
      state.last = now;
      state.sent = key;
      state.pending = null;
    } else state.pending = { t: now, value };
  };
  const flush = <T>(state: Sampled<T>, make: (t: number, value: T) => WalkthroughEvent) => {
    const waiting = state.pending;
    if (waiting) sample(state, waiting.t, waiting.value, make, true);
  };
  const flushAll = () => {
    flush(views, viewOf);
    flush(cursors, cursorOf);
  };

  return {
    view: (now, view) => sample(views, now, view, viewOf),
    cursor: (now, p) => sample(cursors, now, p, cursorOf, p === null),
    point: (now, id) => {
      if (hidden().has(id)) return;
      flushAll();
      push({ t: at(now), k: 'point', id });
    },
    tab: (now, tab) => {
      flushAll();
      push({ t: at(now), k: 'tab', tab });
    },
    slide: (now, slide, label) => {
      flushAll();
      push(label ? { t: at(now), k: 'slide', slide, label } : { t: at(now), k: 'slide', slide });
    },
    tick: (now) => {
      if (views.pending && now - views.last >= SAMPLE_MS) flush(views, viewOf);
      if (cursors.pending && now - cursors.last >= SAMPLE_MS) flush(cursors, cursorOf);
    },
    full: () => events.length >= WALKTHROUGH_EVENTS_MAX,
    finish: () => {
      flushAll();
      // A waiting sample is written at its own time, which can fall before the other kind's last: in time order.
      return events.slice().sort((a, b) => a.t - b.t);
    },
  };
}
