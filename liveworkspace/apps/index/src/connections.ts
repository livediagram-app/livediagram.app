// Connected tabs on the index (liveworkspace/docs/specs/004-index/connected-tabs.md, its blueprint): making one with
// its pass (and its pair both ways), where one leads, and taking one back whose tab never reached its host. The
// host's grant (X-Index-Grant) says who may; the pass's code is handed out only here, one open at a time.

import {
  CONNECTIONS_PER_ITEM,
  connectionDefaultLevel,
  connectionLevels,
  isConnectionId,
  ITEM_GRANT_HEADER,
  itemConnectedTabsPath,
  levelAtLeast,
  readConnectionInput,
  SHARE_LINKS_PER_ITEM,
  type App,
  type ConnectedTabWrite,
  type ConnectionMade,
  type ConnectionOpen,
  type Level,
  type TabConnection,
} from '@liveworkspace/index-client';
import { previewItemPath, previewSharePath } from '@liveworkspace/media';
import { accessTo, loadItem } from './access';
import { callAppForJson } from './app-calls';
import type { Caller, Person } from './auth';
import { generateShareCode, isPartId } from './codec';
import { CONNECTION_OPEN_RETRY_AFTER_S, CONNECTION_REVERSE_TIMEOUT_MS } from './config';
import {
  connectionHref,
  dropStatements,
  newConnectionId,
  tellPassesRevoked,
  type DropRow,
} from './connection-rows';
import type { RouteContext } from './context';
import type { Env } from './env';
import {
  badRequest,
  conflict,
  forbidden,
  json,
  noContent,
  notFound,
  readObject,
  unauthorized,
} from './http';
import { tellApp } from './notices';
import { verifyOwnGrant, type OwnGrant } from './own-grants';
import { directAccess, getItemRow, type ItemRow } from './rows';
import { guessVisitorOf } from './share-guesses';
import { eventStatements } from './timeline';

// An app acting for a person (an API token's, the Drive mirror, the data export): agents read connected tabs, never
// make or open them.
const isDelegate = (person: Person | null): boolean =>
  Boolean(person?.app || person?.drive || person?.export);

// A pass: an ordinary share link on the target, never expiring, not public, every tab. Inserted only while the target
// has room for another link and the host for another connection.
function insertPass(
  db: D1Database,
  pass: { code: string; itemId: string; level: Level; hostId: string; at: number },
  only?: { sql: string; args: unknown[] },
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO share_links (code, item_id, level, tab_id, expiry, expires_at, created_at, public)
       SELECT ?, ?, ?, NULL, 'never', NULL, ?, 0
       WHERE (SELECT COUNT(*) FROM share_links WHERE item_id = ?) < ?
         AND (SELECT COUNT(*) FROM connections WHERE host_item_id = ?) < ?${only ? ` AND ${only.sql}` : ''}`,
    )
    .bind(
      pass.code,
      pass.itemId,
      pass.level,
      pass.at,
      pass.itemId,
      SHARE_LINKS_PER_ITEM,
      pass.hostId,
      CONNECTIONS_PER_ITEM,
      ...(only?.args ?? []),
    );
}

function insertConnection(
  db: D1Database,
  row: {
    id: string;
    hostId: string;
    tabId: string | null;
    targetId: string;
    code: string;
    pairId: string | null;
    at: number;
  },
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO connections (id, host_item_id, host_tab_id, target_item_id, share_code, pair_id, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM share_links WHERE code = ?)`,
    )
    .bind(row.id, row.hostId, row.tabId, row.targetId, row.code, row.pairId, row.at, row.code);
}

const sharedEvent = (
  db: D1Database,
  itemId: string,
  actorId: string,
  level: Level,
  at: number,
  connectionId: string,
) =>
  eventStatements(db, {
    itemId,
    type: 'shared',
    actorId,
    detail: { level },
    at,
    when: { sql: 'EXISTS (SELECT 1 FROM connections WHERE id = ?)', args: [connectionId] },
  });

