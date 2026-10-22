// Timing telemetry (docs/specs/017-telemetry/timing-telemetry.md): time a key moment of the
// experience and report it as `Timing·Measured·<Metric>.<Bucket>`. The bucket is picked here, in the
// browser, from the shared scales in @livediagram/api-schema, so the raw duration never leaves it.
//
// Shared by the editor's own timings and every app's Web Vitals; each caller passes its own
// policy-wrapped track(), as installClientErrorTracking does. A timing is dropped when the page was
// hidden at any point while it ran: hidden pages are throttled, so the number would measure the
// throttling, not the product.

import { timingType } from '@livediagram/api-schema';

export type TimingTrack = (category: 'Timing', action: 'Measured', type: string) => void;

const now = (): number => performance.now();

// The last time the page went hidden, on the performance clock. Watched from the first timing on;
// browsers that keep a visibility history (`visibility-state` entries) cover the time before that.
let lastHiddenAt: number | null = null;
let watching = false;

function watchHidden(): void {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  if (document.visibilityState === 'hidden') lastHiddenAt = now();
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') lastHiddenAt = now();
    },
    { capture: true },
  );
}

function hiddenInHistorySince(start: number): boolean {
  try {
    return performance
      .getEntriesByType('visibility-state')
      .some((e) => e.name === 'hidden' && e.startTime >= start);
  } catch {
    return false;
  }
}

/** Was the page hidden at any point since `start` (performance clock)? */
export function wasHiddenSince(start: number): boolean {
  if (typeof document === 'undefined') return true;
  if (document.visibilityState === 'hidden') return true;
  if (lastHiddenAt !== null && lastHiddenAt >= start) return true;
  return hiddenInHistorySince(start);
}

/** Report one timing: its bucketed type, or nothing for an unknown metric or a bad value. */
export function reportTiming(track: TimingTrack, metric: string, value: number): void {
  try {
    const type = timingType(metric, value);
    if (type) track('Timing', 'Measured', type);
  } catch {
    // Telemetry never throws into the moment it is timing.
  }
}

// After the next frame has painted: a frame callback, then a task, which runs once that frame is on
// screen. Straight away where there are no frames to wait for.
function afterNextPaint(callback: () => void): void {
  if (typeof requestAnimationFrame !== 'function') {
    callback();
    return;
  }
  requestAnimationFrame(() => setTimeout(callback, 0));
}

export type TimingHandle = {
  /** End the timing now. Only the first end or cancel counts. */
  end: () => void;
  /** End the timing once the next frame has painted, for a wait that ends on screen. */
  endAfterPaint: () => void;
  /** Drop the timing: it failed, or was not the moment being measured after all. */
  cancel: () => void;
};

/**
 * Start timing `metric`. `from` backdates the start on the performance clock, e.g. `0` for the
 * page's navigation start.
 */
export function startTiming(
  track: TimingTrack,
  metric: string,
  opts: { from?: number } = {},
): TimingHandle {
  if (typeof performance === 'undefined') {
    return { end: () => {}, endAfterPaint: () => {}, cancel: () => {} };
  }
  watchHidden();
  const start = opts.from ?? now();
  // Hidden as it starts (a drop noticed in a background tab): the watch only sees the page go
  // hidden, so a page already hidden would otherwise pass once it is visible again.
  const hiddenAtStart = document.visibilityState === 'hidden';
  let settled = false;
  const end = () => {
    if (settled) return;
    settled = true;
    if (hiddenAtStart || wasHiddenSince(start)) return;
    reportTiming(track, metric, now() - start);
  };
  return {
    end,
    endAfterPaint: () => {
      if (!settled) afterNextPaint(end);
    },
    cancel: () => {
      settled = true;
    },
  };
}

/**
 * A sampler for a moment that repeats (an autosave): true the first time, then at most once every
 * `intervalMs`, so a long session sends a steady trickle rather than one timing per occurrence.
 */
export function createTimingSampler(intervalMs: number): () => boolean {
  let last: number | null = null;
  return () => {
    const t = now();
    if (last !== null && t - last < intervalMs) return false;
    last = t;
    return true;
  };
}

/** Test seam: forget the hidden watch. */
export function resetTimingForTests(): void {
  lastHiddenAt = null;
  watching = false;
}
