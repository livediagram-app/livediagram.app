// A kit's run, connected (liveworkspace/docs/specs/004-index/kits.md "Starting a kit", step 3; its blueprint "Making a
// run", step 6): every made part connected to every other, both ways, each connection's tab written into its host
// through the host app's connected tab door, as a connection's reverse is. A tab that could not be written takes its
// row and pass back; the rest stand.

import {
  itemConnectedTabsPath,
  kitPassLevel,
  type ConnectedTabWrite,
  type Level,
  type TabConnection,
} from '@liveworkspace/index-client';
import { callAppForJson, eachLimited } from './app-calls';
import { generateShareCode, isPartId } from './codec';
import { APP_CALL_CONCURRENCY, CONNECTION_REVERSE_TIMEOUT_MS } from './config';
import { dropStatements, newConnectionId } from './connection-rows';
import { insertConnection, insertPass, sharedEvent } from './connections';
import type { Env } from './env';
import type { ItemRow } from './rows';

type Link = { id: string; code: string; host: ItemRow; target: ItemRow; level: Level };

export type KitConnections = { made: number; failed: number };

const key = (host: string, target: string) => `${host}>${target}`;

// `parts`: the made items, in the kit's order, so each host's tab bar gains its tabs in that order.
export async function connectKitParts(
  env: Env,
  personId: string,
  parts: readonly ItemRow[],
  level: Level,
): Promise<KitConnections> {
  const db = env.INDEX_DB;
  // What a first run (or someone since) already connected among them stands; only the missing directions are made.
  const ids = JSON.stringify(parts.map((p) => p.id));
  const { results } = await db
    .prepare(
      `SELECT host_item_id AS host, target_item_id AS target FROM connections
        WHERE host_item_id IN (SELECT value FROM json_each(?1))
          AND target_item_id IN (SELECT value FROM json_each(?1)) AND confirmed_at IS NOT NULL`,
    )
    .bind(ids)
    .all<{ host: string; target: string }>();
  const standing = new Set(results.map((r) => key(r.host, r.target)));
  const links: Link[] = [];
  for (const host of parts)
    for (const target of parts)
      if (host.id !== target.id && !standing.has(key(host.id, target.id)))
        links.push({
          id: newConnectionId(),
          code: generateShareCode(),
          host,
          target,
          level: kitPassLevel(target.app, level),
        });
  if (links.length === 0) return { made: 0, failed: 0 };

  // One batch: every pass and row (tab not yet known), then the pairs joined where both directions are new.
  const now = Date.now();
  const byDirection = new Map(links.map((l) => [key(l.host.id, l.target.id), l]));
  const statements: D1PreparedStatement[] = [];
  const passAt: number[] = [];
  for (const l of links) {
    passAt.push(statements.length);
    statements.push(
      insertPass(db, {
        code: l.code,
        itemId: l.target.id,
        level: l.level,
        hostId: l.host.id,
        at: now,
      }),
      insertConnection(db, {
        id: l.id,
        hostId: l.host.id,
        tabId: null,
        targetId: l.target.id,
        code: l.code,
        pairId: null,
        at: now,
      }),
    );
  }
  for (const l of links) {
    const pair = byDirection.get(key(l.target.id, l.host.id));
    if (pair)
      statements.push(
        db
          .prepare(
            'UPDATE connections SET pair_id = ? WHERE id = ? AND EXISTS (SELECT 1 FROM connections WHERE id = ?)',
          )
          .bind(pair.id, l.id, pair.id),
      );
  }
  const written = await db.batch(statements);
  const ready = links.filter((_, i) => written[passAt[i]!]!.meta.changes > 0);

  // The tabs: one host's after another's in the kit's order, the hosts at once.
  const byHost = new Map<string, Link[]>();
  for (const l of ready) byHost.set(l.host.id, [...(byHost.get(l.host.id) ?? []), l]);
  const dropped: Link[] = [];
  let made = 0;
  await eachLimited([...byHost.values()], APP_CALL_CONCURRENCY, async (hostLinks) => {
    for (const l of hostLinks) {
      const connection: TabConnection = { id: l.id, app: l.target.app, itemId: l.target.id };
      const write: ConnectedTabWrite = { name: l.target.title, connection };
      const res = await callAppForJson(
        env,
        l.host.app,
        itemConnectedTabsPath(l.host.id),
        write,
        CONNECTION_REVERSE_TIMEOUT_MS,
      );
      const tabId = res.ok ? res.body.tabId : undefined;
      if (!isPartId(tabId)) {
        console.warn('[kits] connected tab not made', {
          app: l.host.app,
          error: res.ok ? 'invalid_tab' : res.error,
        });
        dropped.push(l);
        continue;
      }
      const at = Date.now();
      await db.batch([
        db
          .prepare('UPDATE connections SET host_tab_id = ?, confirmed_at = ? WHERE id = ?')
          .bind(tabId, at, l.id),
        ...sharedEvent(db, l.target.id, personId, l.level, at, l.id),
      ]);
      made += 1;
    }
  });
  // Nobody was ever let in by a dropped pass, so no app is told.
  if (dropped.length > 0)
    await db.batch(
      dropStatements(
        db,
        dropped.map((l) => ({
          id: l.id,
          share_code: l.code,
          target_item_id: l.target.id,
          target_app: l.target.app,
        })),
      ),
    );
  return { made, failed: links.length - made };
}
