// Whether a surface that arrives late may take focus as it opens: nothing the person reached holds it, only the page
// itself or the canvas (`data-canvas-root`). A start panel's code loads when it is first drawn, so on a busy machine it
// can mount after a control was reached or a menu opened from the keyboard, and it never takes focus from one
// (docs/specs/007-editor/start-diagramming.md "Keyboard" in each product; start-panel.md in liveplanner).
export function focusIsFree(doc: Document = document): boolean {
  const active = doc.activeElement;
  return !active || active === doc.body || active.matches('[data-canvas-root]');
}
