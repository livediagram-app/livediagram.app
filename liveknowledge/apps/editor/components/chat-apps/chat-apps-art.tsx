// Slack and Teams' drawings (docs/specs/030-knowledgebase/chat-apps.md "Connecting"): the hero header's art, and each
// platform row's mark. The hero art is a module constant in the hero's tokens; the marks are the theme's classes,
// plain shapes that say "chat" rather than either company's logo.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** The title mark: two speech bubbles, one answering the other. */
const BUBBLES_GLYPH = (
  <g fill="none" stroke="var(--hero-accent)" strokeLinecap="round" strokeLinejoin="round">
    <path
      d="M3 4.5h9a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H7l-3 2.5v-2.5H3A1.5 1.5 0 0 1 1.5 11V6A1.5 1.5 0 0 1 3 4.5Z"
      strokeWidth="1.5"
    />
    <path
      d="M15.5 8h1.5a1.5 1.5 0 0 1 1.5 1.5V14a1.5 1.5 0 0 1-1.5 1.5H16v2l-2.5-2h-4"
      strokeWidth="1.5"
    />
  </g>
);

// Under the header's buttons: a question bubble, a page answering it with a tick, and the answer's bubble rising.
const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="34"
    viewBox="0 0 96 34"
    className={HERO_PLACE.bottomRight}
    data-chat-apps-hero=""
  >
    {/* The question. */}
    <path
      d="M6 10h24a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H16l-6 5v-5H6a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path
      d="M9 16h18M9 21h11"
      stroke="var(--hero-mark)"
      strokeWidth="2.2"
      strokeLinecap="round"
      opacity="0.55"
    />
    {/* The page it is answered from, running off the band's foot. */}
    <rect
      x="42"
      y="6"
      width="26"
      height="36"
      rx="4"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path
      d="M47 13h16M47 18h12M47 23h16"
      stroke="var(--hero-mark)"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.5"
    />
    <circle cx="62" cy="30" r="5" fill="var(--hero-accent)" />
    <path
      d="M59.6 30.1l1.6 1.6 3-3.2"
      fill="none"
      stroke="var(--hero-plate)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* The answer, bobbing up (motion allowing). */}
    <g className={HERO_MOTION.float}>
      <path
        d="M76 4h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-2v4l-4.5-4H76a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
        fill="var(--hero-accent)"
      />
      <path
        d="M77.5 9h11M77.5 12.5h7"
        stroke="var(--hero-plate)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
  </svg>
);

export const chatAppsHeroArt: HeroArt = {
  name: 'chat-apps',
  glyph: BUBBLES_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};

/** Slack's row: a hash, as its channels are named. */
export function SlackMark() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden data-chat-mark="slack">
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="10"
        className="fill-violet-50 stroke-violet-200 dark:fill-violet-500/10 dark:stroke-violet-400/30"
      />
      <path
        d="M16 11l-2.5 18M26.5 11L24 29M11 16.5h18M10.5 23.5h18"
        className="stroke-violet-600 dark:stroke-violet-300"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Teams' row: two people at a table, as a team meets. */
export function TeamsMark() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden data-chat-mark="teams">
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="10"
        className="fill-indigo-50 stroke-indigo-200 dark:fill-indigo-500/10 dark:stroke-indigo-400/30"
      />
      <circle cx="16" cy="14" r="4" className="fill-indigo-600 dark:fill-indigo-300" />
      <circle cx="26.5" cy="15.5" r="3" className="fill-indigo-400 dark:fill-indigo-400" />
      <path
        d="M9.5 28c0-4.4 2.9-7.5 6.5-7.5s6.5 3.1 6.5 7.5Z"
        className="fill-indigo-600 dark:fill-indigo-300"
      />
      <path
        d="M22 28c.3-3.4 2-5.6 4.5-5.6s4.4 2.2 4.6 5.6Z"
        className="fill-indigo-400 dark:fill-indigo-400"
      />
    </svg>
  );
}
