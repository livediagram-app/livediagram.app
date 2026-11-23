// The Bring Focus invitation's hero art (FocusInviteDialog: somebody wants you to look at something, and saying yes
// moves your view to where they point). Faint rings spread from the bottom right, where a view's top corners frame
// the spot: a dashed path sweeps in from the left to somebody's pointer, in the accent with its name tag, and a
// ring spreads twice from the pointer's tip, motion allowing. The title mark is a target.
// livediagram's and livehuddle's dialogs draw it, so it lives here (@liveworkspace/ui/dialog-hero-art/focus-invite).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

const PIECES = (
  <svg {...HERO_SVG} width="96" height="30" viewBox="0 0 96 30" className={HERO_PLACE.bottomRight}>
    {/* The view that will land here: its top corners. */}
    <path
      d="M38 12V7.5a4 4 0 0 1 4-4h5.5M79.5 3.5H85a4 4 0 0 1 4 4V12"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* The way your view travels. */}
    <path
      d="M3 27C14 12 34 10 52 14"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="0.5 4.5"
    />
    {/* Where they point. */}
    <circle cx="62" cy="15" r="10.5" fill="var(--hero-plate)" stroke="var(--hero-line)" />
    <circle
      cx="62"
      cy="15"
      r="6"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      className={HERO_MOTION.ring}
    />
    <path
      d="M62 15l3.4 11.2 2.4-4.4 4.8-1.3Z"
      fill="var(--hero-accent)"
      stroke="var(--hero-plate)"
      strokeLinejoin="round"
    />
    <rect x="71" y="24.5" width="20" height="8" rx="4" fill="var(--hero-accent)" />
    <rect x="75" y="27" width="12" height="2.5" rx="1.25" fill="var(--hero-plate)" opacity="0.85" />
  </svg>
);

export const focusInviteHeroArt: HeroArt = {
  name: 'focus-invite',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="10" cy="10" r="5.25" />
      <path d="M10 2.25v2.5M10 15.25v2.5M2.25 10h2.5M15.25 10h2.5" />
      <circle cx="10" cy="10" r="1.6" fill="var(--hero-accent)" stroke="none" />
    </g>
  ),
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
