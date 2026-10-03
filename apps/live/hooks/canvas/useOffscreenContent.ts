import { useMemo, type Ref } from 'react';
import { isBoxed, unionBoxedBounds, type Element } from '@livediagram/document';
import { isContentOffScreen } from '@/lib/viewport';
import { useObservedSize } from '@/hooks/canvas/useObservedSize';

// True while every element on the tab, and every Illustrate page (an empty page, or an article's
// writing, is content too), is panned / zoomed entirely out of view, and there is something to see. Drives the "bring it back"
// nudge above the Fit button (OffscreenContentHint).
//
// The canvas size comes from a ResizeObserver (useObservedSize), NOT a
// measurement on each pan: reading getBoundingClientRect on every
// viewportOffset change forced a synchronous layout reflow on the pan hot
// path (see useCanvasPanAndMarquee's rАF note). The content bounds are
// memoised on the elements, so the per-pan work is pure arithmetic over the
// size, the bounds and the current offset / zoom, computed during render.
export function useOffscreenContent(
  elements: Element[],
  viewportOffset: { x: number; y: number },
  viewportZoom: number,
  mainRef: Ref<HTMLElement>,
  pages?: readonly { rect: { x: number; y: number; width: number; height: number } }[],
): boolean {
  const size = useObservedSize(mainRef);
  const bbox = useMemo(() => {
    const boxedIds = new Set(elements.filter(isBoxed).map((el) => el.id));
    const own = boxedIds.size === 0 ? null : unionBoxedBounds(elements, boxedIds);
    const boxes = [...(own ? [own] : []), ...(pages ?? []).map((p) => p.rect)];
    if (boxes.length === 0) return null;
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    const right = Math.max(...boxes.map((b) => b.x + b.width));
    const bottom = Math.max(...boxes.map((b) => b.y + b.height));
    return { x, y, width: right - x, height: bottom - y };
  }, [elements, pages]);
  if (!size || !bbox) return false;
  return isContentOffScreen(size, bbox, viewportOffset, viewportZoom);
}
