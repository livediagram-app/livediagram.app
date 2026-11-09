import { useMemo, type Ref } from 'react';
import { isBoxed, unionBoxedBounds, type Element } from '@liveplanner/project';
import { isContentOffScreen } from '@liveworkspace/workbench/lib/viewport';
import { useObservedSize } from '@liveworkspace/workbench/hooks/canvas/useObservedSize';
import { useCanvasCovered } from '@/hooks/plan/plan-cover-store';

// True while every element on the tab is panned / zoomed entirely out of view, and there is something to see. Drives the "bring it back"
// nudge above the Fit button (OffscreenContentHint). Never while something covers the canvas (a board or Sheet filling
// its tab or maximised, a Dashboard's or a Form's page): the canvas's own view is hidden then, so where its elements sit
// says nothing about what is on screen, and a Dashboard tab said "Nothing's in view" over its own slots.
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
  const covered = useCanvasCovered();
  const bbox = useMemo(() => {
    const boxedIds = new Set(elements.filter(isBoxed).map((el) => el.id));
    return boxedIds.size === 0 ? null : unionBoxedBounds(elements, boxedIds);
  }, [elements]);
  if (!size || !bbox || covered) return false;
  return isContentOffScreen(size, bbox, viewportOffset, viewportZoom);
}
