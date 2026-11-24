// Ask an Admin's hero art (liveworkspace/docs/specs/019-subscription/subscription.md "Ask an Admin"): a member's note
// on its way to the team's admin. Faint dots fade in from the title's side; in the bottom right a note rises off the
// band's foot, its lines written, and a dashed arrow arches from it to the admin, whose star badge, in the accent,
// spreads its ring twice, motion allowing. The title mark is a speech bubble with an arrow up: asking for more.
// subscription-ui's one dialog serves every app, so it lives here (@liveworkspace/ui/dialog-hero-art/ask-admin).
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroStar,
  heroTexture,
  type HeroArt,
} from '../hero-art';

/** A speech bubble with an arrow up, in the accent. */
export const ASK_ADMIN_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4.5 3.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-3.5 3v-3h-1a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" />
    <path d="M10 12V6.5M7.75 8.5L10 6.25l2.25 2.25" />
  </g>
);

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    {/* The note, rising from the edge, a little turned as if just written. */}
    <g transform="rotate(-6 22 22)">
      <rect
        x="6"
        y="9"
        width="32"
        height="26"
        rx="4"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <rect x="11" y="15" width="20" height="2.5" rx="1.25" fill="var(--hero-mark)" />
      <rect x="11" y="20.5" width="15" height="2.5" rx="1.25" fill="var(--hero-line)" />
      <rect x="11" y="26" width="18" height="2.5" rx="1.25" fill="var(--hero-line)" />
    </g>
    {/* On its way: a dashed arc from the note to the admin. */}
    <path
      d="M42 13C50 4 58 3 64 9"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="3 2.5"
      strokeLinecap="round"
    />
    <path
      d="M61.5 5.5L64.5 9.5L60 10.5"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* The admin: head and shoulders rising from the edge, the star badge on their shoulder. */}
    <path d="M62 34a14 14 0 0 1 28 0z" fill="var(--hero-wash)" stroke="var(--hero-line)" />
    <circle cx="76" cy="14" r="6.5" fill="var(--hero-plate)" stroke="var(--hero-line)" />
    <circle
      cx="87"
      cy="21"
      r="5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="87" cy="21" r="5" fill="var(--hero-accent)" />
    <path d={heroStar(87, 21, 3.2)} fill="var(--hero-plate)" />
  </svg>
);

export const askAdminHeroArt: HeroArt = {
  name: 'ask-admin',
  glyph: ASK_ADMIN_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
