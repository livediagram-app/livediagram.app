import type { Member, TeamRole } from './account-api';
import { initials } from './initials';

// The teams pages' plain logic (liveworkspace/docs/site.md "Your account"): where a team lives, who
// is in it, and what the person looking at it may do. Kept out of the components so it is tested
// on its own.

export const TEAMS_PATH = '/account/teams';

// The site is a static export, so every team page is one file, exported at this placeholder id.
// `public/_redirects` serves it for any /account/teams/<id>, and the page reads the real id from the
// address.
export const TEAM_PAGE_PLACEHOLDER = 'team';

export function teamPath(id: string): string {
  return `${TEAMS_PATH}/${encodeURIComponent(id)}`;
}

// The team id in an address such as /account/teams/abc (a trailing slash allowed), or null when the
// address names no team (the list itself, or the placeholder opened directly).
export function teamIdFromPath(pathname: string): string | null {
  const match = /^\/account\/teams\/([^/]+)\/?$/.exec(pathname);
  if (!match?.[1]) return null;
  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return id && id !== TEAM_PAGE_PLACEHOLDER ? id : null;
}

export function roleLabel(role: TeamRole): string {
  return role === 'admin' ? 'Admin' : 'Member';
}

export function memberCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

// An address's first part read as a name: anna.smith@… is "Anna Smith".
export function nameFromEmail(email: string): string {
  // Whatever follows a + is a tag for the inbox, not part of the name.
  const local = (email.split('@')[0] ?? '').split('+')[0] ?? '';
  const words = local.split(/[._-]+/).filter(Boolean);
  if (!words.length) return email;
  return words.map((word) => word[0]!.toUpperCase() + word.slice(1)).join(' ');
}

// What a person is called on the page: their name, or, for someone invited who has no account name
// yet, their address read as one. The address itself goes on the line beneath.
export function memberLabel(member: Pick<Member, 'name' | 'email'>): string {
  return member.name?.trim() || nameFromEmail(member.email);
}

// Initials for a member's avatar, from the same name.
export function memberInitials(member: Pick<Member, 'name' | 'email'>): string {
  return initials(memberLabel(member));
}

// A team's initials for its tile: the first letters of its first two words.
export function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('');
  return letters.toUpperCase() || '?';
}

// Joined members first (admins, then by name), then the invitations still waiting, oldest first,
// then the ones turned down or expired.
export function splitMembers(members: Member[]): {
  joined: Member[];
  invited: Member[];
  declined: Member[];
} {
  const joined = members
    .filter((m) => m.status === 'joined')
    .sort(
      (a, b) =>
        Number(b.role === 'admin') - Number(a.role === 'admin') ||
        memberLabel(a).localeCompare(memberLabel(b)),
    );
  const invited = members
    .filter((m) => m.status === 'invited')
    .sort((a, b) => a.createdAt - b.createdAt);
  const declined = members.filter((m) => m.status === 'declined');
  return { joined, invited, declined };
}

// The last-admin rule, as the server keeps it (liveworkspace/docs/accounts.md "Teams"): a team always
// keeps a joined admin. So the only one can't step down, and can't leave while anyone else is in it;
// alone, leaving deletes the team.
export function lastAdmin(joined: Member[], myMemberId: string) {
  const admins = joined.filter((m) => m.role === 'admin');
  const onlyAdmin = admins.length === 1 && admins[0]!.id === myMemberId;
  const alone = joined.length === 1 && joined[0]!.id === myMemberId;
  return { onlyAdmin, alone, canLeave: !onlyAdmin || alone };
}

// Where a join link lands on this site, and the token it carries.
export const JOIN_PATH = '/join';
export function joinTokenFrom(search: string): string | null {
  const token = new URLSearchParams(search).get('token');
  return token && /^[\w.-]{1,200}$/.test(token) ? token : null;
}

// The tones avatars are drawn in, chosen by a stable hash of the person or team, so someone keeps
// their colour wherever they appear. Literal class strings, so Tailwind generates them. Every stop
// is a 600 or deeper, so white initials pass WCAG AA on either end.
export const AVATAR_TONES = [
  'from-sky-700 to-indigo-700',
  'from-violet-600 to-purple-800',
  'from-emerald-700 to-teal-800',
  'from-rose-600 to-pink-800',
  'from-amber-700 to-orange-800',
  'from-cyan-700 to-sky-800',
  'from-fuchsia-700 to-purple-800',
  'from-indigo-600 to-slate-800',
] as const;

export function avatarTone(seed: string): (typeof AVATAR_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]!;
}

// What the person may do in a team, by their role. Admins rename it, invite, change roles, remove
// people and delete it; anyone can leave (liveworkspace/docs/accounts.md "Teams").
export function teamAbilities(myRole: TeamRole) {
  const admin = myRole === 'admin';
  return { rename: admin, invite: admin, link: admin, manage: admin, delete: admin, leave: true };
}
