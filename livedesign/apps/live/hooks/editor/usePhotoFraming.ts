// A photo page framed below its own chrome (docs/specs/031-photo/photo-pages.md "Working on a photo page"):
// the first time its session starts, its tools take the palette strip and its room under the strip is kept
// (top-strip-inset), so it is framed again once they are on screen. Once each page, and again when what this person may do there
// changes or the rail first shows: a visitor's page is in focus behind their Join prompt, the canvas's
// chrome held back, and was framed beside nothing.
import { useEffect, useRef } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useRailShown } from '@/lib/photo-editor/rail-shown';

// How long a framing waits for the tools and the room under the strip to load, ms.
export const PHOTO_FRAME_WAIT_MS = 1500;

export function usePhotoFraming(
  pageId: string | null,
  focusPage: ((id: string) => void) | undefined,
  canEdit: boolean,
  canInspect: boolean,
): void {
  const framed = useRef(new Set<string>());
  // Read when the frame is due: a new function each render must not restart the wait.
  const focusRef = useLatest(focusPage);
  const can = !!focusPage;
  const rail = useRailShown();
  useEffect(() => {
    if (!pageId || !can) return;
    const key = `${pageId}:${canEdit}:${canInspect}:${rail}`;
    if (framed.current.has(key)) return;
    debugLog('[photo] frame-wait', { key });
    // The tools and the room under the strip mount with their own chunks: framed once they are on screen (or, for
    // someone with neither, after a moment).
    const until = performance.now() + PHOTO_FRAME_WAIT_MS;
    let raf = 0;
    const wait = () => {
      // The tools are in the palette strip, and the room kept under it.
      const ready =
        !!document.querySelector('[data-photo-rail]') &&
        (!canEdit || !!document.querySelector('[data-photo-options]'));
      if (!ready && performance.now() <= until) {
        raf = requestAnimationFrame(wait);
        return;
      }
      // Marked once done: a wait cut short (the page left) frames on the next visit.
      framed.current.add(key);
      const tall = (sel: string) =>
        Math.round(document.querySelector(sel)?.getBoundingClientRect().height ?? -1);
      debugLog('[photo] framed', {
        pageId,
        ready,
        rail: tall('[data-photo-rail]'),
        options: tall('[data-photo-options]'),
      });
      focusRef.current?.(pageId);
    };
    raf = requestAnimationFrame(wait);
    return () => cancelAnimationFrame(raf);
  }, [pageId, can, canEdit, canInspect, rail, focusRef]);
}
