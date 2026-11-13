// Invite by Link's hero art (liveworkspace/docs/specs/004-index/one-explorer.md "Teams are run in the Explorer"): the
// team dialogs' drawing (team.tsx), people gathered and one welcomed in, the newcomer's badge a
// link rather than a plus: they came in by it.
import type { HeroArt } from '../hero-art';
import { teamHeroArt, teamPieces } from './team';

// A chain link, small, on the newcomer's badge at (38.5, 8).
const LINK_BADGE = (
  <path
    d="M37.6 8.9l1.8-1.8M38.2 6.3l.5-.5a1.25 1.25 0 0 1 1.8 1.8l-.5.5M38.8 9.7l-.5.5a1.25 1.25 0 0 1-1.8-1.8l.5-.5"
    fill="none"
    stroke="var(--hero-plate)"
    strokeWidth="1.1"
    strokeLinecap="round"
  />
);

export const teamInviteHeroArt: HeroArt = {
  name: 'team-invite',
  glyph: teamHeroArt.glyph,
  texture: teamHeroArt.texture,
  pieces: teamPieces(LINK_BADGE),
};
