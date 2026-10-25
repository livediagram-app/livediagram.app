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

// A phone held sideways is wide (844px) but short, and was laid out as a desktop: the floating
// panels covered its 286px of canvas. So a phone is also a touch screen under 500px tall
// (docs/specs/007-editor/editor-app.md "Mobile chrome"). A desktop window that short has a fine
// pointer, and a tablet is taller, so neither is caught. The CSS twin is the `phone:` variant
// (app/globals.css), which must state the same query.
export const PHONE_MAX_HEIGHT_PX = 500;
export const PHONE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px), (pointer: coarse) and (max-height: ${PHONE_MAX_HEIGHT_PX - 1}px)`;

// A phone held sideways, alone: the short-touch half of PHONE_MEDIA_QUERY, in landscape. There the
// header and the tab bar fold away so the canvas fills the screen (docs/specs/007-editor/editor-app.md
// "A phone held sideways"). `orientation: landscape` keeps an upright phone whose layout shrinks for
// its keyboard from folding mid-typing. The CSS twin is the `landscape-phone:` variant (app/globals.css).
export const LANDSCAPE_PHONE_MEDIA_QUERY = `(pointer: coarse) and (orientation: landscape) and (max-height: ${PHONE_MAX_HEIGHT_PX - 1}px)`;

export function isMobileViewportSync(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.(PHONE_MEDIA_QUERY).matches ?? false;
}
