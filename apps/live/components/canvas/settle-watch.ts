// Re-takes a still copy of something live once it has stopped changing (docs/specs/008-canvas/finish.md): a Sketch
// face's ink (SketchFace) and, in WebKit, an icon's or sticker's wobbled picture (SketchArtPicture). Not on every
// change: a zoom restyles a face's counter-scaled parts every frame, and copying 80 faces a frame held a 200-chart
// board's zoom to 50-80 ms tasks.

/** How long a face is still before its ink is copied again, ms: past a zoom or a burst of typing, short enough
 *  that an edit's ink follows at once to the eye (blueprint: 80 to 200). */
export const SKETCH_INK_SETTLE_MS = 120;

/** The longest a changing face's ink waits, ms, so a face that never settles (an endless animation) still
 *  follows (blueprint: 500 to 2000). */
export const SKETCH_INK_MAX_WAIT_MS = 1000;

/** Calls `take` SKETCH_INK_SETTLE_MS after `live` last changed (its subtree, or its size when `resize` is set), never
 *  later than SKETCH_INK_MAX_WAIT_MS after the first change. Returns the cleanup. */
export function watchUntilSettled(
  live: Element,
  take: () => void,
  { resize = false }: { resize?: boolean } = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let changedSince = 0;
  const changed = () => {
    const now = Date.now();
    if (!changedSince) changedSince = now;
    if (timer) clearTimeout(timer);
    const waited = now - changedSince;
    timer = setTimeout(
      () => {
        timer = undefined;
        changedSince = 0;
        take();
      },
      Math.max(0, Math.min(SKETCH_INK_SETTLE_MS, SKETCH_INK_MAX_WAIT_MS - waited)),
    );
  };
  const observer = new MutationObserver(changed);
  observer.observe(live, { subtree: true, childList: true, attributes: true, characterData: true });
  // A resize changes no attribute inside: a resized icon's art is redrawn at its new size. The first callback
  // reports the size it started at, which the first take already drew.
  let sized = false;
  const resized =
    resize && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (sized) changed();
          sized = true;
        })
      : undefined;
  resized?.observe(live);
  return () => {
    observer.disconnect();
    resized?.disconnect();
    if (timer) clearTimeout(timer);
  };
}
