import { useCallback, useLayoutEffect, type RefObject } from 'react';

// A menu tile's miniature runs the real animation classes (docs/specs/028-animation/element-animations.md
// "The menu"), so it shows exactly what picking it does. At rest it is frozen on a telling frame,
// `frame` (0 to 1 of a cycle), so the options read apart at a glance without a grid of loops
// competing for attention; hovering plays it, leaving freezes it again. All through the Web
// Animations API on the CSS animations already there: one call on mount, no loop, no timers.
// Under reduced motion there are no animations, so the miniature simply shows its rest frame.

function animationsIn(root: Element | null): Animation[] {
  return root && typeof root.getAnimations === 'function'
    ? root.getAnimations({ subtree: true })
    : [];
}

function freeze(root: Element | null, frame: number): void {
  for (const a of animationsIn(root)) {
    const duration = Number(a.effect?.getComputedTiming().duration) || 0;
    a.pause();
    a.currentTime = frame * duration;
  }
}

export function useFrozenAnimations(
  ref: RefObject<Element | null>,
  frame: number,
): { play: () => void; rest: () => void } {
  useLayoutEffect(() => freeze(ref.current, frame), [ref, frame]);
  const play = useCallback(() => animationsIn(ref.current).forEach((a) => a.play()), [ref]);
  const rest = useCallback(() => freeze(ref.current, frame), [ref, frame]);
  return { play, rest };
}
