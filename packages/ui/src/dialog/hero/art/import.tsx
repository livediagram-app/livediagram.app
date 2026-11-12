// The Import dialog's hero art (each product's docs/specs/020-import-export/README.md "The dialogs' header"): files
// coming in. A faint grid of dots fades in from the title's side; in the bottom left the files it comes from, two
// cards fanned and rising from the band's edge; a dashed line runs along the foot from them to the bottom right,
// where a dashed frame waits, the place they land, an accent badge with an arrow down at its side and a file
// dropping in over its edge, bobbing twice, motion allowing. The title mark is an arrow into a tray.
// Every product's Import, and the import dialogs that open from it, use it, so it lives here
// (@liveworkspace/ui/dialog-hero-art/import).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** An arrow dropping into a tray, in the accent. */
export const IMPORT_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3.5 12.5V15a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2.5" />
    <path d="M10 3v9.5M6.5 9l3.5 3.5L13.5 9" />
  </g>
);

// A file card with its corner folded, top left at (x, y), 18 wide, standing tall enough to run off the band's foot.
function file(x: number, y: number, fill: string) {
  return (
    <>
      <path
        d={`M${x + 3} ${y}h10l5 5v30H${x}V${y + 3}a3 3 0 0 1 3-3Z`}
        fill={fill}
        stroke="var(--hero-line)"
      />
      <path
        d={`M${x + 13} ${y}v3a2 2 0 0 0 2 2h3`}
        fill="var(--hero-soft)"
        stroke="var(--hero-line)"
        strokeLinejoin="round"
      />
      <rect x={x + 4} y={y + 10} width="10" height="2.5" rx="1.25" fill="var(--hero-line)" />
      <rect x={x + 4} y={y + 15} width="7" height="2.5" rx="1.25" fill="var(--hero-line)" />
    </>
  );
}

const PIECES = (
  <>
    {/* Where they come from: two files fanned, rising from the edge. */}
    <svg {...HERO_SVG} width="44" height="30" viewBox="0 0 44 30" className={HERO_PLACE.bottomLeft}>
      <g transform="rotate(-10 15 30)">{file(6, 7, 'var(--hero-soft)')}</g>
      <g transform="rotate(6 27 30)">{file(18, 5, 'var(--hero-plate)')}</g>
    </svg>
    {/* Their way in: a dashed line along the foot, from the files to the frame. */}
    <span className="absolute bottom-[11px] left-[3.25rem] right-[5.6rem] h-[1.5px] bg-[linear-gradient(90deg,var(--hero-mark)_0_3px,transparent_3px_7px)] bg-[length:7px_1.5px] [mask-image:linear-gradient(90deg,transparent,black_24%)] opacity-70 max-sm:hidden" />
    {/* The drop: a dashed frame rising from the edge, its badge, and a file dropping in over its edge. */}
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      className={`${HERO_PLACE.bottomRight} overflow-visible`}
    >
      <rect
        x="20"
        y="9"
        width="72"
        height="30"
        rx="8"
        fill="var(--hero-soft)"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeDasharray="4 3.5"
      />
      <circle cx="36" cy="20.5" r="6.5" fill="var(--hero-accent)" />
      <path
        d="M36 17v6.5M33.25 21L36 23.75 38.75 21"
        fill="none"
        stroke="var(--hero-plate)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g className={HERO_MOTION.float}>
        <g transform="rotate(7 65 20)">{file(56, 7, 'var(--hero-plate)')}</g>
      </g>
    </svg>
  </>
);

export const importHeroArt: HeroArt = {
  name: 'import',
  glyph: IMPORT_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
