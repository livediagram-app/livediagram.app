// What the join and decline landings need (liveworkspace/docs/site.md "Joining and declining"): where a team and
// the invitations are in the Explorer, the token a join link carries, and a team's tile. Teams themselves are made
// and run in the Explorer (@liveworkspace/explorer; liveworkspace/docs/one-explorer.md "Teams are run in the
// Explorer").

/** The Explorer's Invites, where invitations are answered and teams made. */
export const INVITES_PATH = '/explorer/invites';

/** A team's view in the Explorer. */
export function teamPath(id: string): string {
  return `/explorer/team?id=${encodeURIComponent(id)}`;
}

export function memberCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
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

// Where a join link lands on this site, and the token it carries.
export const JOIN_PATH = '/join';
export function joinTokenFrom(search: string): string | null {
  const token = new URLSearchParams(search).get('token');
  return token && /^[\w.-]{1,200}$/.test(token) ? token : null;
}

// The tones a team's tile is drawn in, chosen by a stable hash of the team, so it keeps its colour. Literal class
// strings, so Tailwind generates them. Every stop is a 600 or deeper, so white initials pass WCAG AA on either end.
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
