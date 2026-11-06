'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { glideViewport } from '@liveworkspace/workbench/lib/viewport-glide';
import { STRIP_MORPH_MS } from '@/lib/strip-morph';

type Point = { x: number; y: number };

// Reads the character's live feet (canvas px), or null outside Avatar mode. Set by the canvas (useCanvasAvatar).
export type AvatarAtRef = React.RefObject<(() => Point | null) | null>;

// Avatar mode's camera, the editor's half (docs/specs/008-canvas/avatar-mode.md "The camera"): entering the mode and
// Fit go to 100% centred on the character, and the wheel / pinch zoom about it. The walk's own centring lives in the
// shared walk hook (`camera: 'centred'`). Select and Hand keep the plain Fit and the pointer-anchored zoom.
export function useAvatarCamera({
  walking,
  tabId,
  viewport,
  canvasMainRef,
  fitToScreen,
  fitOnEdit,
}: {
  // True while the Avatar tool is active.
  walking: boolean;
  // The active tab: travel to another one keeps the mode, and arrives centred like an entry ("Changing tab").
  tabId?: string;
  viewport: ViewportStore;
  canvasMainRef: React.RefObject<HTMLElement | null>;
  // Frames the whole tab: Fit outside the mode.
  fitToScreen: () => void;
  // Switching from Walk to Edit on the same tab glides the view out to the whole tab ("The Edit | Walk toggle"); the
  // host leaves an empty tab's view alone. Never on a load: only a walk ending fires it.
  fitOnEdit?: (() => void) | undefined;
}) {
  const avatarAtRef = useRef<(() => Point | null) | null>(null);
  const walkingRef = useLatest(walking);

  const avatarAt = useCallback(
    () => (walkingRef.current ? (avatarAtRef.current?.() ?? null) : null),
    [walkingRef],
  );

  // The entry's glide in flight, if any: a later move (Fit, leaving, another entry) stops it where it got to.
  const glideRef = useRef<(() => void) | null>(null);
  const stopGlide = useCallback(() => {
    glideRef.current?.();
    glideRef.current = null;
  }, []);
  useEffect(() => stopGlide, [stopGlide]);

  // 100% with the feet in the middle, at once or gliding over `glideMs`. The wrapper scales about its own centre, so
  // the offset that centres a point is half the canvas's size less the point, at any zoom (as useEditorViewport's
  // centreOn).
  const centreAvatar = useCallback(
    (glideMs = 0) => {
      const at = avatarAt();
      const node = canvasMainRef.current;
      if (!at || !node) return false;
      const to = {
        zoom: 1,
        offset: { x: node.offsetWidth / 2 - at.x, y: node.offsetHeight / 2 - at.y },
      };
      stopGlide();
      if (glideMs > 0) {
        glideRef.current = glideViewport(
          viewport.get(),
          to,
          {
            zoom: (zoom) => viewport.setZoom(zoom),
            offset: (offset) => viewport.setOffset(offset),
          },
          glideMs,
        );
      } else viewport.setView(to);
      return true;
    },
    [avatarAt, canvasMainRef, viewport, stopGlide],
  );

  const fitView = useCallback(() => {
    if (!centreAvatar()) fitToScreen();
  }, [centreAvatar, fitToScreen]);

  // Entering the mode: once the canvas has placed the character (its entry runs in the same commit), centre on it.
  // Switching to Walk on the same tab glides in beside the strip's morph, as Edit glides out ("The Edit | Walk
  // toggle"); a load, opening walking and travel to another tab (which keeps the mode, the character placed with the
  // switch) land at once.
  const lastEntry = useRef<{ walking: boolean; tabId?: string | undefined } | null>(null);
  useEffect(() => {
    const was = lastEntry.current;
    lastEntry.current = { walking, tabId };
    if (!walking) {
      stopGlide();
      return;
    }
    const glideMs = was && !was.walking && was.tabId === tabId ? STRIP_MORPH_MS : 0;
    const frame = requestAnimationFrame(() => centreAvatar(glideMs));
    return () => cancelAnimationFrame(frame);
  }, [walking, tabId, centreAvatar, stopGlide]);

  // Leaving the mode: the walk was close up on the character, so building opens on the whole tab. Only a change of
  // `walking` on the same tab counts (the first render, a reload or a tab change never fits here).
  const fitOnEditRef = useLatest(fitOnEdit);
  const seen = useRef({ walking, tabId });
  useEffect(() => {
    const was = seen.current;
    seen.current = { walking, tabId };
    if (was.walking && !walking && was.tabId === tabId) fitOnEditRef.current?.();
  }, [walking, tabId, fitOnEditRef]);

  // Where the character stands on screen (client px), for the wheel and pinch to zoom about.
  const zoomAnchor = useCallback((): Point | null => {
    const at = avatarAt();
    const rect = canvasMainRef.current?.getBoundingClientRect();
    if (!at || !rect) return null;
    const { zoom, offset } = viewport.get();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    return {
      x: rect.left + cx + zoom * (at.x + offset.x - cx),
      y: rect.top + cy + zoom * (at.y + offset.y - cy),
    };
  }, [avatarAt, canvasMainRef, viewport]);

  return { avatarAtRef, fitView, zoomAnchor };
}
