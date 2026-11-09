// The change feed the apps follow (teams.ts).

import type { MemberStatus, TeamRole } from './shared.ts';

// The change feed the apps keep their copies in step with: every team and member row written after
// the cursor, oldest first. A cursor is "rev:id" for each table, so rows that share a rev (one
// statement touching several) are never skipped at a page boundary.
export interface TeamChange {
  id: string;
  name: string;
  organisation: string | null;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
}
export interface MemberChange {
  id: string;
  teamId: string;
  userId: string | null;
  email: string;
  role: TeamRole;
  status: MemberStatus;
  createdAt: number;
  updatedAt: number;
}
export interface TeamChanges {
  teams: TeamChange[];
  members: MemberChange[];
  cursor: string;
  // More rows wait after this page.
  more: boolean;
}

interface Position {
  rev: number;
  id: string;
}

const START: Position = { rev: 0, id: '' };

function parsePosition(value: string | undefined): Position {
  const match = value?.match(/^(\d+):(.*)$/);
  return match ? { rev: Number(match[1]), id: match[2] ?? '' } : START;
}

export function parseCursor(cursor: string | null): { teams: Position; members: Position } {
  const [teams, members] = (cursor ?? '').split(',');
  return { teams: parsePosition(teams), members: parsePosition(members) };
}

const formatCursor = (teams: Position, members: Position) =>
  `${teams.rev}:${teams.id},${members.rev}:${members.id}`;

export const CHANGES_PAGE_SIZE = 500;

export async function teamChanges(
  db: D1Database,
  cursor: string | null,
  limit = CHANGES_PAGE_SIZE,
): Promise<TeamChanges> {
  const after = parseCursor(cursor);
  const [teamRows, memberRows] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT id, name, organisation, deletedAt, createdAt, updatedAt, rev FROM team
         WHERE rev > ? OR (rev = ? AND id > ?) ORDER BY rev, id LIMIT ?`,
      )
      .bind(after.teams.rev, after.teams.rev, after.teams.id, limit),
    db
      .prepare(
        `SELECT id, teamId, userId, email, role, status, createdAt, updatedAt, rev FROM team_member
         WHERE rev > ? OR (rev = ? AND id > ?) ORDER BY rev, id LIMIT ?`,
      )
      .bind(after.members.rev, after.members.rev, after.members.id, limit),
  ]);
  const teams = (teamRows?.results ?? []) as unknown as (TeamChange & {
    deletedAt: number | null;
    rev: number;
  })[];
  const members = (memberRows?.results ?? []) as unknown as (MemberChange & { rev: number })[];
  const lastTeam = teams.at(-1);
  const lastMember = members.at(-1);
  return {
    teams: teams.map(({ id, name, organisation, deletedAt, createdAt, updatedAt }) => ({
      id,
      name,
      organisation,
      deleted: deletedAt !== null,
      createdAt,
      updatedAt,
    })),
    members: members.map(({ rev: _rev, ...member }) => member),
    cursor: formatCursor(
      lastTeam ? { rev: lastTeam.rev, id: lastTeam.id } : after.teams,
      lastMember ? { rev: lastMember.rev, id: lastMember.id } : after.members,
    ),
    more: teams.length === limit || members.length === limit,
  };
}
