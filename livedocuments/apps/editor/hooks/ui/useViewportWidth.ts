'use client';

import { useSyncExternalStore } from 'react';

// The window's inner width, re-read on resize (and rotation): an external store, so the prerender and the render
// that hydrates it read 0 ("not measured yet") and the browser reads the window
// (docs/specs/003-system-architecture/react-state-and-effects.md "Rendering in the browser only").
const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};
const width = () => window.innerWidth;
const unmeasured = () => 0;

export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, width, unmeasured);
}
