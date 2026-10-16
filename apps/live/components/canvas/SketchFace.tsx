'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

// A face drawn by hand under Sketch (docs/specs/008-canvas/finish.md "Every other face is drawn by hand too"). The
// face renders once, live, with its ink hidden (app/sketch-face.css); underneath it sits a still copy of that DOM,
// its words hidden, drawn through the face wobble (SKETCH_FACE_FILTER). The copy is ours, not React's, so a face is
// never rendered twice and its effects never run twice. It is re-taken once the live face has been still for a
// moment, not on every change: a zoom restyles a face's counter-scaled parts every frame, and copying 80 faces a
// frame held a 200-chart board's zoom to 50-80 ms tasks. Photos, embeds and `data-sketch-skip` parts (a tab
// window's content) stay out of it.
//
// Both layers fill the element's box, as the wrapper does, so they line up exactly. Neither sets a z-index: the
// copy comes first, so the live face paints over it without a new stacking context for its controls.

/** What the ink copy leaves out: photos and embeds are not drawings, and a skipped part keeps its own look. */
export const SKETCH_INK_PRUNE = 'img, video, iframe, canvas, [data-sketch-skip]';

/** How long a face is still before its ink is copied again, ms: past a zoom or a burst of typing, short enough
 *  that an edit's ink follows at once to the eye (blueprint: 80 to 200). */
export const SKETCH_INK_SETTLE_MS = 120;

/** The longest a changing face's ink waits, ms, so a face that never settles (an endless animation) still
 *  follows (blueprint: 500 to 2000). */
export const SKETCH_INK_MAX_WAIT_MS = 1000;

/** The ink copy of a live face: no ids (so the live face's references keep resolving to its own), no photos,
 *  embeds or skipped parts, nothing focusable. */
export function sketchInkCopy(live: Element): Element {
  const copy = live.cloneNode(true) as Element;
  copy.removeAttribute('data-sketch-words');
  for (const pruned of copy.querySelectorAll(SKETCH_INK_PRUNE)) pruned.remove();
  for (const named of copy.querySelectorAll('[id]')) named.removeAttribute('id');
  return copy;
}

export function SketchFace({ active, children }: { active: boolean; children: ReactNode }) {
  const inkRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ink = inkRef.current;
    const live = liveRef.current;
    if (!active || !ink || !live) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let changedSince = 0;
    const take = () => {
      timer = undefined;
      changedSince = 0;
      ink.replaceChildren(...sketchInkCopy(live).childNodes);
    };
    take();
    const observer = new MutationObserver(() => {
      const now = Date.now();
      if (!changedSince) changedSince = now;
      if (timer) clearTimeout(timer);
      const waited = now - changedSince;
      timer = setTimeout(
        take,
        Math.max(0, Math.min(SKETCH_INK_SETTLE_MS, SKETCH_INK_MAX_WAIT_MS - waited)),
      );
    });
    observer.observe(live, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
      ink.replaceChildren();
    };
  }, [active]);

  if (!active) return <>{children}</>;
  return (
    <>
      <div ref={inkRef} data-sketch-ink="" aria-hidden inert className="absolute inset-0" />
      <div ref={liveRef} data-sketch-words="" className="absolute inset-0">
        {children}
      </div>
    </>
  );
}
