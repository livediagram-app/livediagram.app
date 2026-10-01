// Colour normalisation (docs/specs/020-import-export/whiteboard-import.md "Colours"): Whiteboard
// colours are absolute, a scene's are light-reference. On a dark board the author's near-white ink
// is the board's ink, and a stroke in the board's own colour was never visible.
import { hexOklch } from '@livediagram/document';
import type { SceneAppearance, SceneColour } from '@/lib/board-scene/scene';

// Real backgrounds: #1f1f1f is L 0.24, #e1e1e1 0.91, white 1.
export const DARK_BACKGROUND_MAX_LIGHTNESS = 0.5;
// Whiteboard's dark-board ink #ebebeb is L 0.94.
export const INK_MIN_LIGHTNESS_ON_DARK = 0.8;
// Near-neutral, as the landing's ink rule.
export const INK_MAX_CHROMA = 0.04;
// OKLab distance below which a line disappears into its board (#000000 on #1f1f1f is 0.24 apart
// in lightness, yet Whiteboard draws black as #1f1f1f, so black counts as the board colour).
export const INVISIBLE_DISTANCE = 0.03;

/** Whiteboard draws pure black as this on every board. */
export const WHITEBOARD_BLACK = '#1f1f1f';

export function appearanceOf(background?: SceneColour): SceneAppearance {
  const lch = background ? hexOklch(background.hex) : null;
  return lch && lch.l < DARK_BACKGROUND_MAX_LIGHTNESS ? 'dark' : 'light';
}

function oklab(hex: string): [number, number, number] | null {
  const lch = hexOklch(hex);
  if (!lch) return null;
  const rad = (lch.h * Math.PI) / 180;
  return [lch.l, lch.c * Math.cos(rad), lch.c * Math.sin(rad)];
}

/** The colour as Whiteboard draws it (pure black drawn as its ink black). */
const drawn = (hex: string) => (hex.toLowerCase() === '#000000' ? WHITEBOARD_BLACK : hex);

/** True when a line in `colour` cannot be seen on `background`. */
export function isInvisibleOn(colour: SceneColour, background: SceneColour): boolean {
  const a = oklab(drawn(colour.hex));
  const b = oklab(background.hex);
  if (!a || !b) return false;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < INVISIBLE_DISTANCE;
}

export type LineColour = SceneColour | 'ink' | 'skip';

/** A line's colour, light-reference: 'ink' for the dark board's own ink, 'skip' when invisible. */
export function lineColour(
  colour: SceneColour,
  appearance: SceneAppearance,
  background?: SceneColour,
): LineColour {
  if (appearance !== 'dark') return colour;
  if (background && isInvisibleOn(colour, background)) return 'skip';
  const lch = hexOklch(colour.hex);
  if (lch && lch.l >= INK_MIN_LIGHTNESS_ON_DARK && lch.c <= INK_MAX_CHROMA) return 'ink';
  return colour;
}
