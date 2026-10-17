// The name a timeline bubble shows for a member (docs/specs/013-workspace/timeline.md §4.4). Mirrors what the
// Explorer's team pane renders: the display name where the invite email gives us one, else nothing (the
// renderer falls back to "A member"). Never the full address: a timeline event travels to everyone in the
// team, and an invite address is not theirs to read.
export function memberDisplayName(member: {
  email: string | null;
  name?: string | null;
}): string | null {
  if (member.name) return member.name;
  const local = member.email?.split('@')[0];
  if (!local) return null;
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
