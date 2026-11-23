// The Assign an Action dialog's hero art (each app's docs/specs/012-collaboration/assigned-actions.md): a piece of
// work attached to an element and handed to someone. A grid of dots fades in from the title's side; in the bottom
// right a task card rises from the edge (a tick box over two lines), a dashed arrow hands it across to the person it
// is assigned to, drawn in the accent, their ring spreading twice. The title's side stays plain paper. The title
// mark is a ticked box.
// Every app's Assign an Action draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/assign-action).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A task's box, ticked, in the accent. */
export const ASSIGN_ACTION_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="14" height="14" rx="3.5" />
    <path d="m6.6 10.2 2.4 2.4 4.5-5" />
  </g>
);

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    // The assignee's ring spreads past the box; the band still clips at its own edge.
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {/* The task card, running off the band's foot. */}
    <rect
      x="1"
      y="5"
      width="48"
      height="32"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect
      x="7.75"
      y="11.75"
      width="8.5"
      height="8.5"
      rx="2.25"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
    />
    <path
      d="m10 16.1 1.5 1.5 2.6-3"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="21" y="12" width="21" height="3.5" rx="1.75" fill="var(--hero-mark)" />
    <rect
      x="21"
      y="18.5"
      width="14"
      height="3.5"
      rx="1.75"
      fill="var(--hero-mark)"
      opacity="0.45"
    />
    <rect x="8" y="26" width="27" height="3.5" rx="1.75" fill="var(--hero-mark)" opacity="0.3" />
    {/* Handed across. */}
    <path
      d="M52 17h11.5"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="2.5 3"
    />
    <path
      d="m62 13.5 3.5 3.5-3.5 3.5"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* The person it is assigned to. */}
    <circle
      cx="80"
      cy="17"
      r="11.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      className={HERO_MOTION.ring}
    />
    <circle cx="80" cy="17" r="9" fill="var(--hero-accent)" />
    <circle cx="80" cy="14" r="3" fill="var(--hero-plate)" />
    <path d="M74.2 22.6a5.8 5.8 0 0 1 11.6 0 9 9 0 0 1-11.6 0Z" fill="var(--hero-plate)" />
  </svg>
);

export const assignActionHeroArt: HeroArt = {
  name: 'assign-action',
  glyph: ASSIGN_ACTION_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
