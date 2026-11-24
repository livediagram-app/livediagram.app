// Send to Knowledge Base's hero art (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The picker"): picked items
// on a canvas becoming a section of a knowledgebase page. Dots fade in from the title's side; in the bottom right a
// selection of two boxes and an arrow sits inside its dashed selection frame, a dashed arc runs from it to a page rising
// off the band's foot, its heading and lines already written, and the new section, a small picture in the accent,
// settles into place, bobbing twice, motion allowing. The title mark is a page with a heading and a picture. Every
// editor's picker is workbench's one, so it lives here (@liveworkspace/ui/dialog-hero-art/send-to-knowledge).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A page: its heading bar, a line, and a picture block in the accent. */
export const SEND_TO_KNOWLEDGE_GLYPH = (
  <>
    <rect
      x="3.75"
      y="2.75"
      width="12.5"
      height="14.5"
      rx="2.25"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.7"
    />
    <path
      d="M6.75 6.5h6.5M6.75 9h4"
      stroke="var(--hero-accent)"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <rect x="6.75" y="11" width="6.5" height="3.5" rx="0.75" fill="var(--hero-accent)" />
  </>
);

// The page's written lines: where each starts down the page and how long it runs.
const LINES = [
  { y: 13, w: 30 },
  { y: 17, w: 26 },
  { y: 21, w: 30 },
] as const;

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    {/* The selection: two boxes joined by an arrow, inside the dashed frame a selection wears. */}
    <rect
      x="2"
      y="13"
      width="32"
      height="20"
      rx="2.5"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1"
      strokeDasharray="2.5 2"
    />
    <rect
      x="5"
      y="17"
      width="10"
      height="8"
      rx="1.75"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
    />
    <rect
      x="21"
      y="17"
      width="10"
      height="8"
      rx="1.75"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
    />
    <path d="M15 21h5" stroke="var(--hero-line)" strokeWidth="1.25" strokeLinecap="round" />
    <path
      d="M31 11C35 4 39 2 46 4"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="3 2.5"
      strokeLinecap="round"
    />
    {/* The page, rising from the edge: a heading and its written lines. */}
    <rect
      x="48"
      y="2"
      width="42"
      height="34"
      rx="4"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="53" y="6.5" width="20" height="3" rx="1.5" fill="var(--hero-line)" />
    {LINES.map(({ y, w }) => (
      <rect key={y} x="53" y={y} width={w} height="2" rx="1" fill="var(--hero-soft)" />
    ))}
    {/* The new section's picture, settling in under the lines. */}
    <g className={HERO_MOTION.float}>
      <rect x="53" y="25" width="16" height="8" rx="1.75" fill="var(--hero-accent)" />
      <path
        d="M55.5 31l3.5-3.5 2.5 2.5 2-2 3 3"
        fill="none"
        stroke="var(--hero-plate)"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

export const sendToKnowledgeHeroArt: HeroArt = {
  name: 'send-to-knowledge',
  glyph: SEND_TO_KNOWLEDGE_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
