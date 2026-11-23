// The link picker's hero art (each app's docs/specs/008-canvas/canvas-and-palette.md, links): where pressing an
// element goes, a tab, another file or a web address. Faint rings spread from the bottom right, where two links of a
// chain rise from the edge, tilted and truly interlocked (each passes over the other once), the far one in the
// accent. Nothing moves: a chain holds still. The title's side stays plain paper. The title mark is a chain link.
// Every app's link picker draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/link-picker).
import { HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A chain link, two halves reaching past each other, in the accent. */
export const LINK_PICKER_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8.4 10.9a4.1 4.1 0 0 0 6.2.4l2.5-2.5a4.1 4.1 0 0 0-5.8-5.8L9.9 4.4" />
    <path d="M11.6 9.1a4.1 4.1 0 0 0-6.2-.4l-2.5 2.5a4.1 4.1 0 0 0 5.8 5.8l1.4-1.4" />
  </g>
);

const PIECES = (
  <svg {...HERO_SVG} width="96" height="30" viewBox="0 0 96 30" className={HERO_PLACE.bottomRight}>
    <g transform="translate(0 3) rotate(-8 47 16)" fill="none" strokeWidth="3.25">
      {/* The near link. */}
      <rect x="14" y="6" width="38" height="14" rx="7" stroke="var(--hero-mark)" />
      {/* The far link, in the accent, over the near one's foot. */}
      <path d="M46.6 12.4A7 7 0 0 0 46.6 25.6" stroke="var(--hero-paper)" strokeWidth="6.5" />
      <rect x="42" y="12" width="38" height="14" rx="7" stroke="var(--hero-accent)" />
      {/* The near link's end comes back over the far one, so the two are locked. */}
      <path d="M50 8.1A7 7 0 0 1 51.6 15.4" stroke="var(--hero-paper)" strokeWidth="6.5" />
      <path d="M48.5 6.94A7 7 0 0 1 51 16.6" stroke="var(--hero-mark)" />
    </g>
  </svg>
);

export const linkPickerHeroArt: HeroArt = {
  name: 'link-picker',
  glyph: LINK_PICKER_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
