// What a dialog's hero art is and where its pieces may stand (liveworkspace/docs/specs/004-index/dialog-hero-header.md
// "Art"). An art file builds one HeroArt at module level, so the header's memoised band gets the same object on
// every render and paints once; every colour in it is a token (`var(--hero-wash)`), so it takes no props.
import type { CSSProperties, ReactNode } from 'react';

export type HeroArt = {
  /** The modal's name, kebab-case (`share`, `automations`): the band's `data-dialog-hero-art`. */
  name: string;
  /** The title mark's glyph: SVG content for a 20 x 20 box, drawn in `var(--hero-accent)`. */
  glyph: ReactNode;
  /** The texture: CSS backgrounds over the paper (heroTexture), or none. */
  texture?: CSSProperties;
  /** The corner pieces and, when `centre`, the centre piece: absolutely placed SVG (HERO_PLACE). */
  pieces: ReactNode;
  /** True when `pieces` holds a centre piece: the title's line then stops short of it where it shows. */
  centre?: boolean;
};

// The textures' measures, the Explorer hero's own (@liveworkspace/explorer/hero-theme), so a dialog reads as the
// same drawing as Home and the start screens. Kept here as numbers: ui cannot depend on the Explorer.
export const HERO_DOTS_PX = 22;
export const HERO_GRID_PX = 24;
export const HERO_BASELINE_PX = 8;
export const HERO_RING_PX = 14;

/** Where a radial texture spreads from: the corner its pieces stand in. */
export type HeroOrigin = 'bottom-right' | 'bottom-left' | 'top-right';

const ORIGIN: Record<HeroOrigin, string> = {
  'bottom-right': 'calc(100% - 3.5rem) 100%',
  'bottom-left': '3rem 100%',
  'top-right': 'calc(100% - 3rem) 0',
};

// Fading in from the title's side, so the words sit on plain paper.
const FADE = 'linear-gradient(90deg, var(--hero-paper) 0 34%, transparent 72%)';

/**
 * A texture over the band's paper. `dots` and `grid` can fade in from the title's side (`fade`); `rings` spread from a
 * corner and fade into the paper as they go; `baseline` is the Typesetter's 8px grid.
 */
export function heroTexture(
  kind: 'dots' | 'grid' | 'baseline' | 'rings',
  { fade = false, from = 'bottom-right' }: { fade?: boolean; from?: HeroOrigin } = {},
): CSSProperties {
  if (kind === 'rings') {
    const at = `circle at ${ORIGIN[from]}`;
    return {
      backgroundImage: [
        `radial-gradient(${at}, transparent 0 3rem, var(--hero-paper) 16rem)`,
        `repeating-radial-gradient(${at}, var(--hero-faint) 0 1px, transparent 1px ${HERO_RING_PX}px)`,
      ].join(', '),
    };
  }
  if (kind === 'baseline') {
    return {
      backgroundImage: `repeating-linear-gradient(transparent 0 ${HERO_BASELINE_PX - 1}px, var(--hero-faint) ${HERO_BASELINE_PX - 1}px ${HERO_BASELINE_PX}px)`,
      backgroundPosition: `0 ${HERO_BASELINE_PX / 2}px`,
    };
  }
  const layers =
    kind === 'dots'
      ? [`radial-gradient(var(--hero-line) 1px, transparent 1px)`]
      : [
          `linear-gradient(var(--hero-faint) 1px, transparent 1px)`,
          `linear-gradient(90deg, var(--hero-faint) 1px, transparent 1px)`,
        ];
  const size = kind === 'dots' ? HERO_DOTS_PX : HERO_GRID_PX;
  const sizes = layers.map(() => `${size}px ${size}px`);
  return {
    backgroundImage: (fade ? [FADE, ...layers] : layers).join(', '),
    backgroundSize: (fade ? ['100% 100%', ...sizes] : sizes).join(', '),
  };
}

/**
 * Where pieces stand. Corners rise from the band's bottom edge (at most 96 x 30) and show from `sm`: on a phone the
 * header is 56px and its mark, title and buttons fill the row, so any corner would sit under one of them, and the
 * band shows its texture alone. The centre piece shows only once the header is 56rem wide
 * (`@4xl`, a container query: dialogs differ in width), right-anchored at `--hero-centre-end` (12.5rem; set it on the
 * header for wider actions); its width plus that offset stay within 24rem so it never meets the title's line, which
 * is capped at 26rem there.
 */
export const HERO_PLACE = {
  // Hidden on a phone: the 56px row leaves no corner clear of the mark, the title or the buttons.
  bottomLeft: 'absolute bottom-0 left-2 max-sm:hidden',
  bottomRight: 'absolute bottom-0 right-3 max-sm:hidden',
  centre:
    'absolute right-[var(--hero-centre-end,12.5rem)] top-1/2 hidden -translate-y-1/2 @4xl:block',
} as const;

/**
 * The one motion a band may have: a ring spreading from its own centre twice, or a piece bobbing twice. The empty
 * states' keyframes (the shared theme), which reduced motion turns off. The count is important (`!`): the
 * `motion-safe:` shorthand sits in a media query later in the sheet, and its `infinite` would win otherwise.
 */
export const HERO_MOTION = {
  ring: 'motion-safe:animate-empty-ring [animation-iteration-count:2]! [transform-box:fill-box] [transform-origin:center]',
  float: 'motion-safe:animate-empty-float [animation-iteration-count:2]!',
} as const;

/** A drawn piece's common SVG props: decorative, never focusable. */
export const HERO_SVG = { 'aria-hidden': true, focusable: 'false' } as const;

export function heroCentreCap(art: HeroArt): string {
  return art.centre ? '@4xl:max-w-[26rem]' : '';
}
