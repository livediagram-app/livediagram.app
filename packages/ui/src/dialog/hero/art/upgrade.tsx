// The upgrade dialog's hero art (liveworkspace/docs/specs/019-subscription/subscription.md "What people see"): a step
// up. Faint rings spread from the bottom right, where three tiers rise off the band's foot as steps, each a step up
// from the last, the top one carrying a star in the accent that bobs twice, motion allowing. On a wide header a card of
// limits stands in the centre: each row's bar runs past the dashed line where Free stops, and the accent's arrow up
// sits on its corner. The title mark is two chevrons rising. Every app's upgrade dialog is subscription-ui's one, so it
// lives here (@liveworkspace/ui/dialog-hero-art/upgrade).
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroStar,
  heroTexture,
  type HeroArt,
} from '../hero-art';

/** Two chevrons rising, in the accent: up a tier. */
export const UPGRADE_GLYPH = (
  <path
    d="M5 10.5l5-5 5 5M5 15.5l5-5 5 5"
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

// The tiers as steps: where each starts, how high it rises, and its ground.
const STEPS = [
  { x: 4, top: 21, fill: 'var(--hero-soft)' },
  { x: 34, top: 14, fill: 'var(--hero-plate)' },
  { x: 64, top: 7, fill: 'var(--hero-plate)' },
] as const;

// The card of limits: each row's bar, as far as it runs (the dashed line where Free stops is at 66).
const LIMITS = [
  { y: 15, to: 118 },
  { y: 28, to: 98 },
  { y: 41, to: 128 },
] as const;
const FREE_X = 66;

const PIECES = (
  <>
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      className={`${HERO_PLACE.bottomRight} overflow-visible`}
    >
      {STEPS.map(({ x, top, fill }) => (
        <g key={x}>
          <rect
            x={x}
            y={top}
            width="28"
            height={36 - top}
            rx="3.5"
            fill={fill}
            stroke="var(--hero-line)"
          />
          <rect x={x + 5} y={top + 5} width="11" height="2.5" rx="1.25" fill="var(--hero-line)" />
        </g>
      ))}
      <g className={HERO_MOTION.float}>
        <circle cx="84" cy="16" r="5.5" fill="var(--hero-accent)" />
        <path d={heroStar(84, 16, 3.4)} fill="var(--hero-plate)" />
      </g>
    </svg>
    <svg
      {...HERO_SVG}
      width="150"
      height="56"
      viewBox="0 0 150 56"
      className={`${HERO_PLACE.centre} overflow-visible`}
    >
      <rect
        x="0.5"
        y="0.5"
        width="140"
        height="55"
        rx="8"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      {LIMITS.map(({ y, to }) => (
        <g key={y}>
          <rect x="10" y={y - 2} width="16" height="4" rx="2" fill="var(--hero-line)" />
          <rect x="34" y={y - 3} width="96" height="6" rx="3" fill="var(--hero-soft)" />
          <rect x="34" y={y - 3} width={to - 34} height="6" rx="3" fill="var(--hero-accent)" />
          <rect x="34" y={y - 3} width={FREE_X - 34} height="6" rx="3" fill="var(--hero-mark)" />
        </g>
      ))}
      <path
        d={`M${FREE_X} 7V49`}
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeDasharray="2.5 2.5"
        strokeLinecap="round"
      />
      <circle cx="140" cy="6" r="7" fill="var(--hero-accent)" />
      <path
        d="M140 9.5V2.75M137 5.5l3-3 3 3"
        fill="none"
        stroke="var(--hero-plate)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </>
);

export const upgradeHeroArt: HeroArt = {
  name: 'upgrade',
  glyph: UPGRADE_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
  centre: true,
};
