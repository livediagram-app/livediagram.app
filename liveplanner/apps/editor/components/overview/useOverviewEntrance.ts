'use client';

// Whether the Overview is still opening (docs/specs/026-plan/plan-overview.md "Opening"): true from its first frame
// until its entrance has settled, which is when globals.css lets the page's content rise in. After that nothing on
// the page animates as it re-renders or as tiles arrive. An exit hold, so it runs for the entrance's own length (the
// motion ceiling) and a frame to spare.
import { useEffect, useState } from 'react';
import { MOTION_CEILING_MS } from '@liveworkspace/style-guards/motion';

export const OVERVIEW_ENTRANCE_MS = MOTION_CEILING_MS + 50;

export function useOverviewEntrance(): boolean {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), OVERVIEW_ENTRANCE_MS);
    return () => clearTimeout(t);
  }, []);
  return entering;
}
