// The team dialogs' hero art (liveworkspace/docs/specs/004-index/one-explorer.md "Teams are run in the Explorer"):
// a team as people gathered, one being welcomed in. Rings spread from the bottom right, where three stand together and
// a fourth, ringed in the accent with a badge on their shoulder, has just joined them, their ring spreading twice. The
// title's side stays plain paper. The title mark is two people, one in
// front. Members, New Team and Edit Team draw it with a plus; Invite by Link (team-invite.tsx) with a link.
// The Explorer's team dialogs, in every app, so it lives here (@liveworkspace/ui/dialog-hero-art/team).
import type { ReactNode } from 'react';
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** Two people, one in front: the front one solid, the one behind drawn in outline. */
export const TEAM_GLYPH = (
  <g fill="var(--hero-accent)">
    <path
      d="M12.6 3.6a2.9 2.9 0 1 1 0 5.8M14.6 11.2c2.3.6 3.9 2.6 3.9 5.3"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="7.6" cy="6.6" r="3.3" />
    <path d="M1.4 17.2c0-3.6 2.8-6 6.2-6s6.2 2.4 6.2 6Z" />
  </g>
);

// A person seen from the front, rising from the bottom edge: a head over shoulders. `big` is the one in the middle.
function person(x: number, fill: string, { big = false, ring = 'none' } = {}): ReactNode {
  const s = big ? 11 : 9.5;
  const head = big ? 6 : 5.25;
  const cy = big ? 10 : 12;
  return (
    <g>
      <path d={`M${x - s} 31a${s} ${s} 0 0 1 ${s * 2} 0Z`} fill={fill} />
      <circle cx={x} cy={cy} r={head} fill={fill} stroke={ring} strokeWidth="1.5" />
    </g>
  );
}

/** The newcomer's badge: a plus. */
export const TEAM_PLUS = (
  <path d="M38.5 5.5v5M36 8h5" stroke="var(--hero-plate)" strokeWidth="1.4" strokeLinecap="round" />
);

/** The pieces, the newcomer's badge given: the people gathered. */
export function teamPieces(badge: ReactNode): ReactNode {
  return (
    <>
      <svg
        {...HERO_SVG}
        width="96"
        height="30"
        viewBox="0 0 96 30"
        overflow="visible"
        className={HERO_PLACE.bottomRight}
      >
        {person(62, 'var(--hero-wash)')}
        {person(88, 'var(--hero-wash)')}
        {person(75, 'var(--hero-line)', { big: true })}
        {/* The newcomer, ringed in the accent, their ring spreading as they are welcomed. */}
        <circle
          cx="32"
          cy="12"
          r="5.25"
          fill="none"
          stroke="var(--hero-accent)"
          strokeWidth="1.25"
          className={HERO_MOTION.ring}
        />
        {person(32, 'var(--hero-mark)', { ring: 'var(--hero-accent)' })}
        <circle cx="38.5" cy="8" r="4.5" fill="var(--hero-accent)" />
        {badge}
      </svg>
    </>
  );
}

export const teamHeroArt: HeroArt = {
  name: 'team',
  glyph: TEAM_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: teamPieces(TEAM_PLUS),
};
