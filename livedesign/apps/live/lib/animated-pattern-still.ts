// The animated backdrops' motifs (docs/specs/008-canvas/canvas-and-palette.md), shared by the live overlay
// (components/canvas/AnimatedCanvasBackground.tsx) and a still frame of them as SVG, for the Looks cards
// (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"). A card is a static picture, so it shows the motif at rest
// rather than running the overlay: six moving cards would break the motion budget, and the overlay sizes its motifs in
// viewport units, which a card cannot.
import type { BackgroundPattern } from '@livedesign/design';

/** Aurora's glows: the top-left corner of each (percent of the backdrop), its size (vmax), drift (percent) and period
 *  (seconds). */
export const AURORA_GLOWS: readonly {
  top: number;
  left: number;
  size: number;
  dx: number;
  dy: number;
  dur: number;
}[] = [
  { top: 8, left: 12, size: 46, dx: 8, dy: 6, dur: 26 },
  { top: 44, left: 58, size: 54, dx: -10, dy: 8, dur: 32 },
  { top: 62, left: 18, size: 40, dx: 7, dy: -9, dur: 29 },
  { top: 18, left: 70, size: 50, dx: -6, dy: -7, dur: 35 },
];
/** How opaque a glow is at rest (the overlay's .lvd-aurora-glow), and where its gradient fades out. */
export const AURORA_GLOW_OPACITY = 0.72;
const AURORA_FADE_STOP = 0.7;

/** Ripple's origins (percent of the backdrop) and each one's period (seconds). */
export const RIPPLE_ORIGINS: readonly { top: number; left: number; dur: number }[] = [
  { top: 26, left: 20, dur: 9 },
  { top: 68, left: 40, dur: 11 },
  { top: 38, left: 72, dur: 10 },
  { top: 80, left: 82, dur: 12 },
];
export const RINGS_PER_ORIGIN = 3;
/** A resting ring's diameter (vmax, before the pattern-size slider). */
export const RIPPLE_RING_VMAX = 26;
/** The still's rings: the scales one origin's rings pass through as they expand, each fading as it grows (the
 *  overlay animates 0.25 -> 1.7 and 0.5 -> 0 opacity). One entry per ring. */
const RIPPLE_STILL_RINGS: readonly { scale: number; opacity: number }[] = [
  { scale: 0.45, opacity: 0.45 },
  { scale: 0.95, opacity: 0.3 },
  { scale: 1.45, opacity: 0.15 },
];
/** A still ring's line, in backdrop units (the overlay draws 2 px on a full canvas; a card is shrunk about 3x). */
const RIPPLE_STILL_STROKE = 3;

type Box = { x: number; y: number; w: number; h: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A still frame of an animated backdrop over `box`, as SVG markup in `color`, or null for a pattern with no still
 * here (the static patterns, Blank, and the animated ones no look uses: Flow, Drift, Ribbons). `idPrefix` scopes the
 * gradient ids, since several stills share one page. vmax becomes the box's long side.
 */
export function animatedPatternStill(
  pattern: BackgroundPattern,
  color: string,
  box: Box,
  idPrefix: string,
  scale = 1,
): string | null {
  const vmax = Math.max(box.w, box.h) / 100;
  if (pattern === 'aurora') {
    const id = `${idPrefix}-aurora`;
    const gradient =
      `<defs><radialGradient id="${id}">` +
      `<stop offset="0" stop-color="${color}"/>` +
      `<stop offset="${AURORA_FADE_STOP}" stop-color="${color}" stop-opacity="0"/>` +
      `</radialGradient></defs>`;
    const glows = AURORA_GLOWS.map((g) => {
      const radius = (g.size * scale * vmax) / 2;
      const cx = box.x + (g.left / 100) * box.w + radius;
      const cy = box.y + (g.top / 100) * box.h + radius;
      return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(radius)}" fill="url(#${id})"/>`;
    }).join('');
    return `${gradient}<g opacity="${AURORA_GLOW_OPACITY}">${glows}</g>`;
  }
  if (pattern === 'ripple') {
    const base = (RIPPLE_RING_VMAX * scale * vmax) / 2;
    const rings = RIPPLE_ORIGINS.flatMap((o) => {
      const cx = box.x + (o.left / 100) * box.w;
      const cy = box.y + (o.top / 100) * box.h;
      return RIPPLE_STILL_RINGS.map(
        (ring) =>
          `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(base * ring.scale)}" fill="none" ` +
          `stroke="${color}" stroke-width="${RIPPLE_STILL_STROKE}" stroke-opacity="${ring.opacity}"/>`,
      );
    }).join('');
    return `<g>${rings}</g>`;
  }
  return null;
}
