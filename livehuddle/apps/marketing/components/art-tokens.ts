import type { CSSProperties } from 'react';

// Tokens every scene's SVG art shares: the hero windows (components/hero-*.tsx) and the
// feature cards (components/feature-art/). The scenes' own palettes (INK, MUTED, PANEL, ...)
// differ on purpose and stay with each scene.

// The sans stack the art's SVG text is set in.
export const FONT = 'ui-sans-serif, system-ui, sans-serif';

// People on the canvas: you, and a teammate in their own colour.
export const YOU = '#0ea5e9';
export const TEAMMATE = '#ec4899';

/** A mark's build delay as the `--d` custom property the hm-* / fa-f-* keyframes read, plus any extra vars. */
export const at = (d: number, extra: Record<string, string | number> = {}) =>
  ({ '--d': `${d}s`, ...extra }) as CSSProperties;
