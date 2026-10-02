import { useEffectEvent, useLayoutEffect, useState, type RefObject } from 'react';

export type ClientOrigin = { left: number; top: number };

// Where canvas (0, 0) sits on screen: the panned + zoomed wrapper's client rect origin. Overlays drawn
// in fixed client coordinates convert canvas points with it (`left + x * zoom`).
//
// Measured in a layout effect, never during render (docs/specs/003-system-architecture/react-state-and-effects.md),
// and only when it can have moved: on activating, and when `viewKey` changes. The wrapper moves with the
// pan, the zoom and <main>'s size, which the caller folds into `viewKey`; a render that keeps them (every
// frame of a drag) reads no layout (docs/specs/008-canvas/canvas-performance.md). Inactive, it returns null
// and measures nothing.
export function useCanvasClientOrigin(
  wrapperRef: RefObject<HTMLElement | null>,
  active: boolean,
  viewKey: string,
): ClientOrigin | null {
  const [origin, setOrigin] = useState<ClientOrigin | null>(null);
  const measure = useEffectEvent(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const left = rect?.left ?? null;
    const top = rect?.top ?? null;
    setOrigin((prev) => {
      if (left === null || top === null) return null;
      return prev && prev.left === left && prev.top === top ? prev : { left, top };
    });
  });
  useLayoutEffect(() => {
    if (active) measure();
  }, [active, viewKey]);
  return active ? origin : null;
}
