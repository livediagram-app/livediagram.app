import type { Member } from '@/lib/account-api';
import { avatarTone, memberInitials, memberLabel, teamInitials } from '@/lib/teams';

// The teams pages' avatars. Accounts keep no pictures, so a person is their initials in a disc and a
// team its initials in a rounded tile, each in a tone of its own (lib/teams.ts avatarTone).

// A ring in the colour of what the disc sits on, so overlapping discs part cleanly.
const RINGS = {
  card: 'ring-2 ring-white dark:ring-slate-900',
  page: 'ring-2 ring-slate-50 dark:ring-slate-950',
};
type Surface = keyof typeof RINGS;

// What a disc needs to know about a person: a team member, or one of the first few on a team's card.
type Person = Pick<Member, 'id' | 'name' | 'email'> & { status?: Member['status'] };

const PERSON_SIZES = {
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-xs',
  lg: 'size-10 text-sm',
};

export function PersonAvatar({
  member,
  size = 'md',
  ring,
}: {
  member: Person;
  size?: keyof typeof PERSON_SIZES;
  ring?: Surface;
}) {
  // Someone who hasn't joined (invited, or turned it down) is drawn as an outline.
  const invited = (member.status ?? 'joined') !== 'joined';
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${PERSON_SIZES[size]} ${
        ring ? RINGS[ring] : ''
      } ${
        invited
          ? 'border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
          : `bg-gradient-to-br text-white ${avatarTone(member.id)}`
      }`}
    >
      <span className="text-optical-centre">{memberInitials(member)}</span>
    </span>
  );
}

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

// Up to `max` people, overlapping by a little, each ringed in the colour beneath (`surface`) so the
// discs part cleanly and every set of initials still reads; then "+N" for the rest. `total` is the
// team's full count, which can be more than the members passed in.
export function AvatarStack({
  members,
  total,
  max = 4,
  surface = 'card',
}: {
  members: Person[];
  total: number;
  max?: number;
  surface?: Surface;
}) {
  const shown = members.slice(0, max);
  const rest = Math.max(0, total - shown.length);
  return (
    <span className="flex items-center -space-x-1">
      <span className="sr-only">{members.map(memberLabel).join(', ')}</span>
      {shown.map((member) => (
        <PersonAvatar key={member.id} member={member} size="sm" ring={surface} />
      ))}
      {rest > 0 && (
        <span
          aria-hidden
          className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${RINGS[surface]}`}
        >
          <span className="text-optical-centre">+{rest}</span>
        </span>
      )}
    </span>
  );
}
