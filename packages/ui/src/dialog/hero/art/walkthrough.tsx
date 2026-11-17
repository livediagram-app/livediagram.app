// A walkthrough's hero art (liveworkspace/docs/specs/006-media/walkthroughs.md "Screen recordings"): a video of the
// canvas, talked through. Dots fade in from the title's side; in the bottom right a screen rises from the edge with a
// small canvas on it (two boxes joined, a dashed pointer path), the presenter's round bubble at its corner, and in front
// the accent's play badge, its ring spreading twice, motion allowing. The title mark is a play button in a screen.
// Shared, since the editor's Tools and the Explorer's library both play one
// (@liveworkspace/ui/dialog-hero-art/walkthrough).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A screen with a play button in it, in the accent. */
export const WALKTHROUGH_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2.5" y="4" width="15" height="10.5" rx="2" />
    <path d="M7 17h6M8.75 7.5v4l3.25-2-3.25-2Z" />
  </g>
);

const PIECES = (
  <svg
    {...HERO_SVG}
    // Low enough to sit under the header's buttons (Share, Full Screen, Close), as History's timeline does.
    width="63"
    height="36"
    viewBox="0 0 112 64"
    className={HERO_PLACE.bottomRight}
  >
    {/* The screen, rising from the edge. */}
    <rect
      x="8"
      y="10"
      width="78"
      height="60"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
      strokeWidth="1.25"
    />
    <path d="M8 18H86" stroke="var(--hero-faint)" strokeWidth="1.25" />
    {/* A small canvas on it: two boxes joined, and the pointer's dashed path between them. */}
    <rect x="16" y="26" width="18" height="11" rx="2" fill="var(--hero-wash)" />
    <rect x="52" y="42" width="22" height="12" rx="2" fill="var(--hero-wash)" />
    <path d="M34 31.5h9v16h9" fill="none" stroke="var(--hero-line)" strokeWidth="1.25" />
    <path
      d="M24 46C30 54 42 56 48 50"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="3 3"
      strokeLinecap="round"
    />
    <path
      d="M48.5 47.5l3.5 5.5 1-3 3-1-7.5-1.5Z"
      fill="var(--hero-mark)"
      stroke="var(--hero-mark)"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    {/* The presenter's bubble at the screen's corner. */}
    <circle
      cx="16"
      cy="56"
      r="7"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
      strokeWidth="1.25"
    />
    <circle cx="16" cy="54" r="2.25" fill="var(--hero-mark)" />
    <path d="M12 60.5a4.5 4.5 0 0 1 8 0" fill="none" stroke="var(--hero-mark)" strokeWidth="1.25" />
    {/* In front: the play badge, in the accent, its ring spreading twice. */}
    <circle
      cx="94"
      cy="28"
      r="10"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="94" cy="28" r="10" fill="var(--hero-accent)" />
    <path d="M91.25 23.5v9l7-4.5-7-4.5Z" fill="var(--hero-plate)" />
  </svg>
);

export const walkthroughHeroArt: HeroArt = {
  name: 'walkthrough',
  glyph: WALKTHROUGH_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
