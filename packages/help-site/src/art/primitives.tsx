// Shared SVG building blocks for every help centre's illustrations (docs/specs/018-help/help-app.md in each product).
//
// Every illustration in `components/illustrations/*` is composed from these
// primitives so the whole help centre reads as one coherent window into the
// real editor: white panels with slate borders, the product's `brand` accents,
// muted slate "text" bars, and the same shapes / arrows / cursors the canvas
// draws. Keeping the kit here (rather than re-spelling rects per scene) is the
// no-duplication rule applied to artwork: a tweak to the house style lands in
// one place. The richer category scenes live in sibling files and import from
// here; `<Figure>` frames whatever a scene returns.
//
// Coordinates are plain SVG user units inside a per-scene `viewBox`; pick scene
// dimensions so labels land around 11-14 units tall and stay legible when the
// figure scales down on mobile.

import { useId, type ReactNode } from 'react';

export * from './primitives-text';
export * from './primitives-canvas';
export * from './primitives-chrome';

// --- Scene shell -------------------------------------------------------------

/** The SVG canvas a scene draws into. `bg="canvas"` lays down the editor's
 *  faint dot grid; `bg="plain"` a soft brand wash; `bg="none"` nothing. */
export function Scene({
  w = 400,
  h = 240,
  bg = 'canvas',
  children,
}: {
  w?: number;
  h?: number;
  bg?: 'canvas' | 'plain' | 'none';
  children: ReactNode;
}) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="help-art h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
      // The picture's words are its Figure's caption, which names the <figure> for a screen reader; as an unnamed
      // role="img" it was an image with no alternative (axe svg-img-alt) on every illustrated article.
      aria-hidden
      focusable="false"
    >
      <defs>
        <pattern id={`grid-${gid}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="fill-slate-200" />
        </pattern>
      </defs>
      {bg === 'canvas' && <rect x={0} y={0} width={w} height={h} fill={`url(#grid-${gid})`} />}
      {bg === 'plain' && <rect x={0} y={0} width={w} height={h} className="fill-brand-50/40" />}
      {children}
    </svg>
  );
}
