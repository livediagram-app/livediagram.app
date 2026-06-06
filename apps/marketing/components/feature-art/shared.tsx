// Shared primitives for the landing-page feature illustrations,
// split out of FeatureArt.tsx. Color constants + the Frame surface
// every art scene sits in. Scenes live in ./canvas, ./foundations,
// ./features, ./versatility; FeatureArt.tsx re-exports them all.
//
// Motion is pure CSS (fa-* classes + keyframes in globals.css) so it
// survives the static export and degrades under prefers-reduced-motion.

import type { ReactNode } from 'react';

export const BLUE_FILL = '#dbeafe';
export const BLUE_STROKE = '#0284c7';
export const BLUE_TEXT = '#0c4a6e';
export const PINK = '#ec4899';
export const SKY = '#0ea5e9';

// Bordered surface every illustration sits in. `canvas` paints the
// editor's dot-grid; otherwise it's a plain panel (explorer, dialog…).
export function Frame({ children, canvas = false }: { children: ReactNode; canvas?: boolean }) {
  return (
    <div
      aria-hidden
      className={
        'relative mb-5 h-24 w-full overflow-hidden rounded-md border border-slate-200 ' +
        (canvas
          ? 'bg-white bg-[radial-gradient(circle_at_center,_#d8dee8_1px,_transparent_1px)] bg-[size:13px_13px]'
          : 'bg-slate-50')
      }
    >
      {children}
    </div>
  );
}
