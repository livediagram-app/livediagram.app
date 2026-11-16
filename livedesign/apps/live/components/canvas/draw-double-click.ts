// A polygon or a path being drawn finishes on a double-click wherever it lands, over an element too
// (docs/specs/008-canvas/polygon-tool.md "Gesture"). The canvas runs this in its capture phase, ahead of the
// element under the pointer, so the element never takes the double-click into text editing, a picker or a menu.

/** Offers the double-click to each drawing tool in turn; the first that takes it keeps it from everything under it. */
export function takeDrawDoubleClick(
  e: { stopPropagation: () => void },
  ...finishers: readonly (() => boolean)[]
): boolean {
  if (!finishers.some((finish) => finish())) return false;
  e.stopPropagation();
  return true;
}
