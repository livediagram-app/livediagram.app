// Sharing (liveworkspace/docs/one-explorer-contracts.md "Sharing and access"): share links, the share
// password, what a link opens, and Shared with me. Managing links needs the item's owner or a joined
// member of its team. Revoking a link also tells the item at once, so its holders are dropped.

import {
  DEFAULT_LINK_LEVEL,
  isApp,
  isLevel,
  SHARE_LINK_EXPIRIES,
  SHARE_LINK_EXPIRY_MS,
  SHARE_LINKS_PER_ITEM,
  SHARE_PASSWORD_HEADER,
  SHARE_PASSWORD_MAX,
  type Level,
  type ShareLink,
  type ShareLinkExpiry,
} from '@liveworkspace/index-client';
import { linkAccess, loadItem } from './access';
import { callApp } from './app-calls';
import { scopesOf } from './auth';
import {
  decodeCursor,
  encodeCursor,
  generateShareCode,
  isId,
  isShareCode,
  parseLimit,
} from './codec';
import type { PersonContext, RouteContext } from './context';
import type { Env } from './env';
import { badRequest, conflict, json, noContent, notFound, readObject } from './http';
import { parseListFilters, sharedWithUpsert } from './items';
import { filterClauses } from './lists';
import { firstVisitStatement, tellApp, wasFirstVisit } from './notices';
import { hashSharePassword } from './password-hash';
import { expiringEventId, expiringStatements } from './share-expiry';
import { eventStatements } from './timeline';
import {
  decorate,
  directAccess,
  getItemRow,
  ITEM_COLUMNS,
  LIVE_LINK,
  type Access,
  type ItemRow,
} from './rows';

type LinkRow = {
  code: string;
  item_id: string;
  level: Level;
  tab_id: string | null;
  expiry: ShareLinkExpiry;
  expires_at: number | null;
  created_at: number;
  public: number;
};

const toLink = (row: LinkRow): ShareLink => ({
  code: row.code,
  itemId: row.item_id,
  level: row.level,
  tabId: row.tab_id,
  expiry: row.expiry,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  public: row.public === 1,
});

const LINK_COLUMNS = 'code, item_id, level, tab_id, expiry, expires_at, created_at, public';

// undefined: absent; null: every tab; a string: that tab. INVALID for anything else.
const INVALID = Symbol('invalid');
function readTab(value: unknown): string | null | undefined | typeof INVALID {
  if (value === undefined || value === null) return value;
  return isId(value) ? value : INVALID;
}

// The app ends the sessions a link admitted: at once when it is revoked, and when it is rescoped (another level or
// tab), so its visitors reload into what the link now opens rather than keep the old reach until their grant lapses.
function tellRevoked(
  ctx: RouteContext,
  row: ItemRow,
  codes: string[],
  reason: 'revoked' | 'rescoped' = 'revoked',
) {
  if (codes.length === 0) return;
  ctx.waitUntil(
    callApp(ctx.env, row.app, 'POST', `/items/${encodeURIComponent(row.id)}/revoke`, {
      codes,
      ...(reason === 'rescoped' ? { reason } : {}),
    }).then((res) => {
      if (!res.ok) console.warn('[index] revoke not delivered', { app: row.app, error: res.error });
    }),
  );
}

async function getLink(env: Env, code: string): Promise<LinkRow | null> {
  return env.INDEX_DB.prepare(`SELECT ${LINK_COLUMNS} FROM share_links WHERE code = ?`)
    .bind(code)
    .first<LinkRow>();
}

