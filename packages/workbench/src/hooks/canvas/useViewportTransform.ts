'use client';

// The canvas wrapper's transform, and the floor pattern's position under it, written straight to the
// DOM from the viewport store (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas"),
// so a pan, a walk's camera follow among them, renders no canvas view. The caller subscribes to the
// zoom only and draws its first frame from the view this returns; the store subscription moves the
// wrapper on every pan after it, and every commit writes the view again, so a render made before a pan
// that commits after it never leaves the wrapper behind.

import { useCallback, useLayoutEffect, type Ref, type RefObject } from 'react';
import { useLatest } from '../ui/useLatest';
import { useViewportStore } from './useViewportStore';
import type { View } from '../../lib/viewport-store';

// Translate is in canvas coordinates (applied first); scale is centred on the wrapper, so a zoom keeps
// the view's centre still.
export function viewportTransform(view: View): string {
  return `scale(${view.zoom}) translate(${view.offset.x}px, ${view.offset.y}px)`;
}

// The node behind an object ref; a callback ref has none to read.
function nodeOf(ref: Ref<HTMLElement>): HTMLElement | null {
  return ref && typeof ref === 'object' ? ref.current : null;
}

export function useViewportTransform(
  wrapperRef: RefObject<HTMLElement | null>,
  // The element under the wrapper whose background pattern pans with the view, and the pattern's
  // position for a view (undefined while it draws no pattern).
  backgroundRef: Ref<HTMLElement>,
  backgroundPosition: (view: View) => string | undefined,
): View {
  const store = useViewportStore();
  const positionRef = useLatest(backgroundPosition);
  const write = useCallback(() => {
    const view = store.get();
    const wrapper = wrapperRef.current;
    if (wrapper) wrapper.style.transform = viewportTransform(view);
    const background = nodeOf(backgroundRef);
    const position = background ? positionRef.current(view) : undefined;
    if (background && position !== undefined) background.style.backgroundPosition = position;
  }, [store, wrapperRef, backgroundRef, positionRef]);
  useLayoutEffect(write);
  useLayoutEffect(() => store.subscribe(write), [store, write]);
  return store.get();
}
