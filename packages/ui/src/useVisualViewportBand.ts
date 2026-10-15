'use client';

import { useSyncExternalStore } from 'react';

// The part of the page a person can actually see while it differs from the window (docs/specs/007-editor/
// live-app.md "A dialog stays above the on-screen keyboard"). A touch screen's keyboard shrinks the VISUAL
// viewport, not the layout one that `position: fixed` and `vh` measure against, so a modal centred in the window
// sat half under the keyboard. Null while the visible area is the whole window (no keyboard, no pinch zoom), so
// a desktop dialog keeps its own CSS placement untouched.

export type VisualViewportBand = { top: number; left: number; width: number; height: number };

// Below this (px) a difference between the visible area and the window is rounding, not a keyboard.
export const VISUAL_VIEWPORT_SLACK_PX = 1;

// The visible band now, or null when it is the whole window (or there is no visualViewport to read).
export function readVisualViewportBand(): VisualViewportBand | null {
  if (typeof window === 'undefined') return null;
  const vv = window.visualViewport;
  if (!vv) return null;
  // The layout viewport: the root's client height is stable under iOS's keyboard, where innerHeight can follow
  // the visual viewport; jsdom reports 0 there, so the window's height stands in.
  const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
  const covered =
    layoutHeight - vv.height > VISUAL_VIEWPORT_SLACK_PX ||
    Math.abs(vv.offsetTop) > VISUAL_VIEWPORT_SLACK_PX;
  if (!covered) return null;
  return { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height };
}

// The last band read, so an unchanged viewport hands React the same object and renders nothing.
let cached: VisualViewportBand | null = null;

function snapshot(): VisualViewportBand | null {
  const next = readVisualViewportBand();
  if (
    next &&
    cached &&
    next.top === cached.top &&
    next.left === cached.left &&
    next.width === cached.width &&
    next.height === cached.height
  )
    return cached;
  cached = next;
  return cached;
}

function subscribe(onChange: () => void): () => void {
  const vv = typeof window === 'undefined' ? null : window.visualViewport;
  if (!vv) return () => {};
  // Resize: the keyboard rising or falling. Scroll: iOS panning the visible area across the page, which a drag
  // with the keyboard up also does.
  vv.addEventListener('resize', onChange);
  vv.addEventListener('scroll', onChange);
  window.addEventListener('resize', onChange);
  return () => {
    vv.removeEventListener('resize', onChange);
    vv.removeEventListener('scroll', onChange);
    window.removeEventListener('resize', onChange);
  };
}

// Listens only while mounted, and only reads on a viewport event: nothing runs per frame at rest.
export function useVisualViewportBand(): VisualViewportBand | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
