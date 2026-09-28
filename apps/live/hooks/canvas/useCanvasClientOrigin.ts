import { useEffectEvent, useLayoutEffect, useState, type RefObject } from 'react';

export type ClientOrigin = { left: number; top: number };

// Where canvas (0, 0) sits on screen: the panned + zoomed wrapper's client rect origin. Overlays drawn
// in fixed client coordinates convert canvas points with it (`left + x * zoom`).
//
// Measured after every commit while `active`, never during render
// (docs/specs/003-system-architecture/react-state-and-effects.md). The wrapper moves with the pan, the
// zoom and <main>'s own layout, none of which this hook can list, so the layout effect has no dependency
// list: it runs before paint, reads the wrapper as this commit left it, and re-renders only when the
// origin actually moved. Inactive, it returns null and measures nothing, so an idle overlay costs no
// layout.
export function useCanvasClientOrigin(
  wrapperRef: RefObject<HTMLElement | null>,
  active: boolean,
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
  });
  return active ? origin : null;
}
