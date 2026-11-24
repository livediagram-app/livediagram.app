// The Trash popover's hero art (docs/specs/026-plan/items.md "Trash"): cards set aside, still there to bring back.
// A grid fades in from the title's side; in the bottom right a bin rises from the band's edge, its lid tilted open,
// a card dropping in over its rim, bobbing twice, motion allowing, and the accent's arrow curling back out beside
// it: Restore. The title mark is a bin.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** A bin: its lid, its handle and its body, in the accent. */
export const TRASH_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3.5 5.75h13M8 5.75V4.25c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v1.5" />
    <path d="M5.25 5.75l.7 9.4a1.5 1.5 0 0 0 1.5 1.35h5.1a1.5 1.5 0 0 0 1.5-1.35l.7-9.4M8.5 9v4.5M11.5 9v4.5" />
  </g>
);

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    <g className={HERO_MOTION.float}>
      <g transform="rotate(12 58 8)">
        <rect
          x="47"
          y="-2"
          width="22"
          height="20"
          rx="4"
          fill="var(--hero-plate)"
          stroke="var(--hero-line)"
        />
        <rect x="51" y="3" width="10" height="2.5" rx="1.25" fill="var(--hero-mark)" />
        <rect x="51" y="8" width="14" height="2" rx="1" fill="var(--hero-line)" />
      </g>
    </g>
    <path
      d="M40 16h36l-3 24H43z"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
      strokeLinejoin="round"
    />
    <path
      d="M50 21.5v10M58 21.5v10M66 21.5v10"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M36 14.5l41-7"
      stroke="var(--hero-mark)"
      strokeWidth="2.5"
      strokeLinecap="round"
      transform="rotate(-10 78 8)"
    />
    <circle cx="20" cy="20" r="8" fill="var(--hero-accent)" />
    <path
      d="M16.5 20.5a3.75 3.75 0 1 0 1.2-3.1M16.4 15.6v2.3h2.3"
      fill="none"
      stroke="var(--hero-plate)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const trashHeroArt: HeroArt = {
  name: 'trash',
  glyph: TRASH_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
