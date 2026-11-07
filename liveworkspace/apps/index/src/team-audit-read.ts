// The team audit log's read (liveworkspace/docs/specs/004-index/team-audit-log.md "Who reads it"): a team's admins
// alone, checked against accounts on each request; never a member, a guest, an app or the Drive mirror acting for
// someone, nor a token's hour-old claim.
//
//   GET /team-audit?team=&person=&kind=&from=&to=&limit=&cursor=   {events, nextCursor}, newest first
//   GET /team-audit?team=&…&format=csv                              a CSV file of up to TEAM_AUDIT_CSV_MAX rows;
//                                                                   X-Next-Cursor names where the next one starts
//
// Each read is one index range (team_audit_time, _actor or _type, by the filters given), keyset-paged on
// (occurred_at, id). People are named by accounts now, so a member who has left is still named.

import { toCsv } from '@liveworkspace/api-kit/csv';
import {
  isTeamAuditEventType,
  TEAM_AUDIT_CSV_MAX,
  TEAM_AUDIT_EVENT_LABELS,
  TEAM_AUDIT_LIMIT_MAX,
  TEAM_AUDIT_NEXT_CURSOR_HEADER,
  TEAM_AUDIT_PAGE,
  type TeamAuditEvent,
  type TeamAuditEventType,
  type TeamAuditPerson,
  type TimelineApp,
} from '@liveworkspace/index-client';
import { decodeCursor, encodeCursor, isId, type Cursor } from './codec';
import type { PersonContext } from './context';
import type { Env } from './env';
import { badRequest, fail, forbidden, json, notFound } from './http';
import {
  accountsAdminTeams,
  accountsPeopleNames,
  type AdminTeams,
  type PeopleNames,
} from './webhooks/access';

export type TeamAuditDeps = { adminTeams: AdminTeams; names: PeopleNames };

const defaultDeps = (env: Env): TeamAuditDeps => ({
  adminTeams: accountsAdminTeams(env),
  names: accountsPeopleNames(env),
});

// A CSV file is read this many rows a query, so no one answer from D1 is the whole file.
export const CSV_READ_CHUNK = 2_000;

// The anonymised id a closed account's rows carry (account-purge.ts): nobody to name.
const ANONYMISED = 'deleted';

export type TeamAuditFilter = {
  team: string;
  person?: string;
  kind?: TeamAuditEventType;
  from?: number;
  to?: number;
};

type Row = {
  id: string;
  type: TeamAuditEventType;
  app: TimelineApp;
  actor_id: string | null;
  actor_name: string | null;
  subject_id: string | null;
  item_id: string | null;
  title: string;
  detail: string | null;
  occurred_at: number;
};

// A time in milliseconds as the query sends it: digits only, a safe integer.
function readTime(text: string | null): number | undefined | null {
  if (text === null || text === '') return undefined;
  if (!/^\d{1,16}$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

/** The SQL and arguments of one page: the filters, the cursor, newest first. Exported for the plan test. */
export function pageQuery(
  filter: TeamAuditFilter,
  cursor: Cursor | undefined,
  limit: number,
): { sql: string; args: (string | number)[] } {
  const where = ['team_id = ?'];
  const args: (string | number)[] = [filter.team];
  if (filter.person !== undefined) {
    where.push('actor_id = ?');
    args.push(filter.person);
  }
  if (filter.kind !== undefined) {
    where.push('type = ?');
    args.push(filter.kind);
  }
  if (filter.from !== undefined) {
    where.push('occurred_at >= ?');
    args.push(filter.from);
  }
  if (filter.to !== undefined) {
    where.push('occurred_at < ?');
    args.push(filter.to);
  }
  if (cursor) {
    where.push('(occurred_at < ? OR (occurred_at = ? AND id < ?))');
    args.push(cursor.at, cursor.at, cursor.id);
  }
  args.push(limit + 1);
  return {
    sql: `SELECT id, type, app, actor_id, actor_name, subject_id, item_id, title, detail, occurred_at
          FROM team_audit_events WHERE ${where.join(' AND ')}
          ORDER BY occurred_at DESC, id DESC LIMIT ?`,
    args,
  };
}

async function readPage(
  env: Env,
  filter: TeamAuditFilter,
  cursor: Cursor | undefined,
  limit: number,
): Promise<{ rows: Row[]; next: Cursor | null }> {
  const { sql, args } = pageQuery(filter, cursor, limit);
  const { results } = await env.INDEX_DB.prepare(sql)
    .bind(...args)
    .all<Row>();
  const rows = results.slice(0, limit);
  const last = rows[rows.length - 1];
  return {
    rows,
    next: results.length > limit && last ? { at: last.occurred_at, id: last.id } : null,
  };
}

function parseDetail(text: string | null): Record<string, string | null> | null {
  if (text === null) return null;
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, string | null>)
      : null;
  } catch {
    return null;
  }
}

// The people a page names (who did it and whom it is about), but the anonymised.
const namedIds = (rows: readonly Row[]) => [
  ...new Set(
    rows
      .flatMap((r) => [r.actor_id, r.subject_id])
      .filter((id): id is string => !!id && id !== ANONYMISED),
  ),
];

