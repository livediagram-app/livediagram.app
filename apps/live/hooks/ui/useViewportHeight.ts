'use client';

import { useEffect, useState } from 'react';

// The window's inner height, re-read on resize (and rotation): useViewportWidth's twin, for
// surfaces that need both (the side by side split's minimum window, docs/specs/007-editor/split-view.md).
// 0 before the first client read.
export function useViewportHeight(): number {
  const [height, setHeight] = useState(() =>
    typeof window === 'undefined' ? 0 : window.innerHeight,
  );
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return height;
}
