// A member's request for Pro for Teams (subscription.md "Ask an Admin"): kept here, one row per member, team and UTC
// day, and shown to the team's admins in Settings, under the team. Nothing is sent anywhere and no address is kept:
// an admin reads who asked (by the name accounts shows the team), why and their note the next time they open
// Subscription.

import {
  dayKey,
  isLimitKey,
  TEAM_REQUESTS_KEPT_MS,
  TEAM_REQUESTS_SHOWN,
  type LimitKey,
  type OwnerScope,
  type TeamRequestResponse,
  type TeamRequests,
} from '@liveworkspace/subscription';

/** The longest name kept with a request. */
const NAME_MAX = 120;

/**
 * Records that `account` asked `team`'s admins today, or answers when they already had: one statement that writes
 * only when today's row is not there, so two presses at once are one request.
 */
export async function recordTeamRequest(
  db: D1Database,
  request: {
    team: OwnerScope;
    account: string;
    name: string | null;
    limit: LimitKey | null;
    note: string | null;
  },
  now: number,
): Promise<TeamRequestResponse> {
  const day = dayKey(now);
  const written = await db
    .prepare(
      `INSERT INTO team_requests (team, account, day, name, limit_key, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (team, account, day) DO NOTHING RETURNING created_at`,
    )
    .bind(
      request.team,
      request.account,
      day,
      request.name?.slice(0, NAME_MAX) ?? null,
      request.limit,
      request.note,
      now,
    )
    .first<{ created_at: number }>();
  if (written) return { sent: true, askedAt: written.created_at };
  const held = await db
    .prepare('SELECT created_at FROM team_requests WHERE team = ? AND account = ? AND day = ?')
    .bind(request.team, request.account, day)
    .first<{ created_at: number }>();
  return { sent: false, askedAt: held?.created_at ?? now };
}

/** The statement that forgets a team's requests: it has subscribed, so they are answered. For the paying batch. */
export function clearTeamRequests(db: D1Database, team: OwnerScope): D1PreparedStatement {
  return db.prepare('DELETE FROM team_requests WHERE team = ?').bind(team);
}

/** Each member's newest request of several teams (`marks`: one `?` a team), the newest few a team, all counted.
 *  The bare columns beside MAX(created_at) are that newest row's: SQLite's rule for a lone MAX. */
export const requestsOfTeams = (marks: string) => `SELECT team, name, limit_key, note, at, n FROM (
    SELECT team, name, limit_key, note, at, COUNT(*) OVER (PARTITION BY team) AS n,
           ROW_NUMBER() OVER (PARTITION BY team ORDER BY at DESC) AS rank
    FROM (SELECT team, account, name, limit_key, note, MAX(created_at) AS at FROM team_requests
          WHERE team IN (${marks}) AND created_at > ? GROUP BY team, account))
  WHERE rank <= ? ORDER BY team, at DESC`;

/** One account's request today in each of several teams. */
export const ownRequests = (marks: string) =>
  `SELECT team, created_at AS at FROM team_requests WHERE team IN (${marks}) AND account = ? AND day = ?`;

type Asked = {
  team: OwnerScope;
  name: string | null;
  limit_key: string | null;
  note: string | null;
  at: number;
  n: number;
};

export type TeamRequestsRead = {
  /** By team: how many members asked lately, and the newest few. A team nobody asked is absent. */
  byTeam: Map<OwnerScope, TeamRequests>;
  /** By team: when `account` themself asked today. */
  mine: Map<OwnerScope, number>;
};

/** Whose requests `/me` reads: the teams the caller is an admin of, and the ones they are a member of. */
export type RequestTeams = { admin: readonly OwnerScope[]; member: readonly OwnerScope[] };

/**
 * The two statements `/me` reads requests with, for its one batch: for the teams the caller is an admin of, each
 * member's newest request of the last thirty days (the newest few named, all counted); for the others, the caller's
 * own request today. Each starts from the table's primary key. None when the caller is in no team.
 */
export function teamRequestStatements(
  db: D1Database,
  account: string,
  teams: RequestTeams,
  now: number,
): D1PreparedStatement[] {
  if (teams.admin.length === 0 && teams.member.length === 0) return [];
  // `IN ()` with nobody in it reads nothing.
  const marks = (owners: readonly OwnerScope[]) => owners.map(() => '?').join(', ');
  return [
    db
      .prepare(requestsOfTeams(marks(teams.admin)))
      .bind(...teams.admin, now - TEAM_REQUESTS_KEPT_MS, TEAM_REQUESTS_SHOWN),
    db.prepare(ownRequests(marks(teams.member))).bind(...teams.member, account, dayKey(now)),
  ];
}

/** What `teamRequestStatements` answered, by team. */
export function teamRequestsFrom(results: readonly D1Result[]): TeamRequestsRead {
  const read: TeamRequestsRead = { byTeam: new Map(), mine: new Map() };
  const [asked, mine] = results;
  for (const row of (asked?.results ?? []) as Asked[]) {
    let requests = read.byTeam.get(row.team);
    if (!requests) read.byTeam.set(row.team, (requests = { count: row.n, latest: [] }));
    requests.latest.push({
      name: row.name,
      limit: isLimitKey(row.limit_key) ? row.limit_key : null,
      note: row.note,
      at: row.at,
    });
  }
  for (const row of (mine?.results ?? []) as { team: OwnerScope; at: number }[])
    read.mine.set(row.team, row.at);
  return read;
}
