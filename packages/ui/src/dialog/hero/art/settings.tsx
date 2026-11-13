// The Settings dialog's hero art (each app's docs/specs/007-editor/user-preferences.md and liveworkspace.app's
// liveworkspace/docs/specs/010-site/site.md "Settings"): the app, tuned to taste. A fine grid fades in from the
// title's side, a control panel's; in the bottom right two cogs mesh as they rise. Where the header is wide enough, a settings card sits
// between the title and the actions: a switch turned on, its ring spreading twice, over a slider half way along.
// The title mark is a cog.
// Every app's Settings and liveworkspace.app's draw it (the shared SettingsView), so it lives here
// (@liveworkspace/ui/dialog-hero-art/settings).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

// A cog's outline centred on (0, 0): `teeth` teeth between the root radius and the tip radius, as one closed path.
export function cogPath(teeth: number, root: number, tip: number): string {
  const half = Math.PI / teeth;
  const at = (r: number, a: number) =>
    `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  return Array.from({ length: teeth }, (_, i) => {
    const a = i * 2 * half - Math.PI / 2;
    return `L${at(root, a - half * 0.62)} L${at(tip, a - half * 0.34)} L${at(tip, a + half * 0.34)} L${at(root, a + half * 0.62)}`;
  })
    .join(' ')
    .replace(/^L/, 'M')
    .concat(' Z');
}

/** A cog with its hub cut out, in the accent. */
export const SETTINGS_GLYPH = (
  <path
    d={`${cogPath(8, 6.6, 8.6)} M2.6 0a2.6 2.6 0 1 0 -5.2 0a2.6 2.6 0 1 0 5.2 0Z`}
    transform="translate(10 10)"
    fill="var(--hero-accent)"
    fillRule="evenodd"
  />
);

const BIG_COG = cogPath(10, 17, 22);
const SMALL_COG = cogPath(7, 8.5, 12);

const PIECES = (
  <>
    {/* Two cogs meshing as they rise from the edge: the big one sitting back in the wash, the small one lifted. */}
    <svg
      {...HERO_SVG}
      width="84"
      height="30"
      viewBox="0 0 84 30"
      className={HERO_PLACE.bottomRight}
    >
      <g transform="translate(60 31) rotate(9)">
        <path
          d={BIG_COG}
          fill="var(--hero-wash)"
          stroke="var(--hero-line)"
          strokeLinejoin="round"
        />
        <circle r="6" fill="var(--hero-paper)" stroke="var(--hero-line)" />
      </g>
      <g transform="translate(30 23)">
        <path
          d={SMALL_COG}
          fill="var(--hero-plate)"
          stroke="var(--hero-mark)"
          strokeLinejoin="round"
        />
        <circle r="3" fill="var(--hero-line)" />
      </g>
    </svg>
    {/* A settings card: a switch turned on over a slider, a hairline between the two rows. */}
    <svg {...HERO_SVG} width="112" height="64" viewBox="0 0 112 64" className={HERO_PLACE.centre}>
      <rect
        x="4"
        y="8"
        width="104"
        height="48"
        rx="9"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <rect x="15" y="17.5" width="34" height="3.5" rx="1.75" fill="var(--hero-mark)" />
      <rect x="15" y="24" width="22" height="3" rx="1.5" fill="var(--hero-line)" />
      <rect x="74" y="16" width="24" height="13" rx="6.5" fill="var(--hero-accent)" />
      <circle cx="91.5" cy="22.5" r="4.5" fill="var(--hero-plate)" />
      <circle
        cx="91.5"
        cy="22.5"
        r="5.5"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.25"
        className={HERO_MOTION.ring}
      />
      <path d="M15 35.5H97" stroke="var(--hero-faint)" />
      <rect x="15" y="44" width="82" height="3" rx="1.5" fill="var(--hero-line)" />
      <rect x="15" y="44" width="44" height="3" rx="1.5" fill="var(--hero-mark)" />
      <circle
        cx="59"
        cy="45.5"
        r="5"
        fill="var(--hero-plate)"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
      />
    </svg>
  </>
);

export const settingsHeroArt: HeroArt = {
  name: 'settings',
  glyph: SETTINGS_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
  centre: true,
};
