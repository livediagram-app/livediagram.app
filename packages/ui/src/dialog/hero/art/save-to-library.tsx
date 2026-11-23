// The Save to Library dialog's hero art (liveworkspace/docs/specs/006-media/libraries.md): a copy of what is selected,
// kept on the shelf to be placed anywhere. A faint grid fades in from the title's side; in the bottom right a shelf of
// spines rises from the edge, a dashed gap left among them, and the element being kept, in the accent, dropping into
// that gap, bobbing twice. The title mark is three spines, the last one leaning.
// One dialog for every editor, so it lives here (@liveworkspace/ui/dialog-hero-art/save-to-library).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** Three spines on a shelf, the last one leaning, in the accent. */
export const SAVE_TO_LIBRARY_GLYPH = (
  <path
    d="M4.5 4v12M8.75 4v12M12.4 5.4l3.4 10.4"
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="2"
    strokeLinecap="round"
  />
);

// The spines either side of the gap: where each stands, how wide, how tall it rises, and its shade.
const SPINES = [
  { x: 24, y: 11, w: 8, fill: 'var(--hero-wash)' },
  { x: 33.5, y: 6, w: 7, fill: 'var(--hero-line)' },
  { x: 42, y: 13, w: 10, fill: 'var(--hero-plate)' },
  { x: 73, y: 8, w: 8, fill: 'var(--hero-wash)' },
  { x: 82.5, y: 14, w: 9.5, fill: 'var(--hero-line)' },
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
    {SPINES.map(({ x, y, w, fill }) => (
      <g key={x}>
        <rect x={x} y={y} width={w} height="26" rx="2" fill={fill} stroke="var(--hero-line)" />
        <rect
          x={x + 2}
          y={y + 4}
          width={w - 4}
          height="1.75"
          rx="0.875"
          fill="var(--hero-mark)"
          opacity="0.6"
        />
      </g>
    ))}
    {/* The gap kept for it. */}
    <rect
      x="55.5"
      y="15"
      width="14"
      height="22"
      rx="2.5"
      fill="var(--hero-soft)"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="3 3"
    />
    {/* The element being kept. */}
    <g className={HERO_MOTION.float}>
      <rect x="57" y="3" width="11" height="11" rx="3.25" fill="var(--hero-accent)" />
      <circle cx="62.5" cy="8.5" r="2.25" fill="var(--hero-plate)" />
    </g>
  </svg>
);

export const saveToLibraryHeroArt: HeroArt = {
  name: 'save-to-library',
  glyph: SAVE_TO_LIBRARY_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
