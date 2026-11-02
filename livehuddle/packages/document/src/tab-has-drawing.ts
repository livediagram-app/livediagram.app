// Whether a tab has anything to draw where it is shown away from its own canvas (the split view's other pane):
// any elements. Without, it says the tab has nothing on it yet. Pure.
export function tabHasDrawing(tab: { elements: readonly unknown[] }): boolean {
  return tab.elements.length > 0;
}
