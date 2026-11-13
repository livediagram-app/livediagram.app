// The History dialog's hero art (livediagram/docs/specs/013-workspace/history.md "The dialog", every app's alike):
// an item's record over time. The baseline grid fades in from the title's side, a ruled ledger; in the bottom right a timeline of versions, each
// pinned up from the edge, the newest solid at its end, and a dashed arrow arching back from it to an earlier one,
// the one brought back, in the accent, its ring spreading twice, motion allowing. The title mark is a clock turning
// back. Every app's History is the Explorer's one dialog, so it lives here (@liveworkspace/ui/dialog-hero-art/history).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A clock with an arrow turning back round it, in the accent. */
export const HISTORY_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 10a7 7 0 1 0 2.05-4.95L3 7.1" />
    <path d="M3 3.25V7.1h3.85M10 6.25V10l2.75 1.6" />
  </g>
);

// The timeline's versions along it, oldest first; the second is the one brought back.
const VERSIONS = [12, 50, 69];
const RESTORED = 31;
const NEWEST = 88;
const LINE_Y = 18;

const PIECES = (
  <>
    {/* The timeline: versions pinned up from the edge, the newest at its end, an arrow arching back to the one
        restored. */}
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      className={HERO_PLACE.bottomRight}
    >
      <path
        d={`M2 ${LINE_Y}H${NEWEST}`}
        stroke="var(--hero-line)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {[...VERSIONS, RESTORED, NEWEST].map((x) => (
        <path key={x} d={`M${x} 30V${LINE_Y}`} stroke="var(--hero-faint)" strokeWidth="1.5" />
      ))}
      {VERSIONS.map((x) => (
        <circle
          key={x}
          cx={x}
          cy={LINE_Y}
          r="3"
          fill="var(--hero-plate)"
          stroke="var(--hero-mark)"
          strokeWidth="1.25"
        />
      ))}
      <circle cx={NEWEST} cy={LINE_Y} r="3.75" fill="var(--hero-mark)" />
      <path
        d={`M${NEWEST - 2} ${LINE_Y - 6}C${NEWEST - 10} 1 ${RESTORED + 12} 1 ${RESTORED + 3} ${LINE_Y - 7}`}
        fill="none"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeDasharray="3 3"
        strokeLinecap="round"
      />
      <path
        d={`M${RESTORED + 3.5} ${LINE_Y - 10.75}L${RESTORED + 3} ${LINE_Y - 6.75}l3.9-.85`}
        fill="none"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={RESTORED}
        cy={LINE_Y}
        r="5"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.25"
        className={HERO_MOTION.ring}
      />
      <circle cx={RESTORED} cy={LINE_Y} r="5" fill="var(--hero-accent)" />
      <path
        d={`M${RESTORED - 2.25} ${LINE_Y}l1.5 1.5 3-3`}
        fill="none"
        stroke="var(--hero-plate)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </>
);

// The baseline grid, faded in from the title's side as the dots and grids are, so the words sit on plain paper.
const BASELINE = heroTexture('baseline');
const TEXTURE = {
  backgroundImage: `linear-gradient(90deg, var(--hero-paper) 0 34%, transparent 72%), ${BASELINE.backgroundImage}`,
  backgroundPosition: `0 0, ${BASELINE.backgroundPosition}`,
};

export const historyHeroArt: HeroArt = {
  name: 'history',
  glyph: HISTORY_GLYPH,
  texture: TEXTURE,
  pieces: PIECES,
};
