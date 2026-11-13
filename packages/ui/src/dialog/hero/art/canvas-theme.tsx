// The Tab Style dialog's hero art (each app's docs/specs/011-theme/canvas-and-theme-dialog.md): a tab's look, picked
// and fine-tuned. Faint rings spread from the bottom right like a colour wheel's, where a fan of swatch chips rises
// from the edge, the front one in the accent, lifting out of the fan twice. The
// title's side stays plain paper. The title mark is a palette.
// Every app's Tab Style draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/canvas-theme).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A painter's palette, its thumb hole and three dabs of paint, in the accent. */
export const CANVAS_THEME_GLYPH = (
  <g fill="var(--hero-accent)">
    <path
      d="M10 2.5a7.5 7.5 0 0 0 0 15c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h2a3.5 3.5 0 0 0 3.5-3.5C18 5.6 14.4 2.5 10 2.5Z"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <circle cx="6.2" cy="10" r="1.3" />
    <circle cx="8.2" cy="6.3" r="1.3" />
    <circle cx="12.3" cy="6.3" r="1.3" />
  </g>
);

// A swatch chip of the fan, turned `deg` about the fan's pivot below the edge, with a plate dot near its top.
function chip(deg: number, fill: string, className?: string) {
  return (
    <g transform={`rotate(${deg} 66 34)`}>
      <g className={className}>
        <rect
          x="58.5"
          y="5"
          width="15"
          height="34"
          rx="4"
          fill={fill}
          stroke="var(--hero-plate)"
          strokeWidth="1.5"
        />
        <circle cx="66" cy="11.5" r="2.25" fill="var(--hero-plate)" />
      </g>
    </g>
  );
}

const PIECES = (
  <>
    {/* A fan of swatch chips, the front one in the accent lifting out of it. */}
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      // The front chip lifts above the fan's box as it bobs; the band still clips at its own edge.
      overflow="visible"
      className={HERO_PLACE.bottomRight}
    >
      {chip(-58, 'var(--hero-wash)')}
      {chip(-29, 'var(--hero-line)')}
      {chip(29, 'var(--hero-mark)')}
      {chip(0, 'var(--hero-accent)', HERO_MOTION.float)}
    </svg>
  </>
);

export const canvasThemeHeroArt: HeroArt = {
  name: 'canvas-theme',
  glyph: CANVAS_THEME_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
