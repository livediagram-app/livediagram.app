// The Webhooks dialog's hero art (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): a webhook as a
// delivery, in the Automations flow's line-and-node language. A grid of dots fading toward the title, so the words sit
// on plain paper; in the bottom left the item as a card, a line leaving its node with a payload (braces on the accent)
// riding it; a dashed send line along the foot; in the bottom right the line arriving as an arrow at an endpoint, whose
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
    {/* The item, its node, and the payload leaving it. */}
    <svg {...HERO_SVG} width="96" height="30" viewBox="0 0 96 30" className={HERO_PLACE.bottomLeft}>
      <rect
        x="4"
        y="3"
        width="30"
        height="32"
        rx="5"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <rect x="9" y="8" width="14" height="3" rx="1.5" fill="var(--hero-mark)" />
      <rect x="9" y="14" width="18" height="2.5" rx="1.25" fill="var(--hero-line)" />
      <path d={`M37 ${FOOT_Y}H96`} stroke="var(--hero-line)" strokeWidth="1.5" />
      <circle
        cx="34"
        cy={FOOT_Y}
        r="3"
        fill="var(--hero-paper)"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
      />
      {/* The payload: braces on the accent, riding the line. */}
      <rect x="56" y="14" width="22" height="14" rx="4" fill="var(--hero-accent)" />
      <path
        d="M64.2 17.2c-1.3 0-1.7.6-1.7 1.5v.9c0 .7-.4 1.4-1.3 1.4.9 0 1.3.7 1.3 1.4v.9c0 .9.4 1.5 1.7 1.5M69.8 17.2c1.3 0 1.7.6 1.7 1.5v.9c0 .7.4 1.4 1.3 1.4-.9 0-1.3.7-1.3 1.4v.9c0 .9-.4 1.5-1.7 1.5"
        fill="none"
        stroke="var(--hero-plate)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
    {/* The send line along the foot, dashed, between the two corners, fading in and out. */}
    <span className="absolute bottom-[8px] left-[6.5rem] right-[6.75rem] h-[1.5px] bg-[linear-gradient(90deg,var(--hero-mark)_0_3px,transparent_3px_7px)] bg-[length:7px_1.5px] [mask-image:linear-gradient(90deg,transparent,black_20%,black_80%,transparent)] opacity-70 max-sm:hidden" />
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
