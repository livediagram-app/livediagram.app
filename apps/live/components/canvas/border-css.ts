import type { BorderStyle } from '@livediagram/diagram';

// CSS `border-style` only understands solid / dashed / dotted (plus a
// few 3D styles we don't use); it can't express the composite dash
// patterns (long-dash, dash-dot, dash-dot-dot). Those render correctly
// through SVG `stroke-dasharray` (BORDER_DASH_ARRAY), so any surface
// that paints its border via a real CSS `border` (the square / circle /
// stadium / browser shapes and the table grid) needs to know which
// styles it can render natively and what to fall back to otherwise.

// The three styles a CSS `border-style` can render exactly.
const CSS_NATIVE: ReadonlySet<BorderStyle> = new Set(['solid', 'dashed', 'dotted']);

// True when the style maps 1:1 to a CSS `border-style` keyword, so a
// CSS-bordered element renders it faithfully without an SVG overlay.
export function isCssNativeBorderStyle(style: BorderStyle): boolean {
  return CSS_NATIVE.has(style);
}

// Nearest CSS `border-style` keyword for a given style. Used where an
// SVG overlay isn't practical (table cell borders): the composite
// patterns degrade to their closest plain equivalent rather than
// silently vanishing.
export function nearestCssBorderStyle(style: BorderStyle): 'solid' | 'dashed' | 'dotted' {
  switch (style) {
    case 'solid':
      return 'solid';
    case 'dotted':
      return 'dotted';
    case 'dashed':
    case 'long-dash':
    case 'dash-dot':
      return 'dashed';
    case 'dash-dot-dot':
      return 'dotted';
  }
}
