import { avatarTone, teamInitials } from '@/lib/teams';

// A team's tile on the join landing. Accounts keep no pictures, so a team is its initials in a rounded tile, in a
// tone of its own (lib/teams.ts avatarTone).

const TEAM_SIZES = {
  md: 'size-12 rounded-2xl text-base',
  lg: 'size-16 rounded-3xl text-xl sm:size-20 sm:text-2xl',
};

export function TeamAvatar({
  id,
  name,
  size = 'md',
}: {
  id: string;
  name: string;
  size?: keyof typeof TEAM_SIZES;
}) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-semibold tracking-tight text-white shadow-sm shadow-slate-900/10 ${TEAM_SIZES[size]} ${avatarTone(id)}`}
    >
      <span className="text-optical-centre">{teamInitials(name)}</span>
    </span>
  );
}
