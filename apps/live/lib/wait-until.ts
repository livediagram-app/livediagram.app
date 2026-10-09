// Polls `done` until it holds or `timeoutMs` passes: true once it held, false on timeout. For waiting on state a
// React render will settle (the item store loading), where there is no promise to await. Shared by the Plan tour's
// tour content and the Plan tab import.
export const WAIT_UNTIL_POLL_MS = 50;

export function waitUntil(done: () => boolean, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (done()) return resolve(true);
      if (Date.now() - started > timeoutMs) return resolve(false);
      setTimeout(tick, WAIT_UNTIL_POLL_MS);
    };
    tick();
  });
}
