import { useMemo, type Ref } from 'react';
import { isBoxed, unionBoxedBounds, unionRects, type Element } from '@livehuddle/document';
import { isContentOffScreen } from '@liveworkspace/workbench/lib/viewport';
import { useObservedSize } from '@liveworkspace/workbench/hooks/canvas/useObservedSize';
import { useViewportOf } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { turnedArea, viewArea } from '@/lib/space-3d/space-3d-cutaway';

// True while every element on the tab, and every page (an empty page, or an article's
// writing, is content too), is panned / zoomed entirely out of view, and there is something to see. Drives the "bring it back"
// nudge above the Fit button (OffscreenContentHint).
//
// The canvas size comes from a ResizeObserver (useObservedSize), NOT a
// measurement on each pan: reading getBoundingClientRect on every
// viewportOffset change forced a synchronous layout reflow on the pan hot
// path (see useCanvasPanAndMarquee's rАF note). The content bounds are
// memoised on the elements, so the per-pan work is pure arithmetic over the
// size, the bounds and the current offset / zoom. It reads the view from the
// store by value (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the
// canvas"), so a pan renders its caller only when the answer flips.
//
// In the 3D view the camera sees far ahead and little behind, so "in view" is the floor it draws (space-3d-cutaway
// `viewArea`), not the flat plan's rectangle: content up ahead is on screen there (the owner, 2026-11-18: "Bring it
// back into view does nothing when I am in 3d").
export function useOffscreenContent(
  elements: Element[],
  mainRef: Ref<HTMLElement>,
  pages?: readonly { rect: { x: number; y: number; width: number; height: number } }[],
  space?: { tilted: boolean; turned: boolean },
): boolean {
  const size = useObservedSize(mainRef);
  const bbox = useMemo(() => {
    const boxedIds = new Set(elements.filter(isBoxed).map((el) => el.id));
    const own = boxedIds.size === 0 ? null : unionBoxedBounds(elements, boxedIds);
    return unionRects([...(own ? [own] : []), ...(pages ?? []).map((p) => p.rect)]);
  }, [elements, pages]);
  const tilted = space?.tilted ?? false;
  const turned = space?.turned ?? false;
  return useViewportOf((view) => {
    if (!size || !bbox) return false;
    if (!tilted) return isContentOffScreen(size, bbox, view.offset, view.zoom);
    const ahead = viewArea(view, size);
    const area = turned ? turnedArea(ahead) : ahead;
    return (
      bbox.x > area.right ||
      bbox.x + bbox.width < area.left ||
      bbox.y > area.bottom ||
      bbox.y + bbox.height < area.top
    );
  });
}
