// Whether a dialog is open over the page (toasts.md "One place for everything that pops up", inbox-notices.md "How a
// notice looks"): a modal the shared Dialog, a
// workbench modal or a canvas modal draws (`aria-modal="true"`, the mark useFocusTrap reads), or an open <dialog>.
// A notice waits while one is open, so it never sits over the dialog's corner; it shows once the dialog closes.
// Watched only while a notice is waiting or showing, so the canvas's own DOM changes cost nothing otherwise.

const OPEN_DIALOG = '[aria-modal="true"], dialog[open]';

export const dialogOpenNow = (): boolean =>
  typeof document !== 'undefined' && document.querySelector(OPEN_DIALOG) !== null;

/** How often, at most, a burst of DOM changes is told on (a drag on the canvas changes the DOM every frame). */
export const DIALOG_WATCH_MS = 200;

export function subscribeDialogs(listener: () => void): () => void {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return () => {};
  // At once for the first change, then at most once a DIALOG_WATCH_MS while changes keep coming, with a last call
  // after the burst, so a notice standing through a long drag reads the page a few times a second, not every frame.
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const tell = () => {
    timer = null;
    last = Date.now();
    listener();
  };
  const observer = new MutationObserver(() => {
    if (timer !== null) return;
    const wait = last + DIALOG_WATCH_MS - Date.now();
    if (wait <= 0) tell();
    else timer = setTimeout(tell, wait);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-modal', 'open'],
  });
  return () => {
    observer.disconnect();
    if (timer !== null) clearTimeout(timer);
  };
}
