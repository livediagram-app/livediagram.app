// Reading the coach dock in a test: what it announces (its polite live region, "Show Me · Card Types, step 1 of 5:
// Name It"), and whether a step is up.

/** The dock's announcement, or '' with no dock on screen. */
export function dockSays(): string {
  return (
    document.querySelector('[data-coach-dock] [aria-live="polite"]')?.textContent?.trim() ?? ''
  );
}

/** Whether the dock is showing a step (not the offer or the closing). */
export function dockStepShowing(): boolean {
  return document.querySelector('[data-coach-dock="step"]') !== null;
}
