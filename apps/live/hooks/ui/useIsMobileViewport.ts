'use client';

import { useMediaQuery } from '@livediagram/ui';
import { MOBILE_BREAKPOINT_PX } from '@/lib/responsive';

// Reactive "is this a mobile viewport?" gated on Tailwind's `sm` breakpoint
// (640px). Unlike isMobileViewportSync() (a one-shot read for effect bodies),
// this re-renders the caller when the viewport crosses the breakpoint, so a
// desktop-only surface mounts / unmounts on resize.
const QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;

export function useIsMobileViewport(): boolean {
  return useMediaQuery(QUERY);
}
