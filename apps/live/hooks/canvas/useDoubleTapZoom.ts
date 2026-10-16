'use client';

import { useCallback, useEffect, useRef, type Ref } from 'react';
import { doubleTapZoomView } from '@/lib/double-tap-zoom';
import { glideViewport } from '@/lib/viewport-glide';
import type { ViewportStore } from '@/lib/viewport-store';
import { track } from '@/lib/telemetry';

// Double-tap to zoom (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom"): glides the view so the
// double-tapped canvas point sits in the middle of the canvas at the next zoom (lib/double-tap-zoom). A second
// double-tap mid-glide takes over from wherever the first has got to.
export function useDoubleTapZoom(
  mainRef: Ref<HTMLElement>,
  viewport: ViewportStore,
): (at: { x: number; y: number }) => void {
  const cancel = useRef<(() => void) | null>(null);
  // Gone with the canvas: no frame writes to the view after it.
  useEffect(() => () => cancel.current?.(), []);
  return useCallback(
    (at) => {
      const node = mainRef && 'current' in mainRef ? mainRef.current : null;
      if (!node) return;
      cancel.current?.();
      const from = viewport.get();
      // offsetWidth/Height, the canvas's own size, as centreOn reads it (hooks/canvas/useEditorViewport).
      const to = doubleTapZoomView(at, from.zoom, {
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
      cancel.current = glideViewport(from, to, {
        zoom: viewport.setZoom,
        offset: viewport.setOffset,
      });
      track('Canvas', 'Zoomed', 'DoubleTap');
    },
    [mainRef, viewport],
  );
}
