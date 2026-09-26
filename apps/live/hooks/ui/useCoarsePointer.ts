'use client';

import { useMediaQuery } from '@livediagram/ui';

// Is this a touch device? Used where the COPY has to name the gesture ("double-
// tap" vs "double-click" on the Reveal zone, spec/106), which a viewport
// breakpoint can't answer: a tablet is wide and still touch-only.
//
// The shared useMediaQuery's server snapshot is false, so the static-export
// render and the first hydrated paint agree (no hydration mismatch) and it
// settles to the real answer straight after, as the hand-rolled effect here
// used to.
export function useCoarsePointer(): boolean {
  return useMediaQuery('(hover: none)');
}
