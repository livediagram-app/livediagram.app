// The pointer's canvas position as a paste sees it (docs/specs/021-event-storming/event-storming.md "Always on a
// lane"): a paste holding a workshop note lands at the pointer when the pointer
// is over the canvas, and staggers on the original otherwise. A floating panel
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
  if (el?.closest?.('[data-floating-panel]')) return null;
  return { x, y };
}
