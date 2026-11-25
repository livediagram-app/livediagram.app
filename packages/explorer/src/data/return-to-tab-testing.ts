// Test help for useReturnCount (useReturnToTab.ts): the person comes back to this browser tab. The clock moves a minute
// on, past any gap, and the page says it is visible again; wrap it in act(). The clock stays ahead until
// leaveReturnClock(), which an afterEach calls.

const MINUTE_MS = 60_000;

let restore: (() => void) | null = null;
let ahead = 0;

export function comeBackToPage(): void {
  if (!restore) {
    const was = Date.now;
    Date.now = () => was.call(Date) + ahead;
    restore = () => {
      Date.now = was;
    };
  }
  ahead += MINUTE_MS;
  document.dispatchEvent(new Event('visibilitychange'));
}

export function leaveReturnClock(): void {
  restore?.();
  restore = null;
  ahead = 0;
}
