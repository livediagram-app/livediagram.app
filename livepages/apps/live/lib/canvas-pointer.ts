// The pointer's canvas position as a paste sees it: a pasted board scene lands at the pointer when the pointer
// is over the canvas. A floating panel
// (the palette, the explorer, the map) lies on top of the canvas and still lets
// its pointer moves reach the canvas, so it is "otherwise" by hand: the same
// marker the palette drag's ghost already reads.
export function pastePointer(
  x: number | null,
  y: number | null,
  target: EventTarget | null,
): { x: number; y: number } | null {
  if (x === null || y === null) return null;
  const el = target as Element | null;
  if (overFloatingPanel(el)) return null;
  return { x, y };
}

/** Whether a pointer or drag target is over a floating panel (the palette, the explorer, the map) rather than the
 *  canvas beneath it. A panel marked `data-drop-through` doesn't count: the category bar's flyout while one of its
 *  tiles is being dragged out of it (docs/specs/007-editor/toolbar-layout.md "The category bar"), so a drop on the
 *  canvas it covers lands there. */
export function overFloatingPanel(target: EventTarget | null): boolean {
  const panel = (target as Element | null)?.closest?.('[data-floating-panel]');
  return !!panel && !panel.hasAttribute('data-drop-through');
}
