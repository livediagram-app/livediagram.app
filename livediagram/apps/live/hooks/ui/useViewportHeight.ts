'use client';

import { useSyncExternalStore } from 'react';

// The window's inner height, re-read on resize (and rotation): useViewportWidth's twin, for surfaces that need both
// (the side by side split's minimum window, docs/specs/007-editor/split-view.md). An external store, so the
// prerender and the render that hydrates it read 0 and the browser reads the window.
const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};
const height = () => window.innerHeight;
const unmeasured = () => 0;

export function useViewportHeight(): number {
  return useSyncExternalStore(subscribe, height, unmeasured);
}
