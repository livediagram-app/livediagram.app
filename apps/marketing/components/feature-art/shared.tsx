// Shared primitives for the feature-card illustrations: the Frame surface every
// scene sits in and the few colours the SVG attributes restate. The scenes live in
// one file per subject beside this one; FeatureArt.tsx re-exports them all.
//
// Motion is pure CSS (fa-* classes + keyframes in app/feature-art-animations.css) so
// it survives the static export and settles under prefers-reduced-motion.

import type { ReactNode } from 'react';

// Every diagram element reads the canvas palette (app/hero-animations.css) through a
// utility: fill-(--art-ink-fill), stroke-(--art-ink-stroke), fill-(--art-ink-text),
// stroke-(--art-arrow) and so on, the Default scheme's light or dark half with the
// appearance. These restate the light half for the SVG attributes underneath.
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
