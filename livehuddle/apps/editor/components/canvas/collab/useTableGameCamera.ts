'use client';

import { useEffect, useRef } from 'react';
import type { ShapeElement } from '@livehuddle/document';
import { useViewportStoreIfAny } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import { glideViewport } from '@liveworkspace/workbench/lib/viewport-glide';
import { gameCameraView } from '@/lib/table-games/game-camera';

/** How long a stand-up waits before putting the view back, so a fit that leaving the mode starts is seen first. */
export const GAME_CAMERA_RESTORE_MS = 60;

// Sitting down to play on a small screen brings the table close; standing up puts the view back, unless you zoomed
// meanwhile (docs/specs/009-elements/social-pieces.md "On a small screen", Work Item 620). Runs only when `playing`
// changes: the box and the canvas are read when it runs, so a frame of the game costs nothing here.
export function useTableGameCamera(element: ShapeElement, playing: boolean): void {
  const viewport = useViewportStoreIfAny();
  const box = useLatest(element);
  // A stand-up's restore still waiting, and the view from before the sit it would put back: sitting again before it
  // runs (or React re-running the effect) keeps that first view rather than the close one.
  const pending = useRef<{ timer: number; before: View } | null>(null);
  useEffect(() => {
    if (!playing || !viewport) return;
    const waiting = pending.current;
    if (waiting) window.clearTimeout(waiting.timer);
    pending.current = null;
    const node = document.querySelector(`[data-element-id="${CSS.escape(box.current.id)}"]`);
    const main = node?.closest('main');
    if (!main) return;
    const before = waiting?.before ?? viewport.get();
    const { x, y, width, height } = box.current;
    const to = gameCameraView(
      { x, y, width, height },
      { width: main.clientWidth, height: main.clientHeight },
      viewport.get(),
    );
    // Already close (an earlier sit's view still on screen): nothing to glide, but the stand-up still puts it back.
    if (!to && !waiting) return;
    // The last zoom this camera set: still the zoom at the stand-up means nobody else has zoomed since.
    let ours = viewport.get().zoom;
    const set = {
      zoom: (zoom: number) => {
        ours = zoom;
        viewport.setZoom(zoom);
      },
      offset: viewport.setOffset,
    };
    const stop = to ? glideViewport(viewport.get(), to, set) : () => {};
    return () => {
      stop();
      // A zoom of your own while sitting holds; so does a fit that leaving the mode began (it changes the zoom).
      const timer = window.setTimeout(() => {
        pending.current = null;
        if (viewport.get().zoom === ours) glideViewport(viewport.get(), before, set);
      }, GAME_CAMERA_RESTORE_MS);
      pending.current = { timer, before };
    };
  }, [playing, viewport, box]);
}
