// The Edit Quiz dialog's hero art (docs/specs/012-collaboration/quiz.md), drawn in the dialog hero header's tokens:
// one question, its answers. Faint dots fade in from the title's side; in the bottom right a quiz card rises off
// the band's foot, the question's line over a grid of answer chips, the right one in the accent with its tick,
// bobbing twice, motion allowing. The title mark is a question mark in a card.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// An answer chip yet to be picked: its letter's dot and its words.
function answer(x: number, y: number, words: number) {
  return (
    <g key={`${x}-${y}`}>
      <rect
        x={x}
        y={y}
        width="33"
        height="9.5"
        rx="4.75"
        fill="var(--hero-wash)"
        stroke="var(--hero-line)"
      />
      <circle cx={x + 5.5} cy={y + 4.75} r="1.75" fill="var(--hero-mark)" opacity="0.6" />
      <rect
        x={x + 10}
        y={y + 3.25}
        width={words}
        height="3"
        rx="1.5"
        fill="var(--hero-mark)"
        opacity="0.6"
      />
    </g>
  );
}

const PIECES = (
  <svg
    {...HERO_SVG}
    width="88"
    height="30"
    viewBox="0 0 88 30"
    className={HERO_PLACE.bottomRight}
    data-quiz-edit-art=""
  >
    <rect
      x="1"
      y="2"
      width="86"
      height="36"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {/* The question. */}
    <rect x="8" y="7.5" width="38" height="4" rx="2" fill="var(--hero-mark)" />
    {answer(8, 16, 15)}
    {answer(8, 28, 11)}
    {answer(46.5, 28, 17)}
    {/* The right answer. */}
    <g className={HERO_MOTION.float}>
      <rect x="46.5" y="16" width="33" height="9.5" rx="4.75" fill="var(--hero-accent)" />
      <path
        d="M50.5 20.9l1.9 1.9 3.4-3.9"
        fill="none"
        stroke="var(--hero-plate)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="59"
        y="19.25"
        width="14"
        height="3"
        rx="1.5"
        fill="var(--hero-plate)"
        opacity="0.85"
      />
    </g>
  </svg>
);

export const quizEditHeroArt: HeroArt = {
  name: 'quiz-edit',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3" width="14" height="14" rx="4" />
      <path d="M8 8.2a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.6" strokeWidth="1.6" />
      <circle cx="10" cy="13.7" r="1" fill="var(--hero-accent)" stroke="none" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
