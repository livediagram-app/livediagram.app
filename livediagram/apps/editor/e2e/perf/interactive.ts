// When an opened board is interactive (docs/specs/008-canvas/canvas-performance.md "Measuring", D68):
// from the tab's GET response to the start of the first OPEN_QUIET_MS with nothing long running. The
// busy intervals are the page's long tasks and long animation frames together, since long tasks alone
// miss a frame that only renders. Pure: the probe reads the intervals from the page and decides here.

export const OPEN_QUIET_MS = 500;

export type Busy = { start: number; end: number };

// The offset from `from` at which the first quiet window starts.
export function interactiveMs(from: number, busy: readonly Busy[]): number {
  let quietFrom = from;
  for (const span of [...busy].filter((b) => b.end > from).sort((a, b) => a.start - b.start)) {
    if (span.start - quietFrom >= OPEN_QUIET_MS) break;
    quietFrom = Math.max(quietFrom, span.end);
  }
  return quietFrom - from;
}
