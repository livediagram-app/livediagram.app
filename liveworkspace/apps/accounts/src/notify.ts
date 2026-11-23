// What an app's notification emails need from accounts (liveworkspace/docs/specs/003-accounts/accounts.md "Notification
// emails"), beside the addresses (account-apps.ts `verifiedEmails`): whether each person has turned an
// email off, read for many people at once, and the people in a team, which an app checks a mention or
// an assignment against before it writes to anyone.
import type { SettingsApp } from './settings.ts';

// The most people one settings read names, and the most switches.
export const MAX_NOTIFY_OWNERS = 100;
export const MAX_NOTIFY_KEYS = 8;
// Only the notification switches may be read this way: a read for many people is for deciding who
// gets an email, never a way to read anyone's other settings.
const NOTIFY_KEY = /^notify[A-Za-z]{1,58}$/;

export function isNotifyKey(value: unknown): value is string {
  return typeof value === 'string' && NOTIFY_KEY.test(value);
}

// A switch as stored: true, false, or anything else JSON holds.
type Stored = boolean | number | string | null;
export type NotifySettings = Record<
  string,
  { all: Record<string, Stored>; app: Record<string, Stored> }
>;

// Each owner's stored values of these switches, in `all` and the app's scope, in one query on the
// primary key (owner, scope). An owner with none of them stored is left out, and so is a key nobody
// set: the switches are opt-out, so missing reads as on.
export async function readNotifySettings(
  db: D1Database,
  owners: readonly string[],
  app: SettingsApp,
  keys: readonly string[],
): Promise<NotifySettings> {
  const out: NotifySettings = {};
  if (owners.length === 0 || keys.length === 0) return out;
  const { results } = await db
    .prepare(
      `SELECT s.owner_id, s.scope, p.key, p.type, p.atom
       FROM settings s, json_each(s.prefs) p
       WHERE s.owner_id IN (SELECT value FROM json_each(?1)) AND s.scope IN ('all', ?2)
         AND p.key IN (SELECT value FROM json_each(?3))`,
    )
    .bind(JSON.stringify([...new Set(owners)]), app, JSON.stringify([...new Set(keys)]))
    .all<{ owner_id: string; scope: string; key: string; type: string; atom: Stored }>();
  for (const row of results) {
    const value: Stored = row.type === 'true' ? true : row.type === 'false' ? false : row.atom;
    const entry = (out[row.owner_id] ??= { all: {}, app: {} });
    entry[row.scope === 'all' ? 'all' : 'app'][row.key] = value;
  }
  return out;
}

export interface TeamPerson {
  // The membership row: the key for someone invited who has no account yet.
  id: string;
  userId: string | null;
  email: string;
  // Their display name (profile, then account name); null for an invitation not yet answered.
  name: string | null;
  role: 'admin' | 'member';
  status: 'invited' | 'joined';
  // A joined person's presence colour (Settings › Profile); null for Automatic or an invitation. The apps paint their
  // assignee picker and dots in it, as their cursor is.
  color: string | null;
}

// A live team's name and the people in it who are, or may become, members: joined and invited, never
// a declined, expired or removed row. Null when there is no such team. Two reads in one batch.
export async function teamPeople(
  db: D1Database,
  teamId: string,
): Promise<{ team: { id: string; name: string }; members: TeamPerson[] } | null> {
  const [team, members] = await db.batch<Record<string, unknown>>([
    db.prepare('SELECT id, name FROM team WHERE id = ? AND deletedAt IS NULL').bind(teamId),
    db
      .prepare(
        `SELECT m.id, m.userId, m.email, COALESCE(p.name, NULLIF(u.name, '')) AS name, m.role, m.status,
                CASE WHEN m.status = 'joined' THEN p.color END AS color
         FROM team_member m
         LEFT JOIN "user" u ON u.id = m.userId
         LEFT JOIN profile p ON p.owner_id = m.userId
         WHERE m.teamId = ? AND m.status IN ('invited', 'joined')
         ORDER BY CASE m.status WHEN 'joined' THEN 0 ELSE 1 END, m.email`,
      )
      .bind(teamId),
  ]);
  const found = team?.results[0] as { id: string; name: string } | undefined;
  if (!found) return null;
  return {
    team: { id: found.id, name: found.name },
    members: (members?.results ?? []) as unknown as TeamPerson[],
  };
}

// The most teams one member-count read names.
export const MAX_MEMBER_COUNT_TEAMS = 50;

// How many people have joined each of these teams, for a caller that shows several teams at once (the subscription
// service's "what would this team pay"): one statement on the team's own index however many teams. A team that is
// deleted, or was never one, is left out.
export async function teamMemberCounts(
  db: D1Database,
  teamIds: readonly string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (teamIds.length === 0) return counts;
  const { results } = await db
    .prepare(
      `SELECT t.id, COUNT(m.id) AS members
       FROM team t LEFT JOIN team_member m ON m.teamId = t.id AND m.status = 'joined'
       WHERE t.id IN (SELECT value FROM json_each(?)) AND t.deletedAt IS NULL
       GROUP BY t.id`,
    )
    .bind(JSON.stringify([...new Set(teamIds)]))
    .all<{ id: string; members: number }>();
  for (const row of results) counts[row.id] = row.members;
  return counts;
}
