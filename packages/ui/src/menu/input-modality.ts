// How the person last interacted, and what last held focus, read by the menu hooks
// (docs/specs/004-interface-design/menus.md; D51). Two capture listeners on the document, installed
// once when this module first loads in a browser.
//
// Read at a menu's mount, both answer for the moment it was opened, even when the control that
// opened it has already gone: the selection toolbar's More actions unmounts in the same commit
// that mounts the element menu, so `document.activeElement` is the body by then.

let keyboard = false;
let lastFocused: HTMLElement | null = null;

function install(doc: Document) {
  doc.addEventListener(
    'keydown',
    () => {
      keyboard = true;
    },
    true,
  );
  doc.addEventListener(
    'pointerdown',
    () => {
      keyboard = false;
    },
    true,
  );
  doc.addEventListener(
    'focusin',
    (e) => {
      if (e.target instanceof HTMLElement) lastFocused = e.target;
    },
    true,
  );
}

if (typeof document !== 'undefined') install(document);

/** Whether the last interaction was a key press rather than a pointer press. */
export function lastInputWasKeyboard(): boolean {
  return keyboard;
}

/** The element that last took focus, connected or not; null before anything was focused. */
export function lastFocusedElement(): HTMLElement | null {
  return lastFocused;
}
