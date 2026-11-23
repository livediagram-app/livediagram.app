// The Checklist dialog's hero art (each product's docs/specs/009-elements/checklist.md "The Checklist dialog"): a
// checklist's rows, ticked off. Faint dots fade in from the title's side; in the bottom right a list rises from the
// edge, three rows of a box and a line, the first two ticked and struck through, the third's box in the accent,
// its ring spreading twice: the one being done. The title mark is a ticked box over a line.
// Every app's Checklist dialog draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/checklist).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

const ROWS = [
  { y: 11, line: 30, done: true },
  { y: 21, line: 22, done: true },
  { y: 31, line: 34, done: false },
];

const PIECES = (
  <svg {...HERO_SVG} width="76" height="30" viewBox="0 0 76 30" className={HERO_PLACE.bottomRight}>
    <rect
      x="1"
      y="1"
      width="74"
      height="40"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {ROWS.map(({ y, line, done }) => (
      <g key={y}>
        {done ? (
          <>
            <rect x="8" y={y - 3.5} width="7" height="7" rx="2" fill="var(--hero-mark)" />
            <path
              d={`M9.8 ${y}l1.5 1.5 2.6-3`}
              fill="none"
              stroke="var(--hero-plate)"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="20"
              y={y - 1.5}
              width={line}
              height="3"
              rx="1.5"
              fill="var(--hero-mark)"
              opacity="0.45"
            />
          </>
        ) : (
          <>
            <circle
              cx="11.5"
              cy={y}
              r="6"
              fill="none"
              stroke="var(--hero-accent)"
              strokeWidth="1.25"
              className={HERO_MOTION.ring}
            />
            <rect
              x="8"
              y={y - 3.5}
              width="7"
              height="7"
              rx="2"
              fill="var(--hero-plate)"
              stroke="var(--hero-accent)"
              strokeWidth="1.5"
            />
            <rect x="20" y={y - 1.5} width={line} height="3" rx="1.5" fill="var(--hero-mark)" />
          </>
        )}
      </g>
    ))}
  </svg>
);

export const checklistHeroArt: HeroArt = {
  name: 'checklist',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3.5" width="6" height="6" rx="1.5" />
      <path d="M4.6 6.6l1.1 1.1 1.9-2.2" strokeWidth="1.4" />
      <path d="M12 6.5h5" />
      <rect x="3" y="11.5" width="6" height="6" rx="1.5" />
      <path d="M12 14.5h5" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
