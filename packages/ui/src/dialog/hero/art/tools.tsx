// The footer Tools popover's hero art (liveworkspace/docs/specs/004-index/footer-tools-menu.md "The popover", every
// app's alike): the tools that work on the whole item, hung on a pegboard. Dots fade in from the title's side, the
// board's holes; in the bottom right a rail along the foot with four tool tiles hung from it (a rule's bolt, a
// suggestion's pencil, a snapshot's camera, history's clock), the third, in the accent, lifted off its peg and bobbing
// twice, motion allowing. The title mark is a toolbox. Every app's footer draws the one popover, so it lives here
// (@liveworkspace/ui/dialog-hero-art/tools).
import type { ReactNode } from 'react';
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A toolbox, its handle and its lid's line, in the accent. */
export const TOOLS_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2.5" y="6.5" width="15" height="10.5" rx="2" />
    <path d="M7 6.5V4.75c0-.55.45-1 1-1h4c.55 0 1 .45 1 1V6.5M2.5 11h15M8.75 11v1.75h2.5V11" />
  </g>
);

// Each tile's left edge along the rail, and the tile's size.
const TILE = 17;
const RAIL_Y = 8;
const XS = [4, 27, 50, 73];

// The glyphs drawn on the tiles, in a 17 x 17 box: a bolt, a pencil, a camera, a clock.
const BOLT = <path d="M9.5 3.5 5.5 9h3l-1 4.5 4-5.5h-3z" />;
const PENCIL = <path d="M4.5 12.5l.6-2.6 5.8-5.8 2 2-5.8 5.8zM10 5l2 2" />;
const CAMERA = (
  <>
    <rect x="3.5" y="5.75" width="10" height="7" rx="1.25" />
    <path d="M6.5 5.75l.9-1.5h2.2l.9 1.5" />
    <circle cx="8.5" cy="9.25" r="1.9" />
  </>
);
const CLOCK = (
  <>
    <circle cx="8.5" cy="8.5" r="4.5" />
    <path d="M8.5 6.25V8.5l1.6 1" />
  </>
);

function Hung({ x, glyph, lit = false }: { x: number; glyph: ReactNode; lit?: boolean }) {
  const mid = x + TILE / 2;
  return (
    <g className={lit ? HERO_MOTION.float : undefined}>
      {/* The peg it hangs from, then the tile. */}
      <path d={`M${mid} ${RAIL_Y}v4`} stroke="var(--hero-line)" strokeWidth="1.25" />
      <rect
        x={x}
        y={RAIL_Y + 4}
        width={TILE}
        height={TILE}
        rx="4"
        fill={lit ? 'var(--hero-accent)' : 'var(--hero-plate)'}
        stroke={lit ? 'var(--hero-accent)' : 'var(--hero-line)'}
        strokeWidth="1.25"
      />
      <g
        transform={`translate(${x} ${RAIL_Y + 4})`}
        fill="none"
        stroke={lit ? 'var(--hero-plate)' : 'var(--hero-mark)'}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph}
      </g>
    </g>
  );
}

const PIECES = (
  <svg {...HERO_SVG} width="96" height="30" viewBox="0 0 96 30" className={HERO_PLACE.bottomRight}>
    {/* The rail, its pegs' holes, and the four tools hung from it. */}
    <path d={`M1 ${RAIL_Y}H95`} stroke="var(--hero-mark)" strokeWidth="1.5" strokeLinecap="round" />
    {[0, 1, 2, 3].map((i) => (
      <circle
        key={i}
        cx={XS[i]! + TILE / 2}
        cy={RAIL_Y}
        r="1.75"
        fill="var(--hero-plate)"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
      />
    ))}
    <Hung x={XS[0]!} glyph={BOLT} />
    <Hung x={XS[1]!} glyph={PENCIL} />
    <Hung x={XS[2]!} glyph={CAMERA} lit />
    <Hung x={XS[3]!} glyph={CLOCK} />
  </svg>
);

export const toolsHeroArt: HeroArt = {
  name: 'tools',
  glyph: TOOLS_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
