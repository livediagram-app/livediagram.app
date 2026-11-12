// The Collaborators dialog's hero art (each app's docs/specs/012-collaboration/collaborator-enhancements.md): the
// people in the room. The canvas's own dots fade in from the title's side; in the bottom left a cursor glides in on a
// dashed trail, its name tag beside it; in the bottom right the presence stack rises from the edge, three avatars
// overlapping, the front one in the accent with its presence ring spreading twice, and another cursor pointing at it.
// The title mark is two people.
// Every app's Collaborators draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/collaborators).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** Two people, one in front of the other, in the accent. */
export const COLLABORATORS_GLYPH = (
  <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="7.5" cy="7" r="3" />
    <path d="M2 17a5.5 5.5 0 0 1 11 0" />
    <path d="M12.5 4.4a2.8 2.8 0 1 1 0 5.2M15 12.2a5 5 0 0 1 3 4.8" />
  </g>
);

// A pointer cursor with its tip at (x, y), in the stroke's ink, outlined in the plate so it lifts off whatever it
// crosses.
function cursor(x: number, y: number, fill: string) {
  return (
    <path
      d={`M${x} ${y}v13l3.4-3.3 2.4 5.4 2.5-1.1-2.4-5.3h4.8Z`}
      fill={fill}
      stroke="var(--hero-plate)"
      strokeWidth="1.25"
      strokeLinejoin="round"
    />
  );
}

// An avatar in the presence stack: a disc in its own shade, a person on it in the plate, an outline in the plate so
// the next one overlaps it cleanly.
function avatar(cx: number, fill: string) {
  return (
    <g>
      <circle cx={cx} cy="18" r="10" fill={fill} stroke="var(--hero-plate)" strokeWidth="2" />
      <circle cx={cx} cy="15" r="3" fill="var(--hero-plate)" />
      <path d={`M${cx - 5.5} 24.5a5.5 5 0 0 1 11 0Z`} fill="var(--hero-plate)" />
    </g>
  );
}

const PIECES = (
  <>
    {/* A cursor gliding in on its dashed trail, its name tag beside it. */}
    <svg {...HERO_SVG} width="72" height="30" viewBox="0 0 72 30" className={HERO_PLACE.bottomLeft}>
      <path
        d="M4 30C10 22 18 16 30 13"
        fill="none"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeDasharray="2.5 3.5"
        strokeLinecap="round"
      />
      {cursor(33, 8, 'var(--hero-mark)')}
      <rect x="46" y="17" width="24" height="10" rx="5" fill="var(--hero-wash)" />
      <rect x="51" y="20.75" width="14" height="2.5" rx="1.25" fill="var(--hero-mark)" />
    </svg>
    {/* The presence stack: three avatars overlapping, the front one in the accent, its ring spreading, and a cursor
        pointing at it. */}
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      className={HERO_PLACE.bottomRight}
    >
      {avatar(60, 'var(--hero-wash)')}
      {avatar(44, 'var(--hero-line)')}
      <circle
        cx="28"
        cy="18"
        r="11"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.5"
        className={HERO_MOTION.ring}
      />
      {avatar(28, 'var(--hero-accent)')}
      {cursor(76, 6, 'var(--hero-mark)')}
    </svg>
  </>
);

export const collaboratorsHeroArt: HeroArt = {
  name: 'collaborators',
  glyph: COLLABORATORS_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
