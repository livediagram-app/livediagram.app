// AI Editing's drawings (docs/specs/030-knowledgebase/ai-editing.md "The dialog"): the hero header's art, and one small
// picture for each level's card. The hero art is a module constant (the band paints once); its colours are the hero's
// tokens. The cards' pictures take their colours from the theme's classes, brighter on the chosen card.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';
import type { AiEditing } from '@liveknowledge/knowledge';

/** The title mark: a shield, a sparkle inside it. */
const SHIELD_GLYPH = (
  <g fill="none" stroke="var(--hero-accent)" strokeLinecap="round" strokeLinejoin="round">
    <path
      d="M10 2.5l6 2.25v4.6c0 3.9-2.55 6.9-6 8.15-3.45-1.25-6-4.25-6-8.15v-4.6Z"
      strokeWidth="1.6"
    />
    <path
      d="M10 6.9l.85 1.95 1.95.85-1.95.85L10 12.5l-.85-1.95-1.95-.85 1.95-.85Z"
      fill="var(--hero-accent)"
      strokeWidth="0.9"
    />
  </g>
);

// A page rising from the band's foot, its lines of writing, a pencil writing on it, a shield standing guard beside it
// and a sparkle that bobs twice (motion allowing).
const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {/* The shield. */}
    <path
      d="M22 9l9 3.4v6.6c0 5.6-3.7 9.6-9 11.4-5.3-1.8-9-5.8-9-11.4v-6.6Z"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
      strokeWidth="1"
    />
    <path
      d="M18.4 19.6l2.4 2.4 4.6-5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* The page. */}
    <rect
      x="44"
      y="2"
      width="30"
      height="34"
      rx="4"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path
      d="M50 10h16M50 15h18M50 20h12"
      stroke="var(--hero-soft)"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    {/* The pencil, writing the next line. */}
    <g transform="rotate(-40 80 22)">
      <rect x="66" y="19" width="22" height="6" rx="1.5" fill="var(--hero-accent)" />
      <path d="M66 19l-5 3 5 3Z" fill="var(--hero-soft)" />
      <rect x="84" y="19" width="4" height="6" rx="1" fill="var(--hero-wash)" />
    </g>
    {/* The sparkle. */}
    <path
      className={HERO_MOTION.float}
      d="M88 1l1.4 3.2 3.2 1.4-3.2 1.4L88 10.2l-1.4-3.2-3.2-1.4 3.2-1.4Z"
      fill="var(--hero-accent)"
    />
  </svg>
);

export const aiEditingHeroArt: HeroArt = {
  name: 'ai-editing',
  glyph: SHIELD_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};

// The cards' pictures share a page: a sheet with three lines of writing.
const PAPER = 'fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600';
const LINES = 'stroke-slate-200 dark:stroke-slate-600';
const ACCENT_ON = 'fill-brand-600 dark:fill-brand-400';
const ACCENT_OFF = 'fill-slate-400 dark:fill-slate-500';

function Page({ on }: { on: boolean }) {
  return (
    <>
      <rect x="7.5" y="4.5" width="24" height="31" rx="3.5" className={PAPER} strokeWidth="1" />
      <path
        d="M12.5 12h14M12.5 17h12M12.5 22h9"
        className={on ? 'stroke-brand-200 dark:stroke-brand-500/50' : LINES}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  );
}

function Pencil({ on }: { on: boolean }) {
  return (
    <g transform="rotate(-45 34 27)">
      <rect
        x="27"
        y="24.5"
        width="16"
        height="5"
        rx="1.25"
        className={on ? ACCENT_ON : ACCENT_OFF}
      />
      <path d="M27 24.5l-4 2.5 4 2.5Z" className="fill-amber-200 dark:fill-amber-300/80" />
      <rect
        x="40"
        y="24.5"
        width="3"
        height="5"
        rx="0.75"
        className="fill-rose-300 dark:fill-rose-400/80"
      />
    </g>
  );
}

/** Suggest Edits Only: a page and a speech bubble holding a suggestion. */
function SuggestPicture({ on }: { on: boolean }) {
  return (
    <>
      <Page on={on} />
      <path
        d="M25 20.5h15a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1-3.5 3.5h-8.5l-4 3.5v-3.5h-2.5a3.5 3.5 0 0 1-3.5-3.5v-6a3.5 3.5 0 0 1 3.5-3.5Z"
        className={on ? ACCENT_ON : ACCENT_OFF}
      />
      <g className="fill-white dark:fill-slate-900">
        <circle cx="27.5" cy="27" r="1.5" />
        <circle cx="32.5" cy="27" r="1.5" />
        <circle cx="37.5" cy="27" r="1.5" />
      </g>
    </>
  );
}

/** Edit Unverified Pages: a page with an empty tick ring, and a pencil. */
function UnverifiedPicture({ on }: { on: boolean }) {
  return (
    <>
      <Page on={on} />
      <circle
        cx="36"
        cy="10"
        r="6"
        className="fill-white stroke-slate-400 dark:fill-slate-900 dark:stroke-slate-500"
        strokeWidth="1.5"
        strokeDasharray="2.6 2"
      />
      <Pencil on={on} />
    </>
  );
}

/** Edit Any Page: a page with a filled tick, a pencil and a sparkle. */
function AnyPicture({ on }: { on: boolean }) {
  return (
    <>
      <Page on={on} />
      <circle cx="36" cy="10" r="6.5" className="fill-emerald-500 dark:fill-emerald-400" />
      <path
        d="M33.2 10.2l1.9 1.9 3.8-4"
        fill="none"
        className="stroke-white dark:stroke-slate-900"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Pencil on={on} />
      <path
        d="M6 26.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z"
        className={on ? 'fill-amber-400' : 'fill-slate-300 dark:fill-slate-600'}
      />
    </>
  );
}

const PICTURES: Record<AiEditing, (props: { on: boolean }) => React.JSX.Element> = {
  suggest: SuggestPicture,
  unverified: UnverifiedPicture,
  any: AnyPicture,
};

/** A level's picture, 48 x 40, decorative. */
export function AiEditingPicture({ level, on }: { level: AiEditing; on: boolean }) {
  const Picture = PICTURES[level];
  return (
    <svg
      aria-hidden
      focusable="false"
      width="48"
      height="40"
      viewBox="0 0 48 40"
      data-ai-editing-picture={level}
    >
      <Picture on={on} />
    </svg>
  );
}
