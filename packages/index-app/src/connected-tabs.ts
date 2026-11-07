// Connected tabs in an app's item (liveworkspace/docs/specs/004-index/connected-tabs.md; blueprint "Each app"): a tab
// standing for another item, which the host app keeps as `tabs.connection`, the `TabConnection` as JSON
// (`tabConnectionText`), beside the tab's name and never in its body. This is the part every app shares: the column,
// the reverse tab the index writes through the internal door (internal.ts `connectedTab`), and the two calls an app
// makes to the index, confirming a connected tab once it is in and telling it once the tab has left.
import {
  CONNECTIONS_PER_ITEM,
  parseTabConnectionText,
  readTabConnection,
  tabConnectionText,
  type ConnectedTabWrite,
  type IndexAppClient,
  type TabConnection,
} from '@liveworkspace/index-client';

// The schema step each app appends to its item's SQLite (a plain ALTER, run once by the schema's version row): every
// tab already there reads as not connected.
export const TAB_CONNECTION_SCHEMA = 'ALTER TABLE tabs ADD COLUMN connection TEXT NULL;';

type ConnectionDb = Pick<D1Database, 'prepare' | 'batch'>;

// The statement that sets (or clears) one tab's connection.
export const tabConnectionStatement = (
  db: ConnectionDb,
  tabId: string,
  connection: TabConnection | null,
): D1PreparedStatement =>
  db
    .prepare('UPDATE tabs SET connection = ? WHERE id = ?')
    .bind(connection ? tabConnectionText(connection) : null, tabId);

// A tab write's `connection`, as a body carries it: exactly `{ id, app, itemId }`, or nothing.
export function tabConnectionOf(body: unknown): TabConnection | undefined {
  if (!body || typeof body !== 'object') return undefined;
  return readTabConnection((body as { connection?: unknown }).connection) ?? undefined;
}

// The connection an editor's whole-tab save may keep on its tab (blueprint "Each app"): the one it sent, onto a tab
// that is new or already connected (Connect Again), never onto a tab holding content of its own. Undefined leaves the
// stored column as it is, so an autosave that omits it never disconnects a tab.
export function connectionToKeep(
  sent: TabConnection | undefined,
  stored: { exists: boolean; connection: TabConnection | null },
): TabConnection | undefined {
  if (!sent) return undefined;
  if (stored.exists && !stored.connection) return undefined;
  return sent;
}

// Whether two connections are the same one.
export const sameConnection = (
  a: TabConnection | null | undefined,
  b: TabConnection | null | undefined,
) =>
  (a?.id ?? null) === (b?.id ?? null) &&
  (a?.app ?? null) === (b?.app ?? null) &&
  (a?.itemId ?? null) === (b?.itemId ?? null);

// What the reverse write made: the tab holding the connection (`made` false when it was there already), or why not.
export type ConnectedTabOutcome =
  { tabId: string; made: boolean } | 'connection_limit' | 'not_found';

export type ConnectedTabAppend = {
  // The item's link table and its item column (`document_tabs`, `document_id`), as tab-shares.ts names them.
  linkTable: string;
  itemColumn: string;
  // The statements that store a new, empty tab `tabId` named `name` at `orderIndex`: its body, its place, its stats,
  // as any new tab of the app is stored. The connection is set after them.
  insertTab: (tabId: string, name: string, orderIndex: number) => D1PreparedStatement[];
  // A fresh tab id; crypto.randomUUID by default.
  newId?: () => string;
};

// The index's reverse write (`POST /api/internal/items/:id/connected-tabs`): one connected tab, loose, at the end of
// the item's tab bar. The same connection id again answers the tab it already made; past CONNECTIONS_PER_ITEM it
// makes nothing. One read and one batch, run in the item's own Durable Object, so nothing lands between them.
export async function appendConnectedTab(
  db: ConnectionDb,
  itemId: string,
  write: ConnectedTabWrite,
  config: ConnectedTabAppend,
): Promise<ConnectedTabOutcome> {
  const { linkTable, itemColumn } = config;
  if (!/^\w+$/.test(linkTable) || !/^\w+$/.test(itemColumn))
    throw new Error('connected-tabs: bad table name');
  const row = await db
    .prepare(
      `SELECT
         (SELECT id FROM tabs WHERE connection IS NOT NULL AND json_extract(connection, '$.id') = ?1) AS existing,
         (SELECT COUNT(*) FROM tabs WHERE connection IS NOT NULL) AS connected,
         (SELECT COALESCE(MAX(order_index) + 1, 0) FROM ${linkTable} WHERE ${itemColumn} = ?2) AS next`,
    )
    .bind(write.connection.id, itemId)
    .first<{ existing: string | null; connected: number; next: number }>();
  if (row?.existing) return { tabId: row.existing, made: false };
  if ((row?.connected ?? 0) >= CONNECTIONS_PER_ITEM) return 'connection_limit';
  const tabId = (config.newId ?? (() => crypto.randomUUID()))();
  await db.batch([
    ...config.insertTab(tabId, write.name, row?.next ?? 0),
    tabConnectionStatement(db, tabId, write.connection),
  ]);
  return { tabId, made: true };
}

// The connection a stored column holds, for a removal or a read (null when empty or malformed).
export const storedTabConnection = (text: string | null | undefined): TabConnection | null =>
  parseTabConnectionText(text);

// The index hears that a connected tab is in its host now (`confirmConnection`), or the hourly sweep would take it
// back. Best effort and logged: an index out of reach leaves the connection unconfirmed, and the sweep removes it
// with its pass, which only ever takes access away.
export async function confirmTabConnection(
  client: IndexAppClient | null,
  hostId: string,
  tabId: string,
  connection: TabConnection,
): Promise<void> {
  if (!client) return;
  try {
    await client.confirmConnection(hostId, connection.id, tabId);
  } catch (err) {
    console.warn('[connections] confirm failed', { hostId, tabId, error: String(err) });
  }
}

// The index hears that a connected tab has left its host (`removeConnection`), and deletes the connection and its
// pass. Nothing for a tab with no connection. Best effort and logged: the index answers 204 whether or not it
// matched, so a copy's tab or a duplicate takes nothing away.
export async function tellConnectionLeft(
  client: IndexAppClient | null,
  hostId: string,
  tabId: string,
  connection: TabConnection | null,
): Promise<void> {
  if (!client || !connection) return;
  try {
    await client.removeConnection(hostId, connection.id, tabId);
  } catch (err) {
    console.warn('[connections] removal not told', {
      hostId,
      tabId,
      connectionId: connection.id,
      error: String(err),
    });
  }
}
