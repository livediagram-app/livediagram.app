// Share Form's hero art (docs/specs/030-forms/forms.md "Publishing and the form link"), the Share dialog's cousin
// drawn for a form handed out. Rings spread from the bottom right, where a link badge, its ring spreading twice
// (motion allowing), reaches the two people who will answer. The title's side stays plain paper. The title mark is
// a form.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** A form: a card of lines, the first answer ticked. */
const FORM_GLYPH = (
  <g fill="none" stroke="var(--hero-accent)" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="2.5" width="13" height="15" rx="2.75" strokeWidth="1.6" />
    <path d="M6.5 7.25l1.25 1.25 2-2.25M11.75 7.5h2M6.75 12h7" strokeWidth="1.4" />
  </g>
);

// A person seen from the front, rising from the bottom edge: a head over shoulders.
function person(x: number, fill: string) {
  return (
    <g>
      <path d={`M${x - 9.5} 31a9.5 9.5 0 0 1 19 0Z`} fill={fill} />
      <circle cx={x} cy="12" r="5.25" fill={fill} />
    </g>
  );
}

const PIECES = (
  <>
    {/* The link, and the two it reaches. */}
    <svg
      {...HERO_SVG}
      width="72"
      height="30"
      viewBox="0 0 72 30"
      overflow="visible"
      className={HERO_PLACE.bottomRight}
    >
      {person(62, 'var(--hero-soft)')}
      {person(46, 'var(--hero-wash)')}
      <circle
        cx="16"
        cy="21"
        r="7"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.25"
        className={HERO_MOTION.ring}
      />
      <circle cx="16" cy="21" r="7" fill="var(--hero-accent)" />
      <path
        d="M14.8 22.2l2.4-2.4M15.6 18.4l.7-.7a1.7 1.7 0 0 1 2.4 2.4l-.7.7M16.4 23.6l-.7.7a1.7 1.7 0 0 1-2.4-2.4l.7-.7"
        fill="none"
        stroke="var(--hero-plate)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  </>
);

export const shareFormHeroArt: HeroArt = {
  name: 'share-form',
  glyph: FORM_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
