// Opening an element's own menu to the part a tour step explains (docs/specs/007-editor/element-tours.md "Menu
// steps"): a step that names a menu path ("Tools › Rows") opens the menu, opens each named row in turn (an accordion
// section, or a flyout such as Tools) and rings the last one open, instead of pointing at More and leaving the person
// to find it.
import { waitForSelector } from '@liveworkspace/workbench/components/tour/tour-dom';

/** The element's menu (ContextMenu). */
export const CONTEXT_MENU = '[data-tour-id="context-menu"]';
// Where a path's rows are found: the menu, and the flyout panels it opens (portalled outside it).
const MENU_ROWS = `${CONTEXT_MENU} button[aria-expanded], [data-menu-flyout] button[aria-expanded]`;
// The part a menu step rings, marked when its path opens.
const MARK = 'data-tour-menu-target';
export const MENU_TARGET = `[${MARK}]`;

// Polls for `find` each frame until it answers or `timeoutMs` runs out.
function waitFor<T>(find: () => T | null, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      const found = find();
      if (found || performance.now() - started > timeoutMs) return resolve(found);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

const rowName = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

function findRow(title: string): HTMLButtonElement | null {
  const want = title.toLowerCase();
  for (const el of document.querySelectorAll<HTMLButtonElement>(MENU_ROWS)) {
    if (rowName(el) === want && el.getClientRects().length > 0) return el;
  }
  return null;
}

/** Opens each row of `path` in the open menu, and marks what the last one opened (its section, or its flyout). */
export async function openMenuPath(path: readonly string[]): Promise<void> {
  clearMenuPath();
  if (!(await waitForSelector(CONTEXT_MENU, 2000))) return;
  let row: HTMLButtonElement | null = null;
  for (const title of path) {
    row = await waitFor(() => findRow(title), 1500);
    if (!row) return;
    if (row.getAttribute('aria-expanded') !== 'true') row.click();
  }
  if (!row) return;
  // A flyout row (Tools) rings the panel it opened, the newest flyout; an accordion row its own section.
  const target = row.hasAttribute('aria-haspopup')
    ? await waitFor(() => [...document.querySelectorAll('[data-menu-flyout]')].at(-1) ?? null, 1000)
    : row.parentElement;
  target?.setAttribute(MARK, '');
}

/** Lets go of the marked part. */
export function clearMenuPath(): void {
  for (const el of document.querySelectorAll(MENU_TARGET)) el.removeAttribute(MARK);
}
