import type { CSSProperties } from 'react';

// Tokens every product's scene art shares: the hero windows and the feature cards. Each product's
// components/art-tokens.ts re-exports these beside its own `YOU` (the person's colour on the canvas, in the
// product's hue). The scenes' own palettes (INK, MUTED, PANEL, ...) differ on purpose and stay with each scene.

// The sans stack the art's SVG text is set in.
export const FONT = 'ui-sans-serif, system-ui, sans-serif';

// A teammate on the canvas, in their own colour.
export const TEAMMATE = '#ec4899';

/** A mark's build delay as the `--d` custom property the hm-* / fa-f-* keyframes read, plus any extra vars. */
export const at = (d: number, extra: Record<string, string | number> = {}) =>
  ({ '--d': `${d}s`, ...extra }) as CSSProperties;