// POST /items/:id/connections (the host's id), with the person's token and the host's grant.
export async function makeConnection(ctx: RouteContext, hostId: string): Promise<Response> {
  const { request, env, caller } = ctx;
  if (request.method !== 'POST') return notFound();
  const person = caller.person;
  if (!person) return unauthorized();
  if (isDelegate(person)) return forbidden();
  const input = readConnectionInput(await readObject(request));
  if (!input) return badRequest();
  if (input.targetId === hostId) return badRequest('connection_self');

  const [grant, host] = await Promise.all([
    verifyOwnGrant(env, request.headers.get(ITEM_GRANT_HEADER)),
    getItemRow(env, hostId),
  ]);
  if (
    !grant ||
    grant.item !== hostId ||
    grant.sub !== person.id ||
    !levelAtLeast(grant.level, 'edit') ||
    (grant.tab !== null && grant.tab !== input.tabId) ||
    (host && grant.app !== host.app)
  ) {
    return forbidden();
  }
  if (!host || host.trashed_at !== null || host.archived_at !== null) return notFound();

  // The target: live, and the person may share it (its owner or a joined member of its team).
  const self: Caller = { person, share: null };
  const loaded = await loadItem(env, input.targetId, self, 'edit', { manage: true });
  if (loaded instanceof Response) return loaded;
  const target = loaded.row;
  if (target.trashed_at !== null || target.archived_at !== null) return notFound();
  const level = input.level ?? connectionDefaultLevel(target.app);
  if (!connectionLevels(target.app).includes(level)) return badRequest('level_not_offered');
  // Both ways shares the host too, so the person must manage it.
  if (input.both) {
    const hostAccess = await accessTo(env, host, self);
    if (hostAccess instanceof Response || hostAccess.via === 'link') return forbidden();
  }

  const db = env.INDEX_DB;
  const now = Date.now();
  // Connect Again (IDX25): whatever this tab held goes, with its pass.
  const { results: replaced } = await db
    .prepare(
      `SELECT c.id, c.share_code, c.target_item_id, t.app AS target_app FROM connections c
       LEFT JOIN items t ON t.id = c.target_item_id
       WHERE c.host_item_id = ? AND c.host_tab_id = ? LIMIT ?`,
    )
    .bind(hostId, input.tabId, CONNECTIONS_PER_ITEM)
    .all<DropRow>();

  const id = newConnectionId();
  const code = generateShareCode();
  const statements: D1PreparedStatement[] = replaced.length > 0 ? dropStatements(db, replaced) : [];
  const forwardAt = statements.length + 1;
  statements.push(
    insertPass(db, { code, itemId: target.id, level, hostId, at: now }),
    insertConnection(db, {
      id,
      hostId,
      tabId: input.tabId,
      targetId: target.id,
      code,
      pairId: null,
      at: now,
    }),
    ...sharedEvent(db, target.id, person.id, level, now, id),
  );
  // Both ways: the reverse pass on the host at the same role (or the host app's default when it offers no such
  // role), its row in the target without a tab yet, and the pair joined. Each only when the step before it wrote.
  const reverse = input.both
    ? {
        id: newConnectionId(),
        code: generateShareCode(),
        level: connectionLevels(host.app).includes(level)
          ? level
          : connectionDefaultLevel(host.app),
      }
    : null;
  let reverseAt = -1;
  if (reverse) {
    reverseAt = statements.length + 1;
    statements.push(
      insertPass(
        db,
        { code: reverse.code, itemId: host.id, level: reverse.level, hostId: target.id, at: now },
        { sql: 'EXISTS (SELECT 1 FROM connections WHERE id = ?)', args: [id] },
      ),
      insertConnection(db, {
        id: reverse.id,
        hostId: target.id,
        tabId: null,
        targetId: host.id,
        code: reverse.code,
        pairId: id,
        at: now,
      }),
      db
        .prepare(
          'UPDATE connections SET pair_id = ? WHERE id = ? AND EXISTS (SELECT 1 FROM connections WHERE id = ?)',
        )
        .bind(reverse.id, id, reverse.id),
    );
  }
  const results = await db.batch(statements);
  if (replaced.length > 0) ctx.waitUntil(tellPassesRevoked(env, replaced));

  if (results[forwardAt]!.meta.changes === 0) {
    const full = await db
      .prepare('SELECT COUNT(*) AS n FROM connections WHERE host_item_id = ?')
      .bind(hostId)
      .first<{ n: number }>();
    return conflict(
      (full?.n ?? 0) >= CONNECTIONS_PER_ITEM ? 'connection_limit' : 'share_link_limit',
    );
  }
  tellApp(ctx.waitUntil, env, target, { type: 'shared', actorId: person.id });

  const made: ConnectionMade = {
    connection: { id, app: target.app, itemId: target.id },
    name: target.title,
    level,
    reverse: null,
  };
  if (reverse) {
    const written = results[reverseAt]!.meta.changes > 0;
    made.reverse = written
      ? await writeReverse(ctx, person, host, target, reverse)
      : { state: 'unreached' };
  }
  return json(made, { status: 201 });
}

