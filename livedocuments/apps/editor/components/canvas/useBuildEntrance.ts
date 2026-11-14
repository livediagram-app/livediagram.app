'use client';

// A build's entrance on a presented slide (docs/specs/012-collaboration/presentation-mode.md "Builds"): the elements a
// forward step brought in fade, or fade and rise, into place. Played with the Web Animations API on the nodes the
// canvas just mounted, in a layout effect so the first frame painted is already the start of the move. Only
// `opacity` and `translate` are touched: an element's `transform` carries its rotation, and its own animation class
// owns the `animation` property. Nothing plays under reduced motion or for Appear: those cut in.

import { useEffectEvent, useLayoutEffect, type RefObject } from 'react';
import type { BuildEffect } from '@livedocuments/document';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';

/** How long a build comes in (PM3). */
export const BUILD_ENTER_MS = 420;
/** How far Rise travels into place, in canvas px (PM3): the canvas's zoom scales it with the slide. */
export const BUILD_RISE_PX = 28;
// Decelerate, no overshoot: the slide moves' curve.
const BUILD_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export type BuildEntrance = {
  // One object per step, so a re-render with the same step never replays it.
  key: object;
  items: readonly { id: string; effect: BuildEffect }[];
};

/** The keyframes an effect plays, or null for one that cuts in. */
export function buildKeyframes(effect: BuildEffect): Keyframe[] | null {
  if (effect === 'fade') return [{ opacity: 0 }, {}];
  if (effect === 'rise') return [{ opacity: 0, translate: `0 ${BUILD_RISE_PX}px` }, {}];
  return null;
}

// The node an element is drawn as: a boxed element's wrapper, or the group an arrow's hit band sits in.
function nodeOf(root: ParentNode, id: string): Element | null {
  const hit = root.querySelector(`[data-element-id="${CSS.escape(id)}"]`);
  if (!hit) return null;
  return hit instanceof SVGElement && hit.parentElement ? hit.parentElement : hit;
}

export function useBuildEntrance(
  entrance: BuildEntrance | null,
  rootRef: RefObject<HTMLElement | null>,
): void {
  const play = useEffectEvent(() => {
    const root = rootRef.current;
    if (!entrance || !root || prefersReducedMotion()) return;
    for (const { id, effect } of entrance.items) {
      const frames = buildKeyframes(effect);
      const node = frames ? nodeOf(root, id) : null;
      if (!node || typeof node.animate !== 'function') continue;
      node.animate(frames!, { duration: BUILD_ENTER_MS, easing: BUILD_EASING });
    }
  });
  const key = entrance?.key;
  useLayoutEffect(() => {
    if (key) play();
  }, [key]);
}
