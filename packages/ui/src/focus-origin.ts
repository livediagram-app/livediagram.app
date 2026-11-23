// Whether focus is being placed by code rather than moved by the person: a modal handing focus to its first control
// as it opens. Browsers call that focus keyboard-visible when nothing held focus before, so a hint that opens on
// keyboard focus (hint/useHint.ts) opened over the dialog as it arrived, on a control nobody chose. A hint asks here
// and stays shut (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md "Opens instantly on keyboard
// focus").
let placing = 0;

/** Focuses `el` as code, so hints know nobody chose it. Focus events run inside the call. */
export function placeFocus(el: HTMLElement, options?: FocusOptions): void {
  placing += 1;
  try {
    el.focus(options);
  } finally {
    placing -= 1;
  }
}

/** True while `placeFocus` is moving focus. */
export function focusIsPlaced(): boolean {
  return placing > 0;
}
