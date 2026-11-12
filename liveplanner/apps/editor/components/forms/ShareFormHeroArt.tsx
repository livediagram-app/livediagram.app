// Share Form's hero art (docs/specs/030-forms/forms.md "Publishing and the form link"), the Share dialog's cousin
// drawn for a form handed out. Rings spread from the bottom right, where a link badge, its ring spreading twice
// (motion allowing), reaches the two people who will answer; in the bottom left the form as a card, tilted, its title
// bar, two answers and a ticked box; a dashed line along the foot from the form to the link. The title mark is a form.
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
    {/* The form, tilted as if just handed out. */}
    <svg {...HERO_SVG} width="56" height="30" viewBox="0 0 56 30" className={HERO_PLACE.bottomLeft}>
      <g transform="rotate(-6 26 20)">
        <rect
          x="6"
          y="5"
          width="40"
          height="32"
          rx="5"
          fill="var(--hero-plate)"
          stroke="var(--hero-line)"
        />
        <rect x="11" y="9.5" width="20" height="3.5" rx="1.75" fill="var(--hero-mark)" />
        <rect
          x="11"
          y="16"
          width="30"
          height="5"
          rx="2"
          fill="var(--hero-soft)"
          stroke="var(--hero-faint)"
        />
        <rect x="11" y="24" width="5.5" height="5.5" rx="1.5" fill="var(--hero-mark)" />
        <path
          d="M12.4 26.8l1.2 1.1 1.8-2.1"
          fill="none"
          stroke="var(--hero-plate)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="19.5" y="25.5" width="16" height="2.5" rx="1.25" fill="var(--hero-line)" />
      </g>
    </svg>
    {/* From the form to its link, along the foot, fading in and out. */}
    <span className="absolute bottom-[9px] left-[4.5rem] right-[5.5rem] h-[1.5px] bg-[linear-gradient(90deg,var(--hero-mark)_0_3px,transparent_3px_7px)] bg-[length:7px_1.5px] [mask-image:linear-gradient(90deg,transparent,black_18%,black_82%,transparent)] opacity-70 max-sm:hidden" />
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
