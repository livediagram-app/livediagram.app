'use client';

import { useCallback, useEffect, useMemo, useRef, type Ref } from 'react';
import type { Element as CanvasElement } from '@livediagram/document';
import { doubleTapFitsTab, doubleTapFrameView, doubleTapZoomView } from '@/lib/double-tap-zoom';
import { tabFitView } from '@/lib/tab-fit-view';
import { glideViewport, type ViewPose } from '@/lib/viewport-glide';
import type { ViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { track } from '@/lib/telemetry';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

type DoubleTapZoom = {
  // A finger's double-tap on the empty canvas at `at` (canvas coords): zooms in on it, or right after a double-tap
  // zoomed in, fits the whole tab.
  onCanvas: (at: { x: number; y: number }) => void;
  // A finger's double-tap on an element's node: frames it when it is too small to work on and says so (true), so the
  // caller stops the double-tap before the element edits.
  onElement: (node: Element) => boolean;
};

// Double-tap to zoom (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom"): glides the view so the
// double-tapped canvas point sits in the middle of the canvas at the next zoom (lib/double-tap-zoom), then out to the
// whole tab on the next double-tap, and frames a small element before it edits. A double-tap mid-glide takes over
// from wherever the last has got to.
export function useDoubleTapZoom(
  mainRef: Ref<HTMLElement>,
  viewport: ViewportStore,
  tab: { id?: string; elements: CanvasElement[] },
): DoubleTapZoom {
  const cancel = useRef<(() => void) | null>(null);
  // The tab the last double-tap zoomed in on, if the double-tap after it has not fitted back out yet: a new tab
  // starts afresh.
  const zoomedInOn = useRef<string | undefined | null>(null);
  const latest = useLatest(tab);
  // Gone with the canvas: no frame writes to the view after it.
  useEffect(() => () => cancel.current?.(), []);
  const glide = useCallback(
    (to: ViewPose) => {
      cancel.current?.();
      cancel.current = glideViewport(viewport.get(), to, {
        zoom: viewport.setZoom,
        offset: viewport.setOffset,
      });
    },
    [viewport],
  );
  const onCanvas = useCallback(
    (at: { x: number; y: number }) => {
      const node = mainRef && 'current' in mainRef ? mainRef.current : null;
      if (!node) return;
      const { id, elements } = latest.current;
      const zoom = viewport.get().zoom;
      const fit = zoomedInOn.current === id ? tabFitView(node, elements) : null;
      if (doubleTapFitsTab(zoomedInOn.current === id, zoom, fit)) {
        glide(fit!);
        zoomedInOn.current = null;
        track('Canvas', 'Zoomed', 'DoubleTapFit');
        return;
      }
      // offsetWidth/Height, the canvas's own size, as centreOn reads it (hooks/canvas/useEditorViewport).
      glide(doubleTapZoomView(at, zoom, { width: node.offsetWidth, height: node.offsetHeight }));
      zoomedInOn.current = id;
      track('Canvas', 'Zoomed', 'DoubleTap');
    },
    [mainRef, viewport, glide, latest],
  );
  const onElement = useCallback(
    (el: Element) => {
      const node = mainRef && 'current' in mainRef ? mainRef.current : null;
      // The content layer the element sits in: its on-screen rect is the canvas origin scaled by the zoom.
      const layer = el.closest('[data-canvas-content]');
      if (!node || !layer) return false;
      const zoom = viewport.get().zoom;
      const r = el.getBoundingClientRect();
      const origin = layer.getBoundingClientRect();
      const to = doubleTapFrameView(
        {
          x: (r.left - origin.left) / zoom,
          y: (r.top - origin.top) / zoom,
          width: r.width / zoom,
          height: r.height / zoom,
        },
        { width: r.width, height: r.height },
        zoom,
        { width: node.offsetWidth, height: node.offsetHeight },
      );
      if (!to) return false;
      glide(to);
      zoomedInOn.current = latest.current.id;
      track('Canvas', 'Zoomed', 'DoubleTapElement');
      return true;
    },
    [mainRef, viewport, glide, latest],
  );
  return useMemo(() => ({ onCanvas, onElement }), [onCanvas, onElement]);
}
