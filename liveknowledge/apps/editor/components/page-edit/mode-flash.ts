// The document's white area glows once in the mode's colour (app/page-edit-motion.css): Edit, Save, Cancel.
const SCROLLER = '[data-page-scroller]';

export type ModeFlash = 'edit' | 'save' | 'cancel';

/** Flash the document area; a second flash restarts it. */
export function flashMode(kind: ModeFlash): void {
  const area = document.querySelector<HTMLElement>(SCROLLER);
  if (!area) return;
  area.removeAttribute('data-mode-flash');
  // Read layout so the animation starts again from its first frame.
  void area.offsetWidth;
  area.setAttribute('data-mode-flash', kind);
  area.addEventListener('animationend', () => area.removeAttribute('data-mode-flash'), {
    once: true,
  });
}

/** A ring out from the pointer where a double-click opened edit mode. */
export function ringAt(x: number, y: number): void {
  const ring = document.createElement('div');
  ring.className = 'lk-click-ring';
  ring.setAttribute('aria-hidden', 'true');
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  document.body.appendChild(ring);
  ring.addEventListener('animationend', () => ring.remove(), { once: true });
  // Reduced motion still ends it (0.01ms); a page hidden mid-animation never fires it, so a timer is the backstop.
  window.setTimeout(() => ring.remove(), 1000);
}