// The reverse tab, through the target app's internal door. Made: the reverse row learns its tab and stands confirmed.
// Not made: the reverse row and its pass are taken back; the host's own connection stands.
async function writeReverse(
  ctx: RouteContext,
  person: Person,
  host: ItemRow,
  target: ItemRow,
  reverse: { id: string; code: string; level: Level },
): Promise<ConnectionMade['reverse']> {
  const { env } = ctx;
  const db = env.INDEX_DB;
  const connection: TabConnection = { id: reverse.id, app: host.app, itemId: host.id };
  const write: ConnectedTabWrite = { name: host.title, connection };
  const res = await callAppForJson(
    env,
    target.app,
    itemConnectedTabsPath(target.id),
    write,
    CONNECTION_REVERSE_TIMEOUT_MS,
  );
  const tabId = res.ok ? res.body.tabId : undefined;
  if (isPartId(tabId)) {
    const now = Date.now();
    await db.batch([
      db
        .prepare('UPDATE connections SET host_tab_id = ?, confirmed_at = ? WHERE id = ?')
        .bind(tabId, now, reverse.id),
      ...sharedEvent(db, host.id, person.id, reverse.level, now, reverse.id),
    ]);
    tellApp(ctx.waitUntil, env, host, { type: 'shared', actorId: person.id });
    return { state: 'made', connection, tabId };
  }
  console.warn('[index] reverse connected tab not made', {
    app: target.app,
    error: res.ok ? 'invalid_tab' : res.error,
  });
  await db.batch(
    dropStatements(db, [
      { id: reverse.id, share_code: reverse.code, target_item_id: host.id, target_app: host.app },
    ]),
  );
  return { state: 'unreached' };
}

type OpenRow = {
  host_item_id: string;
  host_tab_id: string | null;
  host_app: App;
  confirmed_at: number | null;
  target_item_id: string | null;
  target_app: App | null;
  target_title: string | null;
  target_updated_at: number | null;
  owner_id: string | null;
  team_id: string | null;
  trashed_at: number | null;
  archived_at: number | null;
  share_code: string | null;
  pass_level: Level | null;
  pass_expires_at: number | null;
  grant_link_public: number | null;
};

// The connection a grant may reach: the grant's item and app are the connection's host, its tab (when scoped) the
// connection's tab, and it did not come through a public link. Anything else reads as an unknown id.
async function reachable(
  env: Env,
  id: string,
  grant: OwnGrant | null,
  need: Level,
): Promise<OpenRow | null> {
  if (!grant || !isConnectionId(id) || !levelAtLeast(grant.level, need)) return null;
  const row = await env.INDEX_DB.prepare(
    `SELECT c.host_item_id, c.host_tab_id, h.app AS host_app, c.confirmed_at, c.target_item_id,
       t.app AS target_app, t.title AS target_title, t.updated_at AS target_updated_at, t.owner_id, t.team_id, t.trashed_at, t.archived_at, c.share_code,
       sl.level AS pass_level, sl.expires_at AS pass_expires_at, gl.public AS grant_link_public
     FROM connections c
     JOIN items h ON h.id = c.host_item_id
     LEFT JOIN items t ON t.id = c.target_item_id
     LEFT JOIN share_links sl ON sl.code = c.share_code
     LEFT JOIN share_links gl ON gl.code = ? AND gl.item_id = c.host_item_id
     WHERE c.id = ?`,
  )
    .bind(grant.link ?? '', id)
    .first<OpenRow>();
  if (!row || row.host_item_id !== grant.item || row.host_app !== grant.app) return null;
  if (grant.tab !== null && grant.tab !== row.host_tab_id) return null;
  if (grant.link && row.grant_link_public === 1) return null;
  return row;
}

