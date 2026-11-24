// The meeting dialogs' hero art (liveworkspace/docs/specs/004-index/item-calls.md; livehuddle's Wrap Up and every app's
// Meetings): a call about an item. Dots fade in from the title's side; in the bottom right three people sit round a
// page, the item the call was about, and in front, in the accent, a speech bubble rises from them twice, motion
// allowing: what was said, going on to the summary. The title mark is a video camera.
// Every app's Meetings and livehuddle's Wrap Up use it, so it lives here (@liveworkspace/ui/dialog-hero-art/meeting).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A video camera, in the accent. */
export const MEETING_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2.5" y="5.5" width="10.5" height="9" rx="2" />
    <path d="M13 9l4.5-2.5v7L13 11" />
  </g>
);

// The people round the page: their heads' centres.
const PEOPLE = [14, 34, 78];

const PIECES = (
  <>
    <svg
      {...HERO_SVG}
      width="96"
      height="34"
      viewBox="0 0 96 34"
      className={`${HERO_PLACE.bottomRight} overflow-visible`}
    >
      {/* The page the call is about, behind the people. */}
      <rect
        x="46"
        y="10"
        width="22"
        height="24"
        rx="3"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <path
        d="M50.5 17h13M50.5 21h9M50.5 25h11"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      {PEOPLE.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="22" r="4" fill="var(--hero-wash)" stroke="var(--hero-line)" />
          <path
            d={`M${cx - 7} 34a7 6 0 0 1 14 0`}
            fill="var(--hero-plate)"
            stroke="var(--hero-line)"
          />
        </g>
      ))}
      <g className={HERO_MOTION.float}>
        <path
          d="M22 2h18a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-11l-4 3.5V15h-3a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z"
          fill="var(--hero-accent)"
        />
        <path
          d="M25 7h12M25 10.5h8"
          stroke="var(--hero-plate)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  </>
);

export const meetingHeroArt: HeroArt = {
  name: 'meeting',
  glyph: MEETING_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
