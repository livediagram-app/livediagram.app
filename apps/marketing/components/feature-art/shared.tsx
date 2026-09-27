// Shared primitives for the landing-page feature illustrations,
// split out of FeatureArt.tsx. Color constants + the Frame surface
// every art scene sits in. Scenes live in ./canvas, ./foundations,
// ./features, ./versatility; FeatureArt.tsx re-exports them all.
//
// Motion is pure CSS (fa-* classes + keyframes in globals.css) so it
// survives the static export and degrades under prefers-reduced-motion.

import type { ReactNode } from 'react';

// The Default scheme's ink in light. In dark every use carries its partner from the
// dark canvas palette (app/hero-animations.css): dark:fill-(--art-ink-fill),
// dark:stroke-(--art-ink-stroke), dark:fill-(--art-ink-text). A chrome glyph drawn in
// BLUE_STROKE is an accent instead, so it takes dark:stroke-brand-300.
export const BLUE_FILL = '#dbeafe';
export const BLUE_STROKE = '#0284c7';
export const BLUE_TEXT = '#0c4a6e';
export const PINK = '#ec4899';
export const SKY = '#0ea5e9';

// Bordered surface every illustration sits in. `canvas` paints the
// editor's dot-grid (in dark, the Default scheme's dark canvas); otherwise
// it's a plain panel (explorer, dialog…).
export function Frame({ children, canvas = false }: { children: ReactNode; canvas?: boolean }) {
  return (
    <div
      aria-hidden
      className={
        'relative mb-5 h-24 w-full overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 ' +
        (canvas
          ? 'bg-white bg-[radial-gradient(circle_at_center,_#d8dee8_1px,_transparent_1px)] bg-[size:13px_13px] dark:bg-(color:--art-paper) dark:bg-[radial-gradient(circle_at_center,_var(--art-grid)_1px,_transparent_1px)]'
          : 'bg-slate-50 dark:bg-slate-950')
      }
    >
      {children}
    </div>
  );
}