// /items/:id/share and /items/:id/share-password.
export async function handleItemShare(ctx: RouteContext, id: string): Promise<Response> {
  const { request, env, segments, caller } = ctx;
  const loaded = await loadItem(env, id, caller, 'edit', { manage: true });
  if (loaded instanceof Response) return loaded;
  const { row } = loaded;
  const db = env.INDEX_DB;
  const method = request.method;

  if (segments[2] === 'share-password') {
    if (method !== 'PUT') return notFound();
    const body = await readObject(request);
    if (!body) return badRequest();
    const password = body.password ?? null;
    if (
      password !== null &&
      (typeof password !== 'string' || password.length > SHARE_PASSWORD_MAX)
    ) {
      return badRequest('invalid_password');
    }
    // Whitespace only clears it, so a stray space can't lock an item in a way its owner can't see.
    const trimmed = password?.trim() ?? '';
    if (!trimmed) {
      await db.prepare('DELETE FROM share_passwords WHERE item_id = ?').bind(id).run();
      return json({ passwordSet: false });
    }
    const hash = await hashSharePassword(trimmed);
    await db
      .prepare(
        `INSERT INTO share_passwords (item_id, hash, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (item_id) DO UPDATE SET hash = excluded.hash, updated_at = excluded.updated_at`,
      )
      .bind(id, hash, Date.now())
      .run();
    return json({ passwordSet: true });
  }

  if (method === 'GET') {
    const [links, password] = (await db.batch([
      db
        .prepare(
          `SELECT ${LINK_COLUMNS} FROM share_links WHERE item_id = ? ORDER BY created_at LIMIT ?`,
        )
        .bind(id, SHARE_LINKS_PER_ITEM),
      db.prepare('SELECT 1 AS set_ FROM share_passwords WHERE item_id = ?').bind(id),
    ])) as D1Result<Record<string, unknown>>[];
    return json({
      links: (links!.results as LinkRow[]).map(toLink),
      passwordSet: password!.results.length > 0,
    });
  }

  if (method === 'POST') {
    const body = await readObject(request);
    if (!body) return badRequest();
    if (body.level !== undefined && !isLevel(body.level)) return badRequest('invalid_level');
    const tab = readTab(body.tabId);
    if (tab === INVALID) return badRequest('invalid_tab');
    // Left out is `never`; a value that is no expiry is refused, never read as a link that lasts for ever.
    if (
      body.expiry !== undefined &&
      !(SHARE_LINK_EXPIRIES as readonly unknown[]).includes(body.expiry)
    )
      return badRequest('invalid_expiry');
    const expiry: ShareLinkExpiry = (body.expiry as ShareLinkExpiry | undefined) ?? 'never';
    const now = Date.now();
    const link: LinkRow = {
      code: generateShareCode(),
      item_id: id,
      level: (body.level as Level | undefined) ?? DEFAULT_LINK_LEVEL,
      tab_id: tab ?? null,
      expiry,
      expires_at: expiry === 'never' ? null : now + SHARE_LINK_EXPIRY_MS[expiry],
      created_at: now,
      public: body.public === true ? 1 : 0,
    };
    // The cap is checked inside the insert; the event only when it made one.
    const [res] = await db.batch([
      db
        .prepare(
          `INSERT INTO share_links (${LINK_COLUMNS}) SELECT ?, ?, ?, ?, ?, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM share_links WHERE item_id = ?) < ?`,
        )
        .bind(
          link.code,
          id,
          link.level,
          link.tab_id,
          link.expiry,
          link.expires_at,
          now,
          link.public,
          id,
          SHARE_LINKS_PER_ITEM,
        ),
      ...eventStatements(db, {
        itemId: id,
        type: 'shared',
        actorId: caller.person?.id ?? null,
        detail: { level: link.level },
        at: now,
        when: { sql: 'EXISTS (SELECT 1 FROM share_links WHERE code = ?)', args: [link.code] },
      }),
      // A link lapsing within the week warns its owner at once.
      ...(link.expires_at !== null ? expiringStatements(db, id, now) : []),
    ]);
    if (res!.meta.changes === 0) return conflict('share_link_limit');
    // The app's first-share email (notices.ts).
    if (caller.person) {
      tellApp(ctx.waitUntil, env, row, { type: 'shared', actorId: caller.person.id });
    }
    return json({ link: toLink(link) }, { status: 201 });
  }

  if (method === 'DELETE') {
    const { results } = await db
      .prepare('SELECT code FROM share_links WHERE item_id = ? LIMIT ?')
      .bind(id, SHARE_LINKS_PER_ITEM)
      .all<{ code: string }>();
    await db.batch([
      db.prepare('DELETE FROM share_links WHERE item_id = ?').bind(id),
      db.prepare('DELETE FROM shared_with WHERE item_id = ?').bind(id),
      db.prepare('DELETE FROM timeline_events WHERE id = ?').bind(expiringEventId(id)),
      ...(results.length > 0
        ? eventStatements(db, {
            itemId: id,
            type: 'unshared',
            actorId: caller.person?.id ?? null,
            at: Date.now(),
          })
        : []),
    ]);
    tellRevoked(
      ctx,
      row,
      results.map((r) => r.code),
    );
    return noContent();
  }
  return notFound();
}

