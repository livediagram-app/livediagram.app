'use client';

import { useEffect, useState } from 'react';

// The window's inner width, re-read on resize (and rotation). 0 before the
// first client read, so callers treat that as "not measured yet".
export function useViewportWidth(): number {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}
