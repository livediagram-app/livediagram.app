// The team's last-admin rule as the member list applies it (docs/specs/013-workspace/teams.md): a
// team always keeps at least one joined Admin. It mirrors the server's guard (apps/api
// db/teams.ts KEEPS_AN_ADMIN) exactly, so the pane never offers an action the api would refuse,
// nor hides one it would allow. An invited row promoted to admin has not accepted the team, so it
// neither counts as the remaining admin nor is pinned itself.

import type { TeamMember } from '@/lib/api-client';

export function lastAdminPinner(members: readonly TeamMember[]): (m: TeamMember) => boolean {
  const joinedAdmins = members.filter((m) => m.role === 'admin' && m.status === 'joined').length;
  return (m) => m.role === 'admin' && m.status === 'joined' && joinedAdmins <= 1;
}