// /share/:code and /share/:code/extend.
export async function handleShareCode(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, caller } = ctx;
  const code = segments[1];
  if (!isShareCode(code)) return notFound();
  const normalised = code.toUpperCase();
  const method = request.method;

  if (segments.length === 2 && method === 'GET') return resolveShare(ctx, normalised);

  // Managing a link, live or lapsed: its item's owner or team.
  const link = await getLink(env, normalised);
  if (!link) return notFound();
  const loaded = await loadItem(env, link.item_id, { person: caller.person, share: null }, 'edit', {
    manage: true,
  });
  if (loaded instanceof Response) return loaded;
  const db = env.INDEX_DB;

  if (segments.length === 2 && method === 'PATCH') {
    const body = await readObject(request);
    if (!body) return badRequest();
    if (body.level !== undefined && !isLevel(body.level)) return badRequest('invalid_level');
    const tab = readTab(body.tabId);
    if (tab === INVALID) return badRequest('invalid_tab');
    const next: LinkRow = {
      ...link,
      level: (body.level as Level | undefined) ?? link.level,
      tab_id: tab === undefined ? link.tab_id : tab,
    };
    await db
      .prepare('UPDATE share_links SET level = ?, tab_id = ? WHERE code = ?')
      .bind(next.level, next.tab_id, link.code)
      .run();
    if (next.level !== link.level || next.tab_id !== link.tab_id) {
      tellRevoked(ctx, loaded.row, [link.code], 'rescoped');
    }
    return json({ link: toLink(next) });
  }
  if (segments.length === 2 && method === 'DELETE') {
    await db.batch([
      db.prepare('DELETE FROM share_links WHERE code = ?').bind(link.code),
      db
        .prepare('DELETE FROM shared_with WHERE item_id = ? AND share_code = ?')
        .bind(link.item_id, link.code),
      ...eventStatements(db, {
        itemId: link.item_id,
        type: 'unshared',
        actorId: caller.person?.id ?? null,
        at: Date.now(),
      }),
      ...(link.expires_at !== null ? expiringStatements(db, link.item_id, Date.now()) : []),
    ]);
    tellRevoked(ctx, loaded.row, [link.code]);
    return noContent();
  }
  if (segments.length === 3 && segments[2] === 'extend' && method === 'POST') {
    // Another round of its lifetime, from now, whether it is live or lapsed.
    if (link.expiry === 'never') return badRequest('never_expires');
    const now = Date.now();
    const expiresAt = now + SHARE_LINK_EXPIRY_MS[link.expiry];
    await db.batch([
      db.prepare('UPDATE share_links SET expires_at = ? WHERE code = ?').bind(expiresAt, link.code),
      ...expiringStatements(db, link.item_id, now),
    ]);
    return json({ link: toLink({ ...link, expires_at: expiresAt }) });
  }
  return notFound();
}

