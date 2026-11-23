// The Contents popover's hero art (each product's docs/specs/007-editor/pages-mode.md "Contents"): every page, in
// order. The baseline grid fades in from the title's side; in the bottom right three page thumbnails rise from the
// band's edge in a row, the one in view taller, ringed in the accent with its page number's badge, the ring spreading
// twice, motion allowing. The title mark is a list of pages.
// livedocuments', livedesign's and liveknowledge's Contents use it, so it lives here
// (@liveworkspace/ui/dialog-hero-art/contents).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A list of pages: three rows, each a marker and a line, in the accent. */
export const CONTENTS_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 5.5h8.5M8 10h8.5M8 14.5h8.5" />
    <path d="M3.75 5.5h.5M3.75 10h.5M3.75 14.5h.5" strokeWidth="2.4" />
  </g>
);

// A page thumbnail rising from the foot, top left at (x, y), 22 wide: a heading and two lines.
function page(x: number, y: number, stroke: string) {
  return (
    <>
      <rect x={x} y={y} width="22" height="34" rx="3.5" fill="var(--hero-plate)" stroke={stroke} />
      <rect x={x + 4} y={y + 5} width="10" height="3" rx="1.5" fill="var(--hero-mark)" />
      <rect x={x + 4} y={y + 11} width="14" height="2" rx="1" fill="var(--hero-line)" />
      <rect x={x + 4} y={y + 15} width="11" height="2" rx="1" fill="var(--hero-line)" />
    </>
  );
}

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    {page(8, 15, 'var(--hero-line)')}
    {page(70, 15, 'var(--hero-line)')}
    {page(38, 6, 'var(--hero-accent)')}
    <circle
      cx="60"
      cy="7"
      r="5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="60" cy="7" r="5" fill="var(--hero-accent)" />
    <path
      d="M59.2 5.4l1.1-.9v5"
      fill="none"
      stroke="var(--hero-plate)"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const contentsHeroArt: HeroArt = {
  name: 'contents',
  glyph: CONTENTS_GLYPH,
  texture: heroTexture('baseline'),
  pieces: PIECES,
};
