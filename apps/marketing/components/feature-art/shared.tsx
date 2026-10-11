// Shared primitives for the feature-card illustrations: the Frame surface every
// scene sits in and the few colours the SVG attributes restate. The scenes live in
// one file per subject beside this one; FeatureArt.tsx re-exports them all.
//
// Motion is pure CSS (fa-* classes + keyframes in app/feature-art/*.css) so
// it survives the static export and settles under prefers-reduced-motion.

import type { ReactNode } from 'react';

// Every diagram element reads the canvas palette (app/hero-animations.css) through a
// utility: fill-(--art-ink-fill), stroke-(--art-ink-stroke), fill-(--art-ink-text),
// stroke-(--art-arrow) and so on, the Default scheme's light or dark half with the
// appearance. These restate the light half for the SVG attributes underneath.
export const PINK = '#ec4899';
export const SKY = '#0ea5e9';
export const VIOLET = '#8b5cf6';
export const EMERALD = '#10b981';
export const AMBER = '#f59e0b';
export const ROSE = '#f43f5e';

// The monospace stack code and terminal text is set in.
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

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

/**
 * A teammate's pointer with an optional name tag, its tip at (0, 0) of the group. `size` is the
 * arrow's height in viewBox units and the tag scales with it, so each family of cards keeps its own
 * scale through one drawing. `flip` hangs the tag up and to the left, for a pointer near the right edge.
 */
export function Cursor({
  color,
  name,
  size = 10,
  flip = false,
}: {
  color: string;
  name?: string;
  size?: number;
  flip?: boolean;
}) {
  const tag = name ? name.length * 4.2 + 6 : 0;
  return (
    <g transform={size === 10 ? undefined : `scale(${size / 10})`}>
      <path
        d="M0 0 L0 10 L2.8 7.4 L4.6 11.4 L6.2 10.7 L4.4 6.8 L8.2 6.6 Z"
        fill={color}
        stroke="#fff"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {name ? (
        <g transform={flip ? `translate(${-(tag + 2)} -9)` : 'translate(7 10)'}>
          <rect width={tag} height="8.5" rx="2.5" fill={color} />
          <text x="3" y="6.1" fontSize="5.8" fontWeight="700" fill="#fff">
            {name}
          </text>
        </g>
      ) : null}
    </g>
  );
}
