// The Webhooks dialog's hero art (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): a webhook as a
// delivery, in the Automations flow's line-and-node language. A grid of dots fading toward the title, so the words sit
// on plain paper; in the bottom right a line arriving as an arrow at an endpoint, whose
// port's ring spreads twice as it is delivered. The title mark is a webhook: three nodes joined.
// The one dialog every Explorer and editor opens, so it lives here (@liveworkspace/ui/dialog-hero-art/webhooks).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A webhook: three nodes, each joined to the next by a curve that bends away from the middle. */
export const WEBHOOKS_GLYPH = (
  <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.7" strokeLinecap="round">
    <path d="M8.6 6.6C5.6 8.4 4.4 10.4 4.8 12.6" />
    <path d="M7.4 15.4c1.8 1.2 3.6 1.2 5.2 0" />
    <path d="M15.2 12.6c.4-2.2-.8-4.2-3.8-6" />
    <circle cx="10" cy="4.6" r="2.3" />
    <circle cx="4.9" cy="15" r="2.3" />
    <circle cx="15.1" cy="15" r="2.3" />
  </g>
);

// The foot's line runs 9px above the band's edge: the corners' lines meet it there (y 21 of a 30 high piece).
const FOOT_Y = 21;

const PIECES = (
  <>
    {/* The arrival: the arrow, and the endpoint whose port takes it. */}
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      overflow="visible"
      className={HERO_PLACE.bottomRight}
    >
      <path
        d={`M0 ${FOOT_Y}H40`}
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeDasharray="3 4"
      />
      <path d={`M39 ${FOOT_Y - 3.5}l5 3.5-5 3.5`} fill="var(--hero-mark)" />
      <rect
        x="52"
        y="3"
        width="40"
        height="33"
        rx="6"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <rect x="61" y="9" width="22" height="3" rx="1.5" fill="var(--hero-mark)" />
      <rect x="61" y="15" width="15" height="2.5" rx="1.25" fill="var(--hero-line)" />
      <circle cx="84" cy={FOOT_Y} r="1.5" fill="var(--hero-line)" />
      {/* The port, ringed in the accent: its ring spreads as the payload lands. */}
      <circle
        cx="52"
        cy={FOOT_Y}
        r="4.5"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.25"
        className={HERO_MOTION.ring}
      />
      <circle
        cx="52"
        cy={FOOT_Y}
        r="4.5"
        fill="var(--hero-paper)"
        stroke="var(--hero-accent)"
        strokeWidth="1.5"
      />
      <circle cx="52" cy={FOOT_Y} r="1.75" fill="var(--hero-accent)" />
    </svg>
  </>
);

export const webhooksHeroArt: HeroArt = {
  name: 'webhooks',
  glyph: WEBHOOKS_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
