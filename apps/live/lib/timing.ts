// The editor's timings (docs/specs/017-telemetry/timing-telemetry.md): opening a document, switching
// to a tab, an autosave, and the live room connecting and reconnecting, each sent as
// `Timing·Measured·<Metric>.<Bucket>` through the shared startTiming.
//
// lib/api can't import lib/telemetry (import cycle), and the room's timings start inside lib/api, so
// the track is registered by TimingTelemetryBoot, the way the api error reporter is. It is read when a
// timing ENDS, not when it starts, so a load that starts before the boot's effect has run (the
// document page's layout effect runs first) still reports.

import type { EditorTimingMetric } from '@livediagram/api-schema';
import {
  createTimingSampler,
  startTiming,
  type TimingHandle,
  type TimingTrack,
} from '@livediagram/telemetry-client';

let timingTrack: TimingTrack | null = null;

export function setTimingTrack(fn: TimingTrack | null): void {
  timingTrack = fn;
}

const registeredTrack: TimingTrack = (category, action, type) =>
  timingTrack?.(category, action, type);

export function startEditorTiming(
  metric: EditorTimingMetric,
  opts: { from?: number } = {},
): TimingHandle {
  return startTiming(registeredTrack, metric, opts);
}

/** At most one Save timing per page per this long: autosaves repeat, timings should not flood. */
export const SAVE_TIMING_INTERVAL_MS = 60_000;

export const sampleSaveTiming: () => boolean = createTimingSampler(SAVE_TIMING_INTERVAL_MS);

// Set once the page's first document load has ended, however it ended: only that load can have
// started at the navigation. Coming back in-app to the page's own address is not a fresh page load.
let firstLoadEnded = false;

/**
 * When a document load began, for DocumentLoad: the page's navigation start (0) for the first load on
 * a page that opened on this document, so the number includes downloading the app; otherwise (an
 * in-app arrival from the Explorer) undefined, meaning now.
 */
export function documentLoadOrigin(): number | undefined {
  if (firstLoadEnded) return undefined;
  try {
    const [navigation] = performance.getEntriesByType('navigation');
    if (navigation && new URL(navigation.name).pathname === window.location.pathname) return 0;
  } catch {
    // No navigation timing: time from now.
  }
  return undefined;
}

/** A document load ended (opened, failed or stopped at a password): later loads are in-app. */
export function noteDocumentLoadEnded(): void {
  firstLoadEnded = true;
}

/** Test seam. */
export function resetTimingForTests(): void {
  firstLoadEnded = false;
  timingTrack = null;
}
