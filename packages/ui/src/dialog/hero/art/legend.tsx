// The Legend dialog's hero art (each product's docs/specs/009-elements/pie-chart.md "Legend"): a key, each colour
// beside what it means. Rings spread from the bottom right, where a small pie rises from the edge with one slice
// in the accent, a dashed line running from that slice to its row in the key beside it: a swatch and a word per
// colour, the accent row's swatch ringed, its ring spreading twice. The title mark is three swatches, a line each.
// Every app's Legend dialog draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/legend).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

const KEY = [
  { y: 9, line: 16, fill: 'var(--hero-accent)' },
  { y: 17, line: 22, fill: 'var(--hero-mark)' },
  { y: 25, line: 13, fill: 'var(--hero-line)' },
];

const PIECES = (
  <svg {...HERO_SVG} width="92" height="30" viewBox="0 0 92 30" className={HERO_PLACE.bottomRight}>
    {/* The pie, its lower half off the foot. */}
    <circle cx="20" cy="26" r="18" fill="var(--hero-plate)" stroke="var(--hero-line)" />
    <path d="M20 26V8a18 18 0 0 1 15.6 9Z" fill="var(--hero-accent)" />
    <path d="M20 26 4.4 17" stroke="var(--hero-line)" />
    {/* From the slice to its row. */}
    <path d="M33 12c5-4 9-4 13-3" fill="none" stroke="var(--hero-mark)" strokeDasharray="2 2.5" />
    {/* The key. */}
    <rect
      x="46"
      y="2"
      width="45"
      height="38"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {KEY.map(({ y, line, fill }, i) => (
      <g key={y}>
        {i === 0 ? (
          <circle
            cx="54.5"
            cy={y}
            r="5.5"
            fill="none"
            stroke="var(--hero-accent)"
            strokeWidth="1.25"
            className={HERO_MOTION.ring}
          />
        ) : null}
        <rect x="51.5" y={y - 3} width="6" height="6" rx="1.5" fill={fill} />
        <rect
          x="62"
          y={y - 1.5}
          width={line}
          height="3"
          rx="1.5"
          fill="var(--hero-mark)"
          opacity={i === 0 ? 1 : 0.5}
        />
      </g>
    ))}
  </svg>
);

export const legendHeroArt: HeroArt = {
  name: 'legend',
  glyph: (
    <g stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3.5" width="4" height="4" rx="1" fill="var(--hero-accent)" stroke="none" />
      <path d="M10.5 5.5h6.5" />
      <rect
        x="3"
        y="8"
        width="4"
        height="4"
        rx="1"
        fill="var(--hero-accent)"
        stroke="none"
        opacity="0.6"
      />
      <path d="M10.5 10h6.5" />
      <rect
        x="3"
        y="12.5"
        width="4"
        height="4"
        rx="1"
        fill="var(--hero-accent)"
        stroke="none"
        opacity="0.35"
      />
      <path d="M10.5 14.5h6.5" />
    </g>
  ),
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
