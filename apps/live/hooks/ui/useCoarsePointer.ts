// Is this a touch device? Used where the COPY has to name the gesture — "double-
// tap" vs "double-click" on the Reveal zone (spec/106) — which a viewport
// breakpoint can't answer: a tablet is wide and still touch-only.
//
// Starts false and settles after mount, so the static-export render and the
// first client paint agree (a media query read during render would differ
// between the two and trip hydration).

import { useEffect, useState } from 'react';

export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(hover: none)');
    if (!query) return;
    setCoarse(query.matches);
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return coarse;
}
