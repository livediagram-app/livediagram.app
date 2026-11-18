'use client';

// Prototype mode on a phone goes edge to edge (docs/specs/007-editor/wireframe-pages.md "Safe areas on a phone"): while
// it is open the page's viewport takes `viewport-fit=cover`, so its black runs under the notch, the home indicator and
// the rounded corners, and the device's `env(safe-area-inset-*)` insets turn real for the player to keep its screen and
// pill inside. Closing gives the viewport back exactly as it was, so the editor behind keeps its own (inset-free) fit.
import { useEffect } from 'react';

/** The viewport content with `viewport-fit=cover`, replacing any fit it names. Split on commas, never a regex over
 *  the whole string. */
export function withViewportFitCover(content: string): string {
  const keep = content
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part.split('=')[0]!.trim().toLowerCase() !== 'viewport-fit');
  return [...keep, 'viewport-fit=cover'].join(', ');
}

/** While `on`, the page's viewport meta takes `viewport-fit=cover`; off (or unmounted), it is put back as it was. */
export function useViewportFitCover(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const before = meta.getAttribute('content') ?? '';
    meta.setAttribute('content', withViewportFitCover(before));
    return () => meta.setAttribute('content', before);
  }, [on]);
}
