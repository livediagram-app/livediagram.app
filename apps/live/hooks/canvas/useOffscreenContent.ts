import { useMemo, type Ref } from 'react';
import { isBoxed, unionBoxedBounds, type Element } from '@livediagram/diagram';
import { isContentOffScreen } from '@/lib/viewport';
import { useObservedSize } from '@/hooks/canvas/useObservedSize';

// True while every element on the tab is panned / zoomed entirely out of
// view — and there is at least one element to see. Drives the "bring it back"
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
): boolean {
  const size = useObservedSize(mainRef);
  const bbox = useMemo(() => {
    const boxedIds = new Set(elements.filter(isBoxed).map((el) => el.id));
    return boxedIds.size === 0 ? null : unionBoxedBounds(elements, boxedIds);
  }, [elements]);
  if (!size || !bbox) return false;
  return isContentOffScreen(size, bbox, viewportOffset, viewportZoom);
}
