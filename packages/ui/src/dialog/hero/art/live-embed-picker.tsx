// The Choose a File dialog's hero art (liveworkspace/docs/specs/004-index/live-embeds.md "Making one"): another file
// shown here, live. A faint grid of dots fades in from the title's side; in the bottom right a frame rises from the
// edge with a small canvas in it (two boxes joined), a second file waiting behind it, and on the frame's corner the
// accent's live dot, its ring spreading twice. The title mark is a frame holding a smaller, solid one.
// One picker for every app that embeds, so it lives here (@liveworkspace/ui/dialog-hero-art/live-embed-picker).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A frame holding a smaller, solid one: a file shown inside another, in the accent. */
export const LIVE_EMBED_PICKER_GLYPH = (
  <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinejoin="round">
    <rect x="2.5" y="4" width="15" height="12" rx="2.5" />
    <rect x="9" y="9" width="6" height="4.5" rx="1.2" fill="var(--hero-accent)" stroke="none" />
  </g>
);

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {/* Another file, waiting behind. */}
    <g transform="rotate(-7 30 24)">
      <rect
        x="16"
        y="13"
        width="30"
        height="24"
        rx="4"
        fill="var(--hero-wash)"
        stroke="var(--hero-line)"
      />
      <rect x="21" y="18" width="12" height="2.5" rx="1.25" fill="var(--hero-line)" />
    </g>
    {/* The frame, and the canvas it shows. */}
    <path
      d="M38 31V12a5 5 0 0 1 5-5h42a5 5 0 0 1 5 5v19Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M38 14h52" stroke="var(--hero-line)" />
    <rect x="43" y="9.25" width="11" height="2.5" rx="1.25" fill="var(--hero-line)" />
    <path d="M57 21.5c5 0 7 3.5 12 3.5" fill="none" stroke="var(--hero-mark)" strokeWidth="1.25" />
    <rect
      x="44"
      y="17.5"
      width="13"
      height="8"
      rx="2"
      fill="var(--hero-soft)"
      stroke="var(--hero-mark)"
    />
    <rect
      x="69"
      y="21"
      width="14"
      height="8"
      rx="2"
      fill="var(--hero-soft)"
      stroke="var(--hero-mark)"
    />
    {/* Live. */}
    <circle
      cx="88.5"
      cy="8.5"
      r="4.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle
      cx="88.5"
      cy="8.5"
      r="4.5"
      fill="var(--hero-accent)"
      stroke="var(--hero-plate)"
      strokeWidth="1.5"
    />
  </svg>
);

export const liveEmbedPickerHeroArt: HeroArt = {
  name: 'live-embed-picker',
  glyph: LIVE_EMBED_PICKER_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
