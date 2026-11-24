// The Use as Default for dialog's hero art (liveworkspace/docs/specs/004-index/one-explorer.md, Default Folders): one
// folder ticked as the default for the kinds of work chosen. Rings spread from the bottom right, where a list of kinds
// rises from the edge, its first box ticked in the accent (its ring spreading twice), a dashed line running from that
// tick to the folder standing beside it. The title mark is a folder with a tick in it.
// The Explorer's dialog, in every app, so it lives here (@liveworkspace/ui/dialog-hero-art/use-as-default).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';
import { HERO_FOLDER_OUTLINE, heroFolder } from './default-folders';

/** A folder with a tick in it, in the accent. */
export const USE_AS_DEFAULT_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={HERO_FOLDER_OUTLINE} />
    <path d="M7.3 11.3l1.9 1.9 3.5-3.7" strokeWidth="1.6" />
  </g>
);

// The kinds' rows: each a box and a name. The first is the one ticked.
const ROWS = [
  { y: 13, name: 18 },
  { y: 21, name: 13 },
  { y: 29, name: 16 },
];

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {heroFolder(65, 9, 27, 'var(--hero-wash)')}
    <path
      d="M16 31V11a5 5 0 0 1 5-5h30a5 5 0 0 1 5 5v20Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {ROWS.map(({ y, name }, i) => (
      <g key={y}>
        {i === 0 ? null : (
          <rect
            x="21"
            y={y - 3}
            width="6"
            height="6"
            rx="1.75"
            fill="none"
            stroke="var(--hero-mark)"
          />
        )}
        <rect
          x="31"
          y={y - 1.5}
          width={name}
          height="3"
          rx="1.5"
          fill="var(--hero-mark)"
          opacity={i === 0 ? 1 : 0.55}
        />
      </g>
    ))}
    {/* From the tick to the folder it makes the default. */}
    <path
      d="M56 13c5 0 5 7 10 7"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="2.5 2.5"
    />
    <circle cx="67" cy="20" r="2.25" fill="var(--hero-accent)" />
    {/* The ticked box. */}
    <rect
      x="21"
      y="10"
      width="6"
      height="6"
      rx="1.75"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <rect x="20.5" y="9.5" width="7" height="7" rx="2" fill="var(--hero-accent)" />
    <path
      d="M22.3 13.1l1.2 1.2 2.2-2.4"
      fill="none"
      stroke="var(--hero-plate)"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const useAsDefaultHeroArt: HeroArt = {
  name: 'use-as-default',
  glyph: USE_AS_DEFAULT_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
