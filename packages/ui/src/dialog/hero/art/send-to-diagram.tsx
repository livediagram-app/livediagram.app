// Send to Diagram's hero art (liveworkspace/docs/specs/004-index/send-to-diagram.md "The picker"): words becoming a
// picture. A faint dot grid fades in from the title's side, the canvas; in the bottom right a page of lines sends an
// arrow into three boxes joined as a small flow, the last box in the accent, which bobs twice, motion allowing. The
// title mark is two boxes joined by a line. Every app's Send to Diagram uses it, so it lives here
// (@liveworkspace/ui/dialog-hero-art/send-to-diagram).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** Two boxes joined by an elbow line, in the accent. */
export const SEND_TO_DIAGRAM_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2.5" y="3" width="7" height="5.5" rx="1.5" />
    <rect x="10.5" y="11.5" width="7" height="5.5" rx="1.5" />
    <path d="M6 8.5v5.75h4.5" />
  </g>
);

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="29"
    viewBox="0 0 132 40"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    {/* The page: the words picked, as lines. */}
    <g transform="rotate(-8 14 30)">
      <rect
        x="2"
        y="8"
        width="24"
        height="30"
        rx="3.5"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <path
        d="M7 15h14M7 20h11M7 25h14M7 30h8"
        stroke="var(--hero-line)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </g>
    {/* Read across. */}
    <path
      d="M32 22h10M38.5 18.5L42 22l-3.5 3.5"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* The flow it becomes: a box, a decision, and the box in the accent. */}
    <path
      d="M66 22h10M96 22h8"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
    <rect
      x="48"
      y="13"
      width="18"
      height="18"
      rx="4"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M86 11l10 11-10 11-10-11Z" fill="var(--hero-wash)" stroke="var(--hero-line)" />
    <g className={HERO_MOTION.float}>
      <rect x="104" y="11" width="24" height="22" rx="5" fill="var(--hero-accent)" />
      <path
        d="M110 19h12M110 24.5h8"
        stroke="var(--hero-plate)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </g>
  </svg>
);

export const sendToDiagramHeroArt: HeroArt = {
  name: 'send-to-diagram',
  glyph: SEND_TO_DIAGRAM_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
