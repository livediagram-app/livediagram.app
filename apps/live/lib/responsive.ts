// Single source of truth for "is this a mobile viewport?" used by
// JS code paths that can't rely on Tailwind's `sm:` CSS variant
// alone (default state in a useState initializer, conditional
// branches in a useEffect, etc.). Matches Tailwind's `sm`
// breakpoint at 640px so JS and CSS gates flip together.
//
// Two helpers, one purpose:
//   - `isMobileViewportSync()` runs during render / inside
//     useEffect bodies. Guards against SSR / static-export's
//     first pass where `window` is undefined.
//   - `MOBILE_BREAKPOINT_PX` is exported for callers that need
//     the raw threshold (e.g. legacy `innerWidth` comparisons
//     that haven't been migrated, or use a different operator).
//
// Touch-device detection (`(hover: none)`) is a different concept
// and lives in the `useCoarsePointer` hook, for the places where the
// COPY has to name the gesture ("double-tap" vs "double-click"): a
// tablet is a wide viewport and still touch-only, so neither helper
// here can answer it.

export const MOBILE_BREAKPOINT_PX = 640;

export function isMobileViewportSync(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`).matches ?? false;
}
