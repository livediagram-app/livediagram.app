'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

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
}: {
  // True while the Avatar tool is active.
  walking: boolean;
  // The active tab: travel to another one keeps the mode, and arrives centred like an entry ("Changing tab").
  tabId?: string;
  viewport: ViewportStore;
  canvasMainRef: React.RefObject<HTMLElement | null>;
  // Frames the whole tab: Fit outside the mode.
  fitToScreen: () => void;
}) {
  const avatarAtRef = useRef<(() => Point | null) | null>(null);
  const walkingRef = useLatest(walking);

  const avatarAt = useCallback(
    () => (walkingRef.current ? (avatarAtRef.current?.() ?? null) : null),
    [walkingRef],
  );

  // 100% with the feet in the middle. The wrapper scales about its own centre, so the offset that centres a point is
  // half the canvas's size less the point, at any zoom (as useEditorViewport's centreOn).
  const centreAvatar = useCallback(() => {
    const at = avatarAt();
    const node = canvasMainRef.current;
    if (!at || !node) return false;
    viewport.setView({
      zoom: 1,
      offset: { x: node.offsetWidth / 2 - at.x, y: node.offsetHeight / 2 - at.y },
    });
    return true;
  }, [avatarAt, canvasMainRef, viewport]);

  const fitView = useCallback(() => {
    if (!centreAvatar()) fitToScreen();
  }, [centreAvatar, fitToScreen]);

  // Entering the mode: once the canvas has placed the character (its entry runs in the same commit), centre on it.
  // Travel to another tab keeps the mode, so arriving re-runs this too: the character was placed with the switch.
  useEffect(() => {
    if (!walking) return;
    const frame = requestAnimationFrame(() => centreAvatar());
    return () => cancelAnimationFrame(frame);
  }, [walking, tabId, centreAvatar]);

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