// GET /share/:code, public: what a live link opens. A person who opens it finds it under Shared.
async function resolveShare(ctx: RouteContext, code: string): Promise<Response> {
  const { env, caller } = ctx;
  const link = await env.INDEX_DB.prepare(
    `SELECT sl.code, sl.item_id, sl.level, sl.tab_id, sl.public, sp.hash FROM share_links sl
     LEFT JOIN share_passwords sp ON sp.item_id = sl.item_id
     WHERE sl.code = ? AND ${LIVE_LINK('sl')}`,
  )
    .bind(code, Date.now())
    .first<{
      code: string;
      item_id: string;
      level: Level;
      tab_id: string | null;
      hash: string | null;
      public: number;
    }>();
  if (!link) return notFound();
  const row = await getItemRow(env, link.item_id);
  if (!row || row.trashed_at !== null) return notFound();
  const person = caller.person;
  if (person?.app && person.app !== row.app) return notFound();
  let access: Access | Response | null = directAccess(row, person);
  if (!access) {
    // The code is in the path, so the password header may come alone.
    const password = ctx.request.headers.get(SHARE_PASSWORD_HEADER) || null;
    access = await linkAccess(link, password);
    if (access instanceof Response) return access;
    if (person) {
      const [visit] = await env.INDEX_DB.batch([
        firstVisitStatement(env, person.id, row.id),
        sharedWithUpsert(env, person.id, row.id, code, Date.now()),
      ]);
      // Their first time in: the app's "someone joined" email (notices.ts).
      if (wasFirstVisit(visit)) {
        tellApp(ctx.waitUntil, env, row, {
          type: 'joined',
          personId: person.id,
          level: access.level,
        });
      }
    }
  }
  const [item] = await decorate(env, person, [row], new Map([[row.id, access]]));
  // `public`: a Community post's link, whose live image and card its app decides on (liveworkspace/docs/previews.md).
  return json({ item, level: access.level, tabId: access.tabId, public: link.public === 1 });
}

// GET /shared and DELETE /shared/:itemId.
export async function handleShared(ctx: PersonContext): Promise<Response> {
  const { request, env, url, segments, person } = ctx;
  const db = env.INDEX_DB;
  if (segments.length === 2 && request.method === 'DELETE' && isId(segments[1])) {
    await db
      .prepare('DELETE FROM shared_with WHERE person_id = ? AND item_id = ?')
      .bind(person.id, segments[1])
      .run();
    return noContent();
  }
  if (segments.length !== 1 || request.method !== 'GET') return notFound();
  const limit = parseLimit(url.searchParams.get('limit'));
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  if (limit === null) return badRequest('invalid_query');
  if (cursor === null) return badRequest('invalid_cursor');
  const app = url.searchParams.get('app');
  if (app !== null && !isApp(app)) return badRequest('invalid_app');
  const filters = await parseListFilters(env, person, url.searchParams);
  if (filters instanceof Response) return filters;
  const narrow = filterClauses(person, filters);
  const { results } = await db
    .prepare(
      `SELECT ${ITEM_COLUMNS}, sw.share_code, sw.last_seen, sl.level AS link_level, sl.tab_id AS link_tab
       FROM shared_with sw
       JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
       JOIN items i ON i.id = sw.item_id
       WHERE sw.person_id = ? AND ${LIVE_LINK('sl')} AND i.trashed_at IS NULL
         AND i.scope NOT IN (SELECT value FROM json_each(?))
         ${app ? 'AND i.app = ?' : ''}
         ${narrow.where.map((clause) => `AND ${clause}`).join(' ')}
         ${cursor ? 'AND (sw.last_seen, sw.item_id) < (?, ?)' : ''}
       ORDER BY sw.last_seen DESC, sw.item_id DESC LIMIT ?`,
    )
    .bind(
      person.id,
      Date.now(),
      JSON.stringify(scopesOf(person)),
      ...(app ? [app] : []),
      ...narrow.args,
      ...(cursor ? [cursor.at, cursor.id] : []),
      limit + 1,
    )
    .all<
      ItemRow & {
        share_code: string;
        last_seen: number;
        link_level: Level;
        link_tab: string | null;
      }
    >();
  const more = results.length > limit;
  const page = more ? results.slice(0, limit) : results;
  const known = new Map<string, Access>(
    page.map((r) => [
      r.id,
      { level: r.link_level, tabId: r.link_tab, via: 'link', code: r.share_code },
    ]),
  );
  const items = await decorate(env, person, page, known);
  const last = page[page.length - 1];
  return json({
    shared: page.map((r, i) => ({
      item: items[i]!,
      code: r.share_code,
      level: r.link_level,
      tabId: r.link_tab,
      lastSeenAt: r.last_seen,
    })),
    nextCursor: more && last ? encodeCursor({ at: last.last_seen, id: last.id }) : null,
  });
}
