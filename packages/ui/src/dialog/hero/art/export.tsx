// The Export dialog's hero art (each product's docs/specs/020-import-export/README.md "The dialogs' header"): the tab
// leaving as files. A faint grid fades in from the title's side, the canvas the tab is drawn on; in the bottom right
// the tab goes out fanned into format tiles: a picture (PNG), a vector path (SVG), and in front, in the accent,
// the file going out, which bobs twice, motion allowing. The title mark is an arrow leaving a tray.
// Every product's Export uses it, so it lives here (@liveworkspace/ui/dialog-hero-art/export).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** An arrow rising out of a tray, in the accent. */
export const EXPORT_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3.5 12.5V15a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2.5" />
    <path d="M10 12.5V3M6.5 6.5L10 3l3.5 3.5" />
  </g>
);

const PIECES = (
  <>
    {/* The formats, fanned out where the line arrives: a picture and a vector path behind, the file going out in front. */}
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      className={`${HERO_PLACE.bottomRight} overflow-visible`}
    >
      <path
        d="M2 15.5l4 3.25-4 3.25"
        fill="none"
        stroke="var(--hero-mark)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="rotate(-13 44 42)">
        <rect
          x="32"
          y="6"
          width="24"
          height="30"
          rx="4"
          fill="var(--hero-plate)"
          stroke="var(--hero-line)"
        />
        <circle cx="39" cy="12.5" r="2.25" fill="var(--hero-line)" />
        <path d="M35 25l6-7 4 4 3-3 5 6Z" fill="var(--hero-wash)" />
      </g>
      <g transform="rotate(13 80 42)">
        <rect
          x="68"
          y="6"
          width="24"
          height="30"
          rx="4"
          fill="var(--hero-plate)"
          stroke="var(--hero-line)"
        />
        <path
          d="M73.5 22c2-8 10-9.5 13-3"
          fill="none"
          stroke="var(--hero-mark)"
          strokeWidth="1.25"
        />
        <path d="M73.5 22l2-7.5" stroke="var(--hero-line)" />
        <rect
          x="72"
          y="20.5"
          width="3"
          height="3"
          fill="var(--hero-plate)"
          stroke="var(--hero-mark)"
        />
        <rect
          x="85"
          y="17.5"
          width="3"
          height="3"
          fill="var(--hero-plate)"
          stroke="var(--hero-mark)"
        />
        <circle cx="75.5" cy="14.5" r="1.25" fill="var(--hero-mark)" />
      </g>
      <g className={HERO_MOTION.float}>
        <rect x="50" y="8" width="24" height="28" rx="4" fill="var(--hero-accent)" />
        <path
          d="M57.5 21l9-9M60.5 12h6v6"
          fill="none"
          stroke="var(--hero-plate)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="56" y="25.5" width="12" height="2.5" rx="1.25" fill="var(--hero-plate)" />
      </g>
    </svg>
  </>
);

export const exportHeroArt: HeroArt = {
  name: 'export',
  glyph: EXPORT_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
