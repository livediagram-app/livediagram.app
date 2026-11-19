// Whether a dialog is open over the page (inbox-notices.md "How a notice looks"): a modal the shared Dialog, a
// workbench modal or a canvas modal draws (`aria-modal="true"`, the mark useFocusTrap reads), or an open <dialog>.
// A notice waits while one is open, so it never sits over the dialog's corner; it shows once the dialog closes.
// Watched only while a notice is waiting or showing, so the canvas's own DOM changes cost nothing otherwise.

const OPEN_DIALOG = '[aria-modal="true"], dialog[open]';

export const dialogOpenNow = (): boolean =>
  typeof document !== 'undefined' && document.querySelector(OPEN_DIALOG) !== null;

export function subscribeDialogs(listener: () => void): () => void {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return () => {};
  const observer = new MutationObserver(listener);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-modal', 'open'],
  });
  return () => observer.disconnect();
}
