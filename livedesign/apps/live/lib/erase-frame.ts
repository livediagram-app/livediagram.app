// Where the transformed canvas sits on screen during a whiteboard erase sweep
// (docs/specs/023-draw-mode/draw-mode.md "Eraser"), so a client point maps to canvas coords with
// `pointerToCanvas`. Read per pointer sample, so a pan or zoom mid-sweep (wheel, pinch) keeps the
// brush under the pointer; the wrapper's rect is re-read only when the view (offset or zoom) has
// changed since the last read, since the sweep's own erasing dirties layout every sample and a
// rect read per sample would force a reflow each time.

export type EraseFrame = { left: number; top: number; zoom: number };

/** Reads the current frame; null when the canvas is gone. */
export type EraseFrameReader = () => EraseFrame | null;

type View = { offset: { x: number; y: number }; zoom: number };

/**
 * A reader for one sweep: `view()` gives the live viewport (cheap, from a ref), `rect()` the
 * wrapper's bounding rect (a layout read), taken on the first read and again whenever the view
 * moved.
 */
export function createEraseFrameReader(
  view: () => View,
  rect: () => { left: number; top: number } | null | undefined,
): EraseFrameReader {
  let seen: { x: number; y: number; zoom: number } | null = null;
  let frame: EraseFrame | null = null;
  return () => {
    const { offset, zoom } = view();
    if (seen && frame && seen.x === offset.x && seen.y === offset.y && seen.zoom === zoom) {
      return frame;
    }
    const r = rect();
    if (!r) return frame;
    seen = { x: offset.x, y: offset.y, zoom };
    frame = { left: r.left, top: r.top, zoom };
    return frame;
  };
}
