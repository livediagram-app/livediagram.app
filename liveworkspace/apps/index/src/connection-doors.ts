// Connected tabs from the host app's side (liveworkspace/docs/specs/004-index/blueprints/connected-tabs.md): with its
// key, the app confirms a connection once its tab is in the host, and removes one once its tab has left; and the
// sweep takes back connections whose tab never appeared (Work Tracker #571). Each door matches the host, the tab and
// the app, and answers 204 whether or not anything matched, so a copy's tab or a second call changes nothing.

import { isConnectionId, type App } from '@liveworkspace/index-client';
import { isId, isPartId } from './codec';
import { CONNECTION_CONFIRM_GRACE_MS, CONNECTION_SWEEP_MAX } from './config';
import { dropStatements, tellPassesRevoked, type DropRow } from './connection-rows';
import type { Env } from './env';
import { noContent, notFound } from './http';
import { eventStatements } from './events';

// PUT (confirm) and DELETE (remove) /app/items/:id/connections/:connectionId?tab=<tabId>, with `app`'s key.
export async function handleAppConnection(
  request: Request,
  env: Env,
  app: App,
  hostId: string,
  connectionId: string,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const method = request.method;
  if (method !== 'PUT' && method !== 'DELETE') return notFound();
  const tab = new URL(request.url).searchParams.get('tab');
  if (!isId(hostId) || !isConnectionId(connectionId) || !isPartId(tab)) return noContent();
  const db = env.INDEX_DB;
  const row = await db
    .prepare(
      `SELECT c.id, c.share_code, c.target_item_id, t.app AS target_app, h.app AS host_app FROM connections c
       JOIN items h ON h.id = c.host_item_id
       LEFT JOIN items t ON t.id = c.target_item_id
       WHERE c.id = ? AND c.host_item_id = ? AND c.host_tab_id = ?`,
    )
    .bind(connectionId, hostId, tab)
    .first<DropRow & { host_app: App }>();
  if (!row || row.host_app !== app) return noContent();

  if (method === 'PUT') {
    await db
      .prepare('UPDATE connections SET confirmed_at = COALESCE(confirmed_at, ?) WHERE id = ?')
      .bind(Date.now(), row.id)
      .run();
    return noContent();
  }
  // The tab left its host: the pass goes, and with it everyone it let in. Its pair keeps its own pass.
  await db.batch([
    ...dropStatements(db, [row]),
    ...(row.share_code && row.target_item_id
      ? eventStatements(db, {
          itemId: row.target_item_id,
          type: 'unshared',
          actorId: null,
          at: Date.now(),
        })
      : []),
  ]);
  waitUntil(tellPassesRevoked(env, [row]));
  return noContent();
}

// Every 15 minutes: connections still unconfirmed CONNECTION_CONFIRM_GRACE_MS after they were made (IDX27), oldest
// first, at most `max`, go with their passes. Returns how many.
export async function sweepUnconfirmedConnections(
  env: Env,
  now = Date.now(),
  max = CONNECTION_SWEEP_MAX,
): Promise<number> {
  const db = env.INDEX_DB;
  const { results } = await db
    .prepare(
      `SELECT c.id, c.share_code, c.target_item_id, t.app AS target_app FROM connections c
       LEFT JOIN items t ON t.id = c.target_item_id
       WHERE c.confirmed_at IS NULL AND c.created_at < ?
       ORDER BY c.created_at LIMIT ?`,
    )
    .bind(now - CONNECTION_CONFIRM_GRACE_MS, max)
    .all<DropRow>();
  if (results.length === 0) return 0;
  await db.batch(dropStatements(db, results));
  await tellPassesRevoked(env, results);
  return results.length;
}
