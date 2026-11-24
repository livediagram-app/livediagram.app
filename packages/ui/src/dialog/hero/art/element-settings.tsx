// The element settings dialog's hero art (each product's docs/specs/008-canvas/canvas-and-palette.md "An element's
// own settings open in a dialog"): what only this kind of element has, set in one place. A grid fades in from the
// title's side; in the bottom right a panel of three sliders rises from the edge, the middle one's knob in the
// accent, its ring spreading twice. The title mark is a pair of sliders.
// Every app's element settings dialog draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/element-settings).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

const TRACKS = [
  { y: 10, knob: 22, now: false },
  { y: 19, knob: 46, now: true },
  { y: 28, knob: 32, now: false },
];

const PIECES = (
  <svg {...HERO_SVG} width="80" height="30" viewBox="0 0 80 30" className={HERO_PLACE.bottomRight}>
    <rect
      x="1"
      y="2"
      width="78"
      height="40"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {TRACKS.map(({ y, knob, now }) => (
      <g key={y}>
        <rect x="9" y={y - 1.25} width="62" height="2.5" rx="1.25" fill="var(--hero-line)" />
        <rect
          x="9"
          y={y - 1.25}
          width={knob - 9}
          height="2.5"
          rx="1.25"
          fill={now ? 'var(--hero-accent)' : 'var(--hero-mark)'}
          opacity={now ? 1 : 0.6}
        />
        {now ? (
          <circle
            cx={knob}
            cy={y}
            r="6.5"
            fill="none"
            stroke="var(--hero-accent)"
            strokeWidth="1.25"
            className={HERO_MOTION.ring}
          />
        ) : null}
        <circle
          cx={knob}
          cy={y}
          r="3.5"
          fill="var(--hero-plate)"
          stroke={now ? 'var(--hero-accent)' : 'var(--hero-mark)'}
          strokeWidth="1.5"
        />
      </g>
    ))}
  </svg>
);

export const elementSettingsHeroArt: HeroArt = {
  name: 'element-settings',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 6.5h4M11 6.5h6M3 13.5h8M15 13.5h2" />
      <circle cx="9" cy="6.5" r="2" />
      <circle cx="13" cy="13.5" r="2" />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
