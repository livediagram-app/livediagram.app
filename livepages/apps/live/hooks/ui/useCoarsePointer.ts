'use client';

import { useMediaQuery } from '@livepages/ui';

// Is this a touch device? Used where the COPY or the controls have to suit the
// gesture ("tap" vs "click"), which a viewport breakpoint can't answer: a tablet is wide and still touch-only.
//
// The shared useMediaQuery's server snapshot is false, so the static-export
// render and the first hydrated paint agree (no hydration mismatch) and it
// settles to the real answer straight after, as the hand-rolled effect here
// used to.
export function useCoarsePointer(): boolean {
  return useMediaQuery('(hover: none)');
}
