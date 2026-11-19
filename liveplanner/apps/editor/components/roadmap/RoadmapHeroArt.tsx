// Publish Roadmap's hero art (docs/specs/026-plan/public-roadmap.md "The dialog"), drawn in the dialog hero
// header's tokens: a faint grid fading out toward the title, and in the bottom right three short columns rising off
// the band's foot, their cards plain except one, whose upvote is lit and rings out, motion allowing. The title mark
// is a megaphone, as the tab menu's row.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// Each column's cards (how many), the lit card in the middle column's first place.
const COLUMNS = [3, 2, 3];

const PIECES = (
  <svg
    {...HERO_SVG}
    width="72"
    height="46"
    viewBox="0 0 72 46"
    className={HERO_PLACE.bottomRight}
    data-roadmap-columns=""
  >
    {COLUMNS.map((cards, col) => (
      <g key={col} transform={`translate(${1 + col * 24} 4)`}>
        <rect width="22" height="50" rx="4" fill="var(--hero-plate)" stroke="var(--hero-line)" />
        {Array.from({ length: cards }, (_, i) => {
          const lit = col === 1 && i === 0;
          return (
            <g key={i} transform={`translate(3 ${4 + i * 12})`}>
              <rect
                width="16"
                height="9"
                rx="2"
                fill={lit ? 'var(--hero-plate)' : 'var(--hero-mark)'}
                stroke={lit ? 'var(--hero-accent)' : 'none'}
                opacity={lit ? 1 : 0.45}
              />
              {lit ? (
                <>
                  <circle
                    cx="4.5"
                    cy="4.5"
                    r="3.5"
                    fill="none"
                    stroke="var(--hero-accent)"
                    className={HERO_MOTION.ring}
                  />
                  <path
                    d="M2.75 5.5L4.5 3.5L6.25 5.5"
                    fill="none"
                    stroke="var(--hero-accent)"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : null}
            </g>
          );
        })}
      </g>
    ))}
  </svg>
);

export const roadmapHeroArt: HeroArt = {
  name: 'roadmap',
  glyph: (
    <>
      <path
        d="M3 8.5v3a1 1 0 0 0 1 1h2l5 3.5V4L6 7.5H4a1 1 0 0 0-1 1Z"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M14 7.5a3.5 3.5 0 0 1 0 5M7 12.5l1 4"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
