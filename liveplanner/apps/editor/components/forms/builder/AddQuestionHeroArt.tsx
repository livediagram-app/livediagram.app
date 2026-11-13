// The Add a Question gallery's hero art (docs/specs/030-forms/forms.md "The form card, top to bottom"), drawn in the
// dialog hero header's tokens: Share Form's dots fading toward the title, its own pieces. An answer box with its caret
// rising from the bottom left and a row of stars from the bottom right, and, where the header is wide enough (the
// centre piece), a hand of question tiles fanned out (a radio, a ticked box, a star, a calendar), the one in front
// lifted with the accent's plus, its ring spreading twice, motion allowing. The title mark is a form with a plus, a
// question to add.
import type { ReactNode } from 'react';
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const STROKE = {
  fill: 'none',
  stroke: 'var(--hero-mark)',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const STAR = 'M0 -7l2.1 4.3 4.7.7-3.4 3.3.8 4.7L0 3.8l-4.2 2.2.8-4.7-3.4-3.3 4.7-.7Z';

function QuestionTile({ x, turn, children }: { x: number; turn: number; children: ReactNode }) {
  return (
    <g transform={`translate(${x} 34) rotate(${turn})`}>
      <rect
        x="-15"
        y="-15"
        width="30"
        height="30"
        rx="8"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      {children}
    </g>
  );
}

const PIECES = (
  <>
    {/* An answer box rising from the bottom left, its caret after a line typed. */}
    <svg {...HERO_SVG} width="56" height="22" viewBox="0 0 56 22" className={HERO_PLACE.bottomLeft}>
      <rect x="4" y="6" width="48" height="20" rx="5" fill="var(--hero-wash)" />
      <path d="M11 14h18" stroke="var(--hero-paper)" strokeWidth="3" strokeLinecap="round" />
      <path d="M34 10v8" stroke="var(--hero-mark)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    {/* Three stars rising from the bottom right. */}
    <svg
      {...HERO_SVG}
      width="64"
      height="22"
      viewBox="0 0 64 22"
      className={HERO_PLACE.bottomRight}
    >
      <path d={STAR} transform="translate(12 15)" fill="var(--hero-wash)" />
      <path d={STAR} transform="translate(32 13)" fill="var(--hero-wash)" />
      <path d={STAR} transform="translate(52 15)" fill="var(--hero-line)" />
    </svg>
    {/* A hand of question tiles. */}
    <svg
      {...HERO_SVG}
      width="176"
      height="68"
      viewBox="0 0 176 68"
      className={HERO_PLACE.centre}
      data-questions-hand=""
    >
      <path
        d="M16 60C56 66 122 66 160 56"
        fill="none"
        stroke="var(--hero-line)"
        strokeWidth="1.25"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      <QuestionTile x={24} turn={-10}>
        {/* A radio, picked. */}
        <circle cx="0" cy="0" r="6" {...STROKE} />
        <circle cx="0" cy="0" r="2.5" fill="var(--hero-mark)" />
      </QuestionTile>
      <QuestionTile x={64} turn={-4}>
        {/* A ticked box. */}
        <rect x="-6" y="-6" width="12" height="12" rx="3" {...STROKE} />
        <path d="M-3 0l2 2 4-4" {...STROKE} />
      </QuestionTile>
      <QuestionTile x={104} turn={4}>
        {/* A star. */}
        <path d={STAR} {...STROKE} />
      </QuestionTile>
      <QuestionTile x={144} turn={10}>
        {/* A calendar. */}
        <rect x="-7" y="-6" width="14" height="13" rx="2.5" {...STROKE} />
        <path d="M-7 -2h14M-3.5 -8v3M3.5 -8v3" {...STROKE} />
        <circle cx="2.5" cy="3" r="1.4" fill="var(--hero-mark)" />
      </QuestionTile>
      {/* The tile in front, lifted, with the accent's plus, its ring spreading. */}
      <circle
        cx="84"
        cy="16"
        r="9"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.5"
        className={HERO_MOTION.ring}
      />
      <circle cx="84" cy="16" r="9" fill="var(--hero-accent)" />
      <path
        d="M84 11.5v9M79.5 16h9"
        stroke="var(--hero-plate)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  </>
);

export const addQuestionHeroArt: HeroArt = {
  name: 'add-question',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="2.5" width="13" height="15" rx="2.75" strokeWidth="1.6" />
      <path d="M6.75 6.75h4.5" strokeWidth="1.4" />
      <path d="M10 9.75v4.5M7.75 12h4.5" strokeWidth="1.6" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
  centre: true,
};
