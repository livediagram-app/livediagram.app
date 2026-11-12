// The Share dialog's hero art (livediagram/docs/specs/007-editor/editor-app.md "Layout, top to bottom", the header):
// sharing as a connection. Faint rings spread from the bottom right, where a pass rises from the band's edge, tilted
// as if just handed over, its link badge's ring spreading twice, the two it reaches beside it; in the bottom left the
// one sharing, ringed in the accent; and a dashed line running along the foot from them to the pass. The title mark
// is a link.
// Every modal's Share uses it, so it lives here (@liveworkspace/ui/dialog-hero-art/share).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A chain link: two loops joined, in the accent. */
export const SHARE_GLYPH = (
  <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinecap="round">
    <path d="M8.2 11.8l3.6-3.6" />
    <path d="M9.4 5.4l1.4-1.4a3.5 3.5 0 0 1 5 5l-1.4 1.4" />
    <path d="M10.6 14.6l-1.4 1.4a3.5 3.5 0 0 1-5-5l1.4-1.4" />
  </g>
);

// A person seen from the front, rising from the bottom edge: a head over shoulders.
function person(x: number, fill: string, ring = 'none') {
  return (
    <g>
      <path d={`M${x - 10} 31a10 10 0 0 1 20 0Z`} fill={fill} />
      <circle cx={x} cy="11" r="5.5" fill={fill} stroke={ring} strokeWidth="1.5" />
    </g>
  );
}

const PIECES = (
  <>
    {/* The one sharing, ringed in the accent. */}
    <svg {...HERO_SVG} width="40" height="28" viewBox="0 0 40 28" className={HERO_PLACE.bottomLeft}>
      {person(20, 'var(--hero-line)', 'var(--hero-accent)')}
    </svg>
    {/* What joins them: a dashed line along the foot, from the one sharing to the pass, fading out at each end. */}
    <span className="absolute bottom-[9px] left-[3.5rem] max-sm:hidden right-[7rem] h-[1.5px] bg-[linear-gradient(90deg,var(--hero-mark)_0_3px,transparent_3px_7px)] bg-[length:7px_1.5px] [mask-image:linear-gradient(90deg,transparent,black_18%,black_82%,transparent)] opacity-70" />
    {/* The pass, tilted as if just handed over (its link badge, a perforation, two lines of what it holds), and the
        two it reaches. */}
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      className={HERO_PLACE.bottomRight}
    >
      {person(84, 'var(--hero-soft)')}
      {person(70, 'var(--hero-wash)')}
      <g transform="rotate(-7 32 20)">
        <rect
          x="4"
          y="5"
          width="56"
          height="32"
          rx="6"
          fill="var(--hero-plate)"
          stroke="var(--hero-line)"
        />
        <path d="M25 8v26" stroke="var(--hero-line)" strokeDasharray="2 2.5" />
        <circle cx="25" cy="5" r="2.5" fill="var(--hero-paper)" />
        <circle
          cx="14.5"
          cy="16"
          r="6.5"
          fill="none"
          stroke="var(--hero-accent)"
          strokeWidth="1.25"
          className={HERO_MOTION.ring}
        />
        <circle cx="14.5" cy="16" r="6.5" fill="var(--hero-accent)" />
        <path
          d="M13.4 17.1l2.2-2.2M14.1 13.6l.7-.7a1.6 1.6 0 0 1 2.3 2.3l-.7.7M14.9 18.4l-.7.7a1.6 1.6 0 0 1-2.3-2.3l.7-.7"
          fill="none"
          stroke="var(--hero-plate)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <rect x="31" y="12" width="21" height="3.5" rx="1.75" fill="var(--hero-mark)" />
        <rect x="31" y="19" width="14" height="3" rx="1.5" fill="var(--hero-line)" />
      </g>
    </svg>
  </>
);

export const shareHeroArt: HeroArt = {
  name: 'share',
  glyph: SHARE_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
