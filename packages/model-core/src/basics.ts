// The model's plain vocabulary, the same in every product: ids, text size, padding, alignment, icon
// position, arrow flows and background patterns. Each product's model package re-exports these from its
// index, beside its own element union, which stays per product.

export type TabId = string;
export type ElementId = string;

// --- Shared boxed-element fields ------------------------------------------

// A label's size (docs/specs/004-interface-design/fonts.md "Text size"): one of the named
// presets ('scale' fits a note's text to its box), or an exact whole px from the Size slider,
// TEXT_PX_MIN to TEXT_PX_MAX (label-font.ts).
export type TextSizePreset = 'scale' | 'sm' | 'md' | 'lg';
export type TextSize = TextSizePreset | number;

// Padding between the element's box and its label. Stored as a t-shirt
// size for round-trip simplicity; the renderer converts to px.
export type Padding = 'none' | 'sm' | 'md' | 'lg';

export const PADDING_PX: Record<Padding, number> = {
  none: 0,
  sm: 6,
  md: 14,
  lg: 24,
};

export type TextAlignX = 'left' | 'center' | 'right';
export type TextAlignY = 'top' | 'middle' | 'bottom';

// Where an inline icon sits relative to its shape's text label (the
// drag-an-icon-onto-a-shape feature, docs/specs/008-canvas/canvas-and-palette.md). The drop-side detection, the
// context-menu placement picker, and the data-model field all speak this.
export type IconPosition = 'left' | 'right' | 'above' | 'below';

// The animation vocabulary (element / icon / progress animations, their
// speed, and the animLoops rule) lives in './animation' — a LEAF module,
// re-exported below, so the public surface is unchanged.

// The self-drawing data-shape family (progress / rail / rating / charts:
// kind predicates, bounds, default data, anim sets, clamps) lives in
// './data-shapes' — a LEAF module so factories.ts can read the defaults
// at module-init time without a runtime cycle through this barrel. It is
// re-exported below, so the public surface is unchanged.

// Flowing-arrow animation (docs/specs/008-canvas/canvas-and-palette.md): 'dashes' marches the dash pattern along
// the connector (CSS stroke-dashoffset), 'dots' sends a dot travelling the
// path (CSS offset-path), 'beads' marches a row of round dots, 'pulse' breathes
// the line's opacity, 'grow' breathes its thickness, 'glow' pulses a soft halo
// around it, 'draw' repeatedly draws the line on from start to end (a
// pathLength-normalised stroke-dashoffset reveal), 'comet' sends a glowing dot
// with a fading tail along the path (a staggered fleet of offset-path dots),
// 'rainbow' cycles the stroke colour through the spectrum, 'strobe' blinks the
// line hard on/off (stepped stroke-opacity), 'wind' marches fast sparse long
// dashes like speed lines. The emphasis set draws the eye without busy
// motion: 'heartbeat' is a lub-dub thickness double-pump (vs grow's smooth
// breathe), 'breathe' a slow gentle width + opacity swell, 'shimmer' an
// occasional quick glint of brightness + halo, 'signal' a single discrete
// packet (one long dash) travelling the path (vs wind's stream of speed
// lines). All show / emphasise the direction of data / process flow.
export type ArrowFlow =
  | 'dashes'
  | 'dots'
  | 'beads'
  | 'pulse'
  | 'grow'
  | 'glow'
  | 'heartbeat'
  | 'breathe'
  | 'shimmer'
  | 'signal'
  | 'draw'
  | 'comet'
  | 'rainbow'
  | 'strobe'
  | 'wind';
export const ARROW_FLOWS: readonly ArrowFlow[] = [
  'dashes',
  'dots',
  'beads',
  'pulse',
  'grow',
  'glow',
  'heartbeat',
  'breathe',
  'shimmer',
  'signal',
  'draw',
  'comet',
  'rainbow',
  'strobe',
  'wind',
];

export type BackgroundPattern =
  | 'grid'
  | 'blank'
  | 'lines'
  | 'crosshatch'
  | 'graph'
  | 'confetti'
  | 'stripes'
  | 'diagonal'
  | 'waves'
  | 'bricks'
  | 'isometric'
  | 'hexagonal'
  | 'engineering'
  | 'checkerboard'
  // Seasonal patterns (docs/specs/011-theme/canvas-and-theme-dialog.md "Seasonal looks"): static motif tiles worn
  // by the seasonal looks only, never listed in a pattern picker.
  | 'sparkles'
  | 'eggs'
  | 'cobwebs'
  | 'snowflakes'
  | 'candy-stripes'
  // Animated patterns (docs/specs/008-canvas/canvas-and-palette.md): soft ambient motion rendered as an
  // overlay layer rather than a CSS background image. They theme off the
  // pattern colour like the static ones. Kept last so the static catalogue
  // ordering is undisturbed.
  | 'flow'
  | 'drift'
  | 'aurora'
  | 'ripple'
  | 'ribbons';

// The animated members of BackgroundPattern. These render via the
// AnimatedCanvasBackground overlay (CSS / SVG motion) instead of a static
// `background-image`, so callers that paint or export a still frame can
// branch on this. Order mirrors the picker.
export const ANIMATED_BACKGROUND_PATTERNS = [
  'flow',
  'drift',
  'aurora',
  'ripple',
  'ribbons',
] as const;

export type AnimatedBackgroundPattern = (typeof ANIMATED_BACKGROUND_PATTERNS)[number];

// The seasonal members of BackgroundPattern: static tiles the seasonal looks wear, kept out of the pattern pickers.
export const SEASONAL_BACKGROUND_PATTERNS = [
  'sparkles',
  'eggs',
  'cobwebs',
  'snowflakes',
  'candy-stripes',
] as const satisfies readonly BackgroundPattern[];

export type SeasonalBackgroundPattern = (typeof SEASONAL_BACKGROUND_PATTERNS)[number];

export function isSeasonalPattern(pattern: BackgroundPattern): boolean {
  return (SEASONAL_BACKGROUND_PATTERNS as readonly string[]).includes(pattern);
}

// Every BackgroundPattern, so a pattern read from stored or sent data can be checked (the Record keeps it whole).
const BACKGROUND_PATTERN_SET: Readonly<Record<BackgroundPattern, true>> = {
  grid: true,
  blank: true,
  lines: true,
  crosshatch: true,
  graph: true,
  confetti: true,
  stripes: true,
  diagonal: true,
  waves: true,
  bricks: true,
  isometric: true,
  hexagonal: true,
  engineering: true,
  checkerboard: true,
  sparkles: true,
  eggs: true,
  cobwebs: true,
  snowflakes: true,
  'candy-stripes': true,
  flow: true,
  drift: true,
  aurora: true,
  ripple: true,
  ribbons: true,
};

export function isBackgroundPattern(value: unknown): value is BackgroundPattern {
  return typeof value === 'string' && Object.hasOwn(BACKGROUND_PATTERN_SET, value);
}

export function isAnimatedPattern(
  pattern: BackgroundPattern,
): pattern is AnimatedBackgroundPattern {
  return (ANIMATED_BACKGROUND_PATTERNS as readonly string[]).includes(pattern);
}
