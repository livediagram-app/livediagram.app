// The Add an Action picker's hero art (docs/specs/026-plan/automations.md "The rule builder"), drawn in the dialog
// hero header's tokens: the Automations screen's dots fading toward the title, its own pieces. A flag rising from the
// bottom right, and, where the header is wide enough (the centre piece), a hand of
// action tiles fanned out (a label, a flag, a letter, a sparkle), the one in front lifted with the accent's plus, its
// ring spreading twice, motion allowing. The title mark is a card with a plus, an action to add.
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

function ActionTile({ x, turn, children }: { x: number; turn: number; children: ReactNode }) {
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
    {/* A flag rising from the bottom right. */}
    <svg
      {...HERO_SVG}
      width="40"
      height="24"
      viewBox="0 0 40 24"
      className={HERO_PLACE.bottomRight}
    >
      <path d="M12 26V5" stroke="var(--hero-line)" strokeWidth="3" strokeLinecap="round" />
      <path d="M12 5c6-3 10 3 18 0v11c-8 3-12-3-18 0Z" fill="var(--hero-wash)" />
    </svg>
    {/* A hand of action tiles. */}
    <svg
      {...HERO_SVG}
      width="176"
      height="68"
      viewBox="0 0 176 68"
      className={HERO_PLACE.centre}
      data-actions-hand=""
    >
      <path
        d="M16 60C56 66 122 66 160 56"
        fill="none"
        stroke="var(--hero-line)"
        strokeWidth="1.25"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      <ActionTile x={24} turn={-10}>
        {/* A label. */}
        <path d="M-6 -5h7l5 5-5 5h-7Z" {...STROKE} />
        <circle cx="-2.5" cy="0" r="1.2" fill="var(--hero-mark)" />
      </ActionTile>
      <ActionTile x={64} turn={-4}>
        {/* A flag. */}
        <path d="M-5 7V-7M-5 -6c4-2 6 2 10 0v7c-4 2-6-2-10 0" {...STROKE} />
      </ActionTile>
      <ActionTile x={104} turn={4}>
        {/* A letter. */}
        <rect x="-7" y="-5" width="14" height="10" rx="2" {...STROKE} />
        <path d="M-7 -4l7 5 7-5" {...STROKE} />
      </ActionTile>
      <ActionTile x={144} turn={10}>
        {/* A sparkle. */}
        <path
          d="M0 -8C1 -2 2 -1 8 0C2 1 1 2 0 8C-1 2 -2 1 -8 0C-2 -1 -1 -2 0 -8Z"
          fill="var(--hero-mark)"
        />
      </ActionTile>
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

export const addActionHeroArt: HeroArt = {
  name: 'add-action',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinecap="round">
      <rect x="2.75" y="2.75" width="14.5" height="14.5" rx="4" />
      <path d="M10 6.5v7M6.5 10h7" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
  centre: true,
};
