// Edit, Save and Cancel ripple inward round the document area in the mode's colour (app/mode-ripple.css), and a
// double-click to edit sends a ring out from the pointer. The ripple is drawn over the part of the document area a
// person sees: the scroller runs under the docked page tree and beside the Page Info rail, so the ripple is clipped
// to what stands clear of them (owner 2026-11-21: "it should be all around the editable document area, not hidden
// behind sidebars").
const SCROLLER = '[data-page-scroller]';
// The chrome docked over the scroller's edges: the page tree the page stands beside and the Page Info rail.
const DOCKED = '[data-contents-sidebar], [data-page-rail="docked"], [data-page-rail="strip"]';
// How long the ripple's last ring takes, with a margin: the backstop that clears it if no animationend comes.
const RIPPLE_BACKSTOP_MS = 1500;

export type ModeFlash = 'edit' | 'save' | 'cancel';

export type Box = { left: number; top: number; right: number; bottom: number };

/** The part of `area` that stands clear of the chrome docked over its left and right edges. */
export function visibleDocumentBox(area: Box, docked: readonly Box[]): Box {
  let { left, right } = area;
  for (const d of docked) {
    const overlapsRows = d.bottom > area.top && d.top < area.bottom;
    if (!overlapsRows || d.right <= d.left) continue;
    // Docked at the left edge: the area starts where it ends. At the right edge: the area ends where it starts.
    if (d.left <= left + 1 && d.right < right) left = Math.max(left, d.right);
    else if (d.right >= right - 1 && d.left > left) right = Math.min(right, d.left);
  }
  return { left, top: area.top, right: Math.max(left, right), bottom: area.bottom };
}

let current: HTMLElement | null = null;

/** Ripple the document area inward once; a second ripple replaces the first. */
export function flashMode(kind: ModeFlash): void {
  const area = document.querySelector<HTMLElement>(SCROLLER);
  if (!area) return;
  const box = visibleDocumentBox(
    area.getBoundingClientRect(),
    [...document.querySelectorAll<HTMLElement>(DOCKED)].map((el) => el.getBoundingClientRect()),
  );
  if (box.right - box.left < 1 || box.bottom - box.top < 1) return;
  current?.remove();
  const ripple = document.createElement('div');
  ripple.className = 'lk-mode-ripple';
  ripple.setAttribute('aria-hidden', 'true');
  ripple.setAttribute('data-mode-ripple', kind);
  ripple.style.left = `${box.left}px`;
  ripple.style.top = `${box.top}px`;
  ripple.style.width = `${box.right - box.left}px`;
  ripple.style.height = `${box.bottom - box.top}px`;
  // The edge glow, then three rings travelling in from the edge, each a beat after the last.
  for (const part of ['glow', 'ring', 'ring', 'ring']) {
    const span = document.createElement('span');
    span.className = `lk-mode-ripple-${part}`;
    ripple.appendChild(span);
  }
  document.body.appendChild(ripple);
  current = ripple;
  const done = () => {
    ripple.remove();
    if (current === ripple) current = null;
  };
  ripple.lastElementChild?.addEventListener('animationend', done, { once: true });
  // Reduced motion still ends it (0.01ms); a page hidden mid-animation never fires it, so a timer is the backstop.
  window.setTimeout(done, RIPPLE_BACKSTOP_MS);
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
  window.setTimeout(() => ring.remove(), RIPPLE_BACKSTOP_MS);
}
