// A colour background (docs/specs/030-forms/forms.md "The form card, top to bottom", Cover): a solid colour or a
// two-stop gradient (a moving one included), and a pattern over it, as a form's cover (@liveplanner/forms) reads and
// paints it. Pure, no dependencies.

// An animated background: a gradient with a motion drawn over it, moving on screen, still in exports (which draw
// its first frame) and under reduced motion. The first five are the animated canvas styles'; the rest are its own.
export const PAGE_MOTIONS = [
  'flow',
  'drift',
  'aurora',
  'ripple',
  'ribbons',
  'mesh',
  'starfield',
  'retro-grid',
  'bokeh',
  'waves',
  'spotlight',
  'beams',
  'sunburst',
  'fireflies',
  'snowfall',
  'lava',
  'dot-wave',
  'clouds',
  'warp',
  'orbits',
  'radar',
  'equaliser',
  'confetti',
  'threads',
] as const;
// A motion's speed: a rate on its own pace, as the canvas's animated styles take one.
export const PAGE_MOTION_SPEED_MIN = 0.25;
export const PAGE_MOTION_SPEED_MAX = 3;
export type PageMotion = (typeof PAGE_MOTIONS)[number];
export function isPageMotion(v: unknown): v is PageMotion {
  return typeof v === 'string' && (PAGE_MOTIONS as readonly string[]).includes(v);
}
export type PagePattern = 'dots' | 'grid' | 'lines';
export const PAGE_PATTERNS: readonly PagePattern[] = ['dots', 'grid', 'lines'];

// A fill in colour: one colour, or a gradient between two at an angle (CSS degrees), perhaps moving.
export type PageColourFill =
  | { kind: 'solid'; color: string }
  | {
      kind: 'gradient';
      from: string;
      to: string;
      angle: number;
      motion?: PageMotion;
      // How fast the motion runs: 1 is its own pace. Absent is 1.
      speed?: number;
    };

// A background in colour alone: a form's cover (a page's PageBackground adds pictures).
export type ColourBackground = { fill?: PageColourFill; pattern?: PagePattern };

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

/** A stored colour fill, or undefined when it is not one (a picture is the caller's to read). */
export function parseColourFill(v: unknown): PageColourFill | undefined {
  const f = v as Record<string, unknown> | null;
  if (!f || typeof f !== 'object') return undefined;
  if (f.kind === 'solid' && isHex(f.color)) return { kind: 'solid', color: f.color };
  if (f.kind === 'gradient' && isHex(f.from) && isHex(f.to)) {
    const raw = typeof f.angle === 'number' && Number.isFinite(f.angle) ? f.angle : 180;
    return {
      kind: 'gradient',
      from: f.from,
      to: f.to,
      angle: ((Math.round(raw) % 360) + 360) % 360,
      ...(isPageMotion(f.motion) ? { motion: f.motion } : {}),
      ...(isPageMotion(f.motion) &&
      typeof f.speed === 'number' &&
      f.speed >= PAGE_MOTION_SPEED_MIN &&
      f.speed <= PAGE_MOTION_SPEED_MAX &&
      f.speed !== 1
        ? { speed: f.speed }
        : {}),
    };
  }
  return undefined;
}

/** A stored pattern, or undefined. */
export function parsePagePattern(v: unknown): PagePattern | undefined {
  return PAGE_PATTERNS.includes(v as PagePattern) ? (v as PagePattern) : undefined;
}

/** A stored colour background (a form's cover), keeping what is valid; undefined when nothing is. */
export function parseColourBackground(v: unknown): ColourBackground | undefined {
  const b = v as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return undefined;
  const fill = parseColourFill(b.fill);
  const pattern = parsePagePattern(b.pattern);
  if (!fill && !pattern) return undefined;
  return { ...(fill ? { fill } : {}), ...(pattern ? { pattern } : {}) };
}