// A person as accounts names them now; else the name the event carried; none for a closed account.
function personOf(
  id: string | null,
  names: ReadonlyMap<string, string> | null,
  carried: string | null | undefined,
): TeamAuditPerson | null {
  if (id === null) return null;
  if (id === ANONYMISED) return { id, name: null };
  return { id, name: names?.get(id) ?? carried ?? null };
}

export function eventOf(row: Row, names: ReadonlyMap<string, string> | null): TeamAuditEvent {
  const detail = parseDetail(row.detail);
  return {
    id: row.id,
    type: row.type,
    app: row.app,
    actor: personOf(row.actor_id, names, row.actor_name),
    subject: personOf(row.subject_id, names, detail?.memberName),
    itemId: row.item_id,
    title: row.title,
    detail,
    occurredAt: row.occurred_at,
  };
}

const CSV_HEADER = [
  'Time (UTC)',
  'Event',
  'Kind',
  'App',
  'By',
  'By ID',
  'About',
  'About ID',
  'Name',
  'Document ID',
  'Detail',
];

// The detail as `key=value; …`, without what the About columns already say.
const detailText = (detail: TeamAuditEvent['detail']) =>
  Object.entries(detail ?? {})
    .filter(([key, value]) => value !== null && key !== 'personId' && key !== 'memberName')
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');

export function csvRow(event: TeamAuditEvent): string[] {
  return [
    new Date(event.occurredAt).toISOString(),
    TEAM_AUDIT_EVENT_LABELS[event.type],
    event.type,
    event.app,
    event.actor?.name ?? '',
    event.actor?.id ?? '',
    event.subject?.name ?? '',
    event.subject?.id ?? '',
    event.title,
    event.itemId ?? '',
    detailText(event.detail),
  ];
}

// Reads the query: the filter, the cursor and the page size, or the refusal.
function readQuery(
  url: URL,
): { filter: TeamAuditFilter; cursor: Cursor | undefined; limit: number; csv: boolean } | Response {
  const params = url.searchParams;
  const team = params.get('team');
  if (!isId(team)) return badRequest('invalid_query');
  const filter: TeamAuditFilter = { team };
  const person = params.get('person');
  if (person !== null && person !== '') {
    if (!isId(person)) return badRequest('invalid_query');
    filter.person = person;
  }
  const kind = params.get('kind');
  if (kind !== null && kind !== '') {
    if (!isTeamAuditEventType(kind)) return badRequest('invalid_query');
    filter.kind = kind;
  }
  const from = readTime(params.get('from'));
  const to = readTime(params.get('to'));
  if (from === null || to === null) return badRequest('invalid_query');
  if (from !== undefined) filter.from = from;
  if (to !== undefined) filter.to = to;
  const format = params.get('format');
  if (format !== null && format !== '' && format !== 'json' && format !== 'csv') {
    return badRequest('invalid_query');
  }
  const limitText = params.get('limit');
  const limit = limitText === null || limitText === '' ? TEAM_AUDIT_PAGE : Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > TEAM_AUDIT_LIMIT_MAX) {
    return badRequest('invalid_query');
  }
  const cursor = decodeCursor(params.get('cursor'));
  if (cursor === null) return badRequest('invalid_cursor');
  return { filter, cursor, limit, csv: format === 'csv' };
}

export async function handleTeamAudit(
  ctx: PersonContext,
  deps: TeamAuditDeps = defaultDeps(ctx.env),
): Promise<Response> {
  const { request, env, url, segments, person } = ctx;
  if (segments.length !== 1 || request.method !== 'GET') return notFound();
  const query = readQuery(url);
  if (query instanceof Response) return query;
  // An account's own session only, and an admin of the team now.
  if (person.kind !== 'account' || person.app || person.drive || person.export) {
    return forbidden('not_team_admin');
  }
  const admins = await deps.adminTeams(person.id);
  if (!admins) return fail(503, 'team_audit_unavailable');
  if (!admins.has(query.filter.team)) return forbidden('not_team_admin');

  if (!query.csv) {
    const { rows, next } = await readPage(env, query.filter, query.cursor, query.limit);
    const names = rows.length > 0 ? await deps.names(namedIds(rows)) : null;
    return json({
      events: rows.map((r) => eventOf(r, names)),
      nextCursor: next ? encodeCursor(next) : null,
    });
  }

  const rows: Row[] = [];
  let cursor = query.cursor;
  let next: Cursor | null = null;
  do {
    const chunk = Math.min(CSV_READ_CHUNK, TEAM_AUDIT_CSV_MAX - rows.length);
    const page = await readPage(env, query.filter, cursor, chunk);
    rows.push(...page.rows);
    next = page.next;
    cursor = next ?? undefined;
  } while (next && rows.length < TEAM_AUDIT_CSV_MAX);
  const names = rows.length > 0 ? await deps.names(namedIds(rows)) : null;
  const csv = toCsv([CSV_HEADER, ...rows.map((r) => csvRow(eventOf(r, names)))]);
  const day = new Date().toISOString().slice(0, 10);
  const headers = new Headers({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="team-activity-${day}.csv"`,
    'Cache-Control': 'private, no-store',
  });
  if (next) headers.set(TEAM_AUDIT_NEXT_CURSOR_HEADER, encodeCursor(next));
  // A byte-order mark, so a spreadsheet reads the names as UTF-8.
  return new Response(`\uFEFF${csv}`, { headers });
}