// Over CONNECTION_OPEN_LIMITER: per person, else per network; no key, no limit.
async function openRefusal(env: Env, caller: Caller, request: Request): Promise<Response | null> {
  const key = caller.person ? `p:${caller.person.id}` : guessVisitorOf(request, env);
  if (!key || !env.CONNECTION_OPEN_LIMITER) return null;
  const { success } = await env.CONNECTION_OPEN_LIMITER.limit({ key });
  if (success) return null;
  return json(
    { error: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(CONNECTION_OPEN_RETRY_AFTER_S) } },
  );
}

// GET and DELETE /connections/:id, with the host's grant.
export async function handleConnection(ctx: RouteContext, id: string): Promise<Response> {
  const { request, env, caller } = ctx;
  if (isDelegate(caller.person)) return notFound();
  const grantText = request.headers.get(ITEM_GRANT_HEADER);
  if (request.method === 'GET') {
    const refused = await openRefusal(env, caller, request);
    if (refused) return refused;
    const row = await reachable(env, id, await verifyOwnGrant(env, grantText), 'view');
    if (!row) return notFound();
    return openAnswer(env, caller.person, row);
  }
  if (request.method === 'DELETE') {
    const row = await reachable(env, id, await verifyOwnGrant(env, grantText), 'edit');
    if (!row) return notFound();
    // A confirmed connection goes by removing its tab, through the host app (connection-doors.ts).
    if (row.confirmed_at !== null) return noContent();
    const db = env.INDEX_DB;
    const drop: DropRow = {
      id,
      share_code: row.share_code,
      target_item_id: row.target_item_id,
      target_app: row.target_app,
    };
    await db.batch([
      ...dropStatements(db, [drop]),
      ...(row.share_code && row.target_item_id
        ? eventStatements(db, {
            itemId: row.target_item_id,
            type: 'unshared',
            actorId: caller.person?.id ?? null,
            at: Date.now(),
          })
        : []),
    ]);
    ctx.waitUntil(tellPassesRevoked(env, [drop]));
    return noContent();
  }
  return notFound();
}

function openAnswer(env: Env, person: Person | null, row: OpenRow): Response {
  if (
    row.target_item_id === null ||
    row.target_app === null ||
    row.trashed_at !== null ||
    row.archived_at != null
  ) {
    return json({ error: 'connection_target_gone' }, { status: 410 });
  }
  const app = row.target_app;
  // The target is there, so its title and owner are too.
  const base = { app, itemId: row.target_item_id, name: row.target_title! };
  // Its owner, or a joined member of its team, goes to it directly.
  const direct = directAccess({ owner_id: row.owner_id!, team_id: row.team_id } as ItemRow, person);
  if (direct) {
    const open: ConnectionOpen = {
      ...base,
      href: connectionHref(env, app, 'item', row.target_item_id),
      via: 'item',
      level: null,
      // The reader's own picture of it, fetched with their Bearer (IDX38).
      preview: previewItemPath(row.target_item_id, row.target_updated_at ?? undefined),
    };
    return json(open);
  }
  const lapsed = row.pass_expires_at !== null && row.pass_expires_at <= Date.now();
  if (!row.share_code || !row.pass_level || lapsed) {
    return json({ error: 'connection_link_removed' }, { status: 410 });
  }
  const open: ConnectionOpen = {
    ...base,
    href: connectionHref(env, app, 'link', row.share_code),
    via: 'link',
    level: row.pass_level,
    // The pass's live image: the code is its only credential, so an <img> or a bare fetch draws it (IDX38).
    preview: previewSharePath(row.share_code, 'image.svg'),
  };
  return json(open);
}
