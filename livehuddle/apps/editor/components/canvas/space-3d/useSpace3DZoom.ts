'use client';

// The 3D view's closer camera (docs/specs/008-canvas/3d-view.md "It brings the camera closer"): turning the view on
// while you walk zooms you in by SPACE_3D_ZOOM, and turning it off zooms you back out, so 3D is always closer than
// the flat plan. The zoom eases there over the tilt's length on the tilt's curve, so the camera closes in as it tilts
// rather than jumping a frame ahead of it. Only the switch zooms: a walk that starts in 3D lands at the walking camera's 3D zoom
// (useAvatarCamera), and a walk that ends is framed by Edit. The zoom is the canvas's own, so the zoom controls show
// it; the walking camera keeps you in the middle, which is what the zoom turns about.

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas';
import { space3DEase, space3DZoomIn, space3DZoomOut } from '@/lib/space-3d/space-3d-zoom';
import { SPACE_3D_TILT_MS } from '@/lib/space-3d/space-3d-camera';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { useSpace3DPreference } from './useSpace3DView';

export function useSpace3DZoom(
  walking: boolean,
  zoom: number,
  setZoom: Dispatch<SetStateAction<number>>,
): void {
  const on = useSpace3DPreference();
  // The zoom before the switch turned it on and the zoom it turned on at, so turning it off undoes exactly that.
  const entered = useRef<{ from: number; to: number } | null>(null);
  const wasOn = useRef(on);
  // The zoom as it is now, read when the switch turns (a zoom change alone never zooms).
  const zoomNow = useLatest(zoom);
  // The zoom's ease toward where the switch sends it: the frame it waits on, and the zoom it last set.
  const ease = useRef<{ raf: number; set: Set<number> } | null>(null);
  useEffect(
    () => () => {
      if (ease.current) cancelAnimationFrame(ease.current.raf);
    },
    [],
  );
  useEffect(() => {
    const glide = (from: number, to: number) => {
      if (ease.current) cancelAnimationFrame(ease.current.raf);
      ease.current = null;
      if (prefersReducedMotion() || from === to) {
        setZoom(to);
        return;
      }
      const start = performance.now();
      const step = (now: number) => {
        // A zoom of your own mid-ease takes over: the ease stops where you left it. (The zoom read may still be one
        // the ease set a frame or two ago, until the canvas has drawn the latest: one value per frame of the ease.)
        if (ease.current && !ease.current.set.has(zoomNow.current)) {
          ease.current = null;
          return;
        }
        const t = Math.min(1, (now - start) / SPACE_3D_TILT_MS);
        const z = t >= 1 ? to : from + (to - from) * space3DEase(t);
        setZoom(z);
        if (t >= 1 || !ease.current) {
          ease.current = null;
          return;
        }
        ease.current.set.add(z);
        ease.current.raf = requestAnimationFrame(step);
      };
      ease.current = { raf: requestAnimationFrame(step), set: new Set([from]) };
    };
    if (on === wasOn.current) return;
    wasOn.current = on;
    if (!walking) return;
    const z = zoomNow.current;
    if (on) {
      const to = space3DZoomIn(z, ZOOM_MIN, ZOOM_MAX);
      entered.current = { from: z, to };
      glide(z, to);
    } else {
      glide(z, space3DZoomOut(z, entered.current, ZOOM_MIN, ZOOM_MAX));
      entered.current = null;
    }
  }, [on, walking, setZoom, zoomNow]);
}
