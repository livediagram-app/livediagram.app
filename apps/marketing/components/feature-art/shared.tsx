// Shared primitives for the landing-page feature illustrations,
// split out of FeatureArt.tsx. Color constants + the Frame surface
// every art scene sits in. Scenes live in ./canvas, ./foundations,
// ./features, ./versatility; FeatureArt.tsx re-exports them all.
//
// Motion is pure CSS (fa-* classes + keyframes in globals.css) so it
// survives the static export and degrades under prefers-reduced-motion.

import type { ReactNode } from 'react';

// Every diagram element reads the canvas palette (app/hero-animations.css) through a
// utility: fill-(--art-ink-fill), stroke-(--art-ink-stroke), fill-(--art-ink-text),
// stroke-(--art-arrow) and so on, the Default scheme's light or dark half with the
// appearance. These restate the light half for the SVG attributes underneath.
export const INK_FILL = '#f0f9ff';
export const INK_STROKE = '#0ea5e9';
export const INK_TEXT = '#075985';
export const ARROW_STROKE = '#334155';
// The chrome accent (brand-600) a panel glyph is drawn in; dark lifts it to
// dark:stroke-brand-300. BLUE_FILL is the tint the light/dark mock paints its shapes.
export const BLUE_FILL = '#dbeafe';
export const BLUE_STROKE = '#0284c7';
export const PINK = '#ec4899';
export const SKY = '#0ea5e9';

// Bordered surface every illustration sits in. `canvas` paints the
// editor's dot-grid on the Default scheme's canvas; otherwise
// it's a plain panel (explorer, dialog…).
export function Frame({ children, canvas = false }: { children: ReactNode; canvas?: boolean }) {
  return (
    <div
      aria-hidden
      className={
        'relative mb-5 h-24 w-full overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 ' +
        (canvas
          ? 'bg-(color:--art-paper) bg-[radial-gradient(circle_at_center,_var(--art-grid)_1px,_transparent_1px)] bg-[size:13px_13px]'
          : 'bg-slate-50 dark:bg-slate-950')
      }
    >
      {children}
    </div>
  );
}
