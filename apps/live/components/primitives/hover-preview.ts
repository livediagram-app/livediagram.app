'use client';

// Shared helpers for the hover-to-preview tiles — the style-preset tiles
// (spec/48, StylePresets.tsx) and the animation tiles (spec/09,
// context-menu-tiles.tsx). Both want the same two behaviours, so they live here
// rather than being copied into each.

import { useEffect, useRef } from 'react';

// Wrap a preview callback so it only fires for a desktop MOUSE pointer:
// hovering a tile previews live, but touch / pen taps must not — on those a tap
// IS the commit, so a preview-then-revert would just flicker. `(hover: hover)`
// devices send pointerenter with pointerType 'mouse'.
export const onMouseHover =
  (fn: () => void) =>
  (e: React.PointerEvent): void => {
    if (e.pointerType === 'mouse') fn();
  };

// Revert any in-flight hover preview when the tile surface unmounts — the menu
// closing, the section collapsing, or the selection changing can all happen
// while the pointer is still over a tile, and a pointerleave does NOT fire on
// unmount. A latest-callback ref keeps the cleanup from capturing a stale
// revert closure.
export function useRevertOnUnmount(onPreviewEnd: () => void) {
  const ref = useRef(onPreviewEnd);
  ref.current = onPreviewEnd;
  useEffect(() => () => ref.current(), []);
}
