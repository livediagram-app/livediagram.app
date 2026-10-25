'use client';

import { useMediaQuery } from '@liveworkspace/ui';
import { LANDSCAPE_PHONE_MEDIA_QUERY, PHONE_MEDIA_QUERY } from '../../lib/responsive';

// Reactive "is this a mobile viewport?": narrower than Tailwind's `sm` (640px), or a touch screen
// under 500px tall (a phone in landscape; lib/responsive). Unlike isMobileViewportSync() (a one-shot read for effect bodies),
// this re-renders the caller when the viewport crosses the breakpoint, so a
// desktop-only surface mounts / unmounts on resize.
const QUERY = PHONE_MEDIA_QUERY;

export function useIsMobileViewport(): boolean {
  return useMediaQuery(QUERY);
}

// Reactive "is this a phone held sideways?" (docs/specs/007-editor/editor-app.md "A phone held sideways"),
// for what is withheld there rather than folded: the CSS `landscape-phone:` variant hides, this removes.
export function useIsLandscapePhone(): boolean {
  return useMediaQuery(LANDSCAPE_PHONE_MEDIA_QUERY);
}
