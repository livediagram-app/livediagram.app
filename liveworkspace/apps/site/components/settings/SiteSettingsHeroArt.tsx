// liveworkspace.app's Settings hero art (liveworkspace/docs/specs/010-site/site.md "Settings"): one account, every
// app. The Settings grid fades in from the title's side; in the bottom left the apps' tiles rise from the edge, each
// to its own height; in the bottom right the account rises, a cog on its shoulder. Where the header is wide enough,
// the account sits at the hub of four app tiles, each joined to it by a dashed line, its ring spreading twice: what
// it sets here reaches them all. The title mark is the Settings cog.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';
import { cogPath, SETTINGS_GLYPH } from '@liveworkspace/ui/dialog-hero-art/settings';

const SHOULDER_COG = cogPath(7, 4.6, 6.4);

// An app's tile: a rounded square in its shade with a mark of the plate on it.
function tile(x: number, y: number, fill: string, size = 18) {
  const r = size * 0.28;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={r}
        fill={fill}
        stroke="var(--hero-plate)"
        strokeWidth="1.5"
      />
      <circle cx={x + size / 2} cy={y + size / 2} r={size * 0.17} fill="var(--hero-plate)" />
    </g>
  );
}

// The account on the hub: a person on a disc.
function person(cx: number, cy: number, r: number, fill: string) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke="var(--hero-plate)" strokeWidth="2" />
      <circle cx={cx} cy={cy - r * 0.28} r={r * 0.3} fill="var(--hero-plate)" />
      <path
        d={`M${cx - r * 0.55} ${cy + r * 0.62}a${r * 0.55} ${r * 0.5} 0 0 1 ${r * 1.1} 0Z`}
        fill="var(--hero-plate)"
      />
    </g>
  );
}

const PIECES = (
  <>
    {/* The apps' tiles, each risen to its own height. */}
    <svg {...HERO_SVG} width="70" height="30" viewBox="0 0 70 30" className={HERO_PLACE.bottomLeft}>
      {tile(4, 14, 'var(--hero-soft)')}
      {tile(26, 6, 'var(--hero-wash)')}
      {tile(48, 18, 'var(--hero-line)')}
    </svg>
    {/* The account, rising, a cog on its shoulder. */}
    <svg
      {...HERO_SVG}
      width="56"
      height="30"
      viewBox="0 0 56 30"
      className={HERO_PLACE.bottomRight}
    >
      <path d="M8 31a18 16 0 0 1 36 0Z" fill="var(--hero-wash)" />
      <circle cx="26" cy="9" r="7" fill="var(--hero-wash)" />
      <circle cx="43" cy="18" r="8" fill="var(--hero-plate)" stroke="var(--hero-line)" />
      <g transform="translate(43 18)">
        <path d={SHOULDER_COG} fill="var(--hero-mark)" />
        <circle r="1.8" fill="var(--hero-plate)" />
      </g>
    </svg>
    {/* The account at the hub of four apps, a dashed line to each, its ring spreading. */}
    <svg
      {...HERO_SVG}
      width="112"
      height="64"
      viewBox="0 0 112 64"
      className={HERO_PLACE.centre}
      data-site-settings-hub=""
    >
      <path
        d="M56 32L18 13M56 32L18 51M56 32L94 13M56 32L94 51"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeDasharray="2.5 3.5"
        strokeLinecap="round"
      />
      {tile(9, 4, 'var(--hero-soft)')}
      {tile(9, 42, 'var(--hero-wash)')}
      {tile(85, 4, 'var(--hero-wash)')}
      {tile(85, 42, 'var(--hero-line)')}
      <circle
        cx="56"
        cy="32"
        r="13"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.5"
        className={HERO_MOTION.ring}
      />
      {person(56, 32, 13, 'var(--hero-accent)')}
    </svg>
  </>
);

export const siteSettingsHeroArt: HeroArt = {
  name: 'site-settings',
  glyph: SETTINGS_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
  centre: true,
};
