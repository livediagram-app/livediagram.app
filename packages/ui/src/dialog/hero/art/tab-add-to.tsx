// The Add to Another Canvas, Design or Space dialog's hero art (each app's TabOrganiseDialogs: link the tab into
// another one, where it stays one live tab shown in both). A faint grid fades in from the title's side; in the
// bottom right two windows rise off the band's foot side by side, the same tab in the accent on both tab strips,
// joined over the top by a dashed arc whose knot spreads a ring twice, motion allowing. The title mark is two
// windows sharing one bar.
// Every app's dialog draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/tab-add-to).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

// A window with its tab strip: a quiet tab and the shared one, over a line of its content.
function windowAt(x: number) {
  return (
    <g key={x}>
      <rect
        x={x}
        y="12"
        width="40"
        height="26"
        rx="5"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <path d={`M${x} 23.5h40`} stroke="var(--hero-line)" />
      <rect
        x={x + 4.5}
        y="15.5"
        width="10"
        height="5"
        rx="2.5"
        fill="var(--hero-mark)"
        opacity="0.5"
      />
      <rect x={x + 17} y="15.5" width="13" height="5" rx="2.5" fill="var(--hero-accent)" />
      <rect
        x={x + 5}
        y="27"
        width="16"
        height="3.5"
        rx="1.75"
        fill="var(--hero-mark)"
        opacity="0.45"
      />
    </g>
  );
}

const PIECES = (
  <svg {...HERO_SVG} width="96" height="30" viewBox="0 0 96 30" className={HERO_PLACE.bottomRight}>
    {[1, 55].map(windowAt)}
    {/* One tab, in both: the link over the top and its knot. */}
    <path
      d="M24.5 14.5C32 2.5 71 2.5 78.5 14.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="3 2.5"
    />
    <circle
      cx="51.5"
      cy="5.5"
      r="4.75"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="51.5" cy="5.5" r="2.5" fill="var(--hero-accent)" />
  </svg>
);

export const tabAddToHeroArt: HeroArt = {
  name: 'tab-add-to',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="2.5" y="5" width="6.5" height="10" rx="2" />
      <rect x="11" y="5" width="6.5" height="10" rx="2" />
      <path d="M5.75 10h8.5" strokeLinecap="round" />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
