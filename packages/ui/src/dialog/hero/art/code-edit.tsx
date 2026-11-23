// The Code dialog's hero art (each app's docs/specs/009-elements, the code block): a snippet pasted or typed, a
// language picked for its highlighting. The baseline grid fades in from the title's side, an editor's ruled lines;
// in the bottom right an editor window rises from the edge: three dots on its bar, numbered lines of code stepping
// in and out, a keyword in the accent, and the caret at the end of the line being typed, its ring spreading twice.
// The title's side stays plain paper. The title mark is a pair of angle brackets round a slash.
// Every app's Code dialog draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/code-edit).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** Angle brackets round a slash, in the accent. */
export const CODE_EDIT_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6.5 6 2.5 10l4 4" />
    <path d="m13.5 6 4 4-4 4" />
    <path d="m11.4 4.5-2.8 11" />
  </g>
);

// A line of code: its number in the gutter, then its tokens, each [x, width, opacity].
function line(y: number, tokens: [number, number, number][]) {
  return (
    <g>
      <circle cx="10" cy={y} r="1.25" fill="var(--hero-line)" />
      {tokens.map(([x, width, opacity]) => (
        <rect
          key={x}
          x={x}
          y={y - 1.75}
          width={width}
          height="3.5"
          rx="1.75"
          fill="var(--hero-mark)"
          opacity={opacity}
        />
      ))}
    </g>
  );
}

const PIECES = (
  <svg {...HERO_SVG} width="96" height="30" viewBox="0 0 96 30" className={HERO_PLACE.bottomRight}>
    {/* The editor window, running off the band's foot. */}
    <rect
      x="3"
      y="1"
      width="90"
      height="36"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M3 9.5h90M16.5 9.5V30" stroke="var(--hero-line)" />
    <circle cx="9" cy="5.25" r="1.5" fill="var(--hero-line)" />
    <circle cx="14" cy="5.25" r="1.5" fill="var(--hero-line)" />
    <circle cx="19" cy="5.25" r="1.5" fill="var(--hero-line)" />
    {/* The keyword that opens the block. */}
    <rect x="22" y="13" width="12" height="3.5" rx="1.75" fill="var(--hero-accent)" />
    {line(14.75, [
      [37, 18, 1],
      [58, 7, 0.45],
    ])}
    {line(21.25, [
      [28, 9, 0.45],
      [40, 15, 1],
    ])}
    {line(27.75, [
      [28, 22, 0.45],
      [53, 8, 0.3],
    ])}
    {/* The caret, at the end of the line being typed. */}
    <circle
      cx="58.5"
      cy="21.25"
      r="5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <rect x="57.5" y="17.25" width="2" height="8" rx="1" fill="var(--hero-accent)" />
  </svg>
);

// The baseline grid, faded in from the title's side as the dots and grids are, so the words sit on plain paper.
const BASELINE = heroTexture('baseline');
const TEXTURE = {
  backgroundImage: `linear-gradient(90deg, var(--hero-paper) 0 34%, transparent 72%), ${BASELINE.backgroundImage}`,
  backgroundPosition: `0 0, ${BASELINE.backgroundPosition}`,
};

export const codeEditHeroArt: HeroArt = {
  name: 'code-edit',
  glyph: CODE_EDIT_GLYPH,
  texture: TEXTURE,
  pieces: PIECES,
};
