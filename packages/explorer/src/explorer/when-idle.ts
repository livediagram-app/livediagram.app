// Runs `run` once the page is idle (or after a short timer where the browser has no idle callback), for code the
// Explorer fetches ahead of a press: the sections (lazy-panes.ts) and the dialogs (lazy-dialogs.ts). Returns a cancel
// for an unmount before then.
export function whenIdle(run: () => void): () => void {
  const idle = typeof window !== 'undefined' ? window.requestIdleCallback : undefined;
  if (idle) {
    const handle = idle(run, { timeout: 3000 });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = setTimeout(run, 1500);
  return () => clearTimeout(timer);
}
