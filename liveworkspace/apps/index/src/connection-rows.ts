// Connected tabs' rows (liveworkspace/docs/specs/004-index/blueprints/connected-tabs.md): a new connection's id, where
// a target opens, and taking connections and their passes away, shared by the routes, the app's doors, the sweep and
// purges.

import { CONNECTION_ID_PREFIX, type App } from '@liveworkspace/index-client';
import { APP_ITEMS, LOCAL_PORTS } from '@liveworkspace/sites';
import { callApp, eachLimited } from './app-calls';
import { APP_CALL_CONCURRENCY } from './config';
import type { Env } from './env';

type Db = D1Database;

// IDX22: `cn_` and 24 random letters and digits. Bytes past the last whole multiple of the alphabet are drawn again,
// so no letter is likelier than another.
const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 24;
const UNBIASED_BELOW = 256 - (256 % ID_ALPHABET.length);

export function newConnectionId(): string {
  let id = CONNECTION_ID_PREFIX;
  while (id.length < CONNECTION_ID_PREFIX.length + ID_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(ID_LENGTH))) {
      if (byte >= UNBIASED_BELOW) continue;
      id += ID_ALPHABET[byte % ID_ALPHABET.length];
      if (id.length === CONNECTION_ID_PREFIX.length + ID_LENGTH) break;
    }
  }
  return id;
}

// Where an app's site answers for this deployment: www in production, `staging.` on staging, its local port in
// development. Built from the registry only, so a connected tab never leads anywhere but one of our apps.
export function appSiteOrigin(env: Pick<Env, 'ENVIRONMENT'>, app: App): string {
  const site = APP_ITEMS[app].site;
  if (env.ENVIRONMENT === 'development') return `http://localhost:${LOCAL_PORTS[site]}`;
  if (env.ENVIRONMENT === 'staging') return `https://staging.${site}`;
  return `https://www.${site}`;
}

// Where a connected tab leads: the target's own address (`via: 'item'`, its id) or its pass's share address
// (`via: 'link'`, the code), on the target app's site.
export function connectionHref(
  env: Pick<Env, 'ENVIRONMENT'>,
  app: App,
  via: 'item' | 'link',
  value: string,
): string {
  const items = APP_ITEMS[app];
  return `${appSiteOrigin(env, app)}${via === 'item' ? items.itemPath : items.sharePath}${encodeURIComponent(value)}`;
}

// A connection about to go: its id, its pass, and the target's app (null once the target was purged).
export type DropRow = {
  id: string;
  share_code: string | null;
  target_item_id: string | null;
  target_app: App | null;
};

// Deletes connections with their passes and the passes' Shared with me rows: three statements whatever the count.
// The Shared with me rows go first, matched on (item, code) so their index serves the match.
export function dropStatements(db: Db, rows: readonly DropRow[]): D1PreparedStatement[] {
  const passes = rows.flatMap((r) =>
    r.share_code && r.target_item_id ? [[r.target_item_id, r.share_code]] : [],
  );
  return [
    db
      .prepare(
        `DELETE FROM shared_with WHERE (item_id, share_code) IN (
           SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?))`,
      )
      .bind(JSON.stringify(passes)),
    db
      .prepare(
        `DELETE FROM share_links WHERE code IN (SELECT json_extract(value, '$[1]') FROM json_each(?))`,
      )
      .bind(JSON.stringify(passes)),
    db
      .prepare('DELETE FROM connections WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(rows.map((r) => r.id))),
  ];
}

// Each target's app hears its passes were deleted, so the sessions they let in end now (as any deleted link's do).
// One call per target, at most APP_CALL_CONCURRENCY at once; a failure is logged and the grant's lapse ends them.
export async function tellPassesRevoked(env: Env, rows: readonly DropRow[]): Promise<void> {
  const byTarget = new Map<string, { app: App; codes: string[] }>();
  for (const r of rows) {
    if (!r.share_code || !r.target_item_id || !r.target_app) continue;
    const entry = byTarget.get(r.target_item_id) ?? { app: r.target_app, codes: [] };
    entry.codes.push(r.share_code);
    byTarget.set(r.target_item_id, entry);
  }
  await eachLimited([...byTarget], APP_CALL_CONCURRENCY, async ([itemId, { app, codes }]) => {
    const res = await callApp(env, app, 'POST', `/items/${encodeURIComponent(itemId)}/revoke`, {
      codes,
    });
    if (!res.ok) console.warn('[index] connection revoke not delivered', { app, error: res.error });
  });
}

// Purging hosts (`ids`, a JSON array): the passes their connections made on other items, and those passes' Shared
// with me rows, before the hosts' rows go (their connections cascade). Two statements whatever the count.
export function hostedPassStatements(db: Db, ids: string): D1PreparedStatement[] {
  const hosted = `SELECT target_item_id, share_code FROM connections
    WHERE host_item_id IN (SELECT value FROM json_each(?)) AND share_code IS NOT NULL`;
  return [
    db.prepare(`DELETE FROM shared_with WHERE (item_id, share_code) IN (${hosted})`).bind(ids),
    db
      .prepare(`DELETE FROM share_links WHERE code IN (SELECT share_code FROM (${hosted}))`)
      .bind(ids),
  ];
}
