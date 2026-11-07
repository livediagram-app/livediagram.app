// Connected tabs (liveworkspace/docs/specs/004-index/connected-tabs.md): a tab in one item (the host) that stands for
// another item (the target), in any app. The host app keeps only `TabConnection` on the tab; the pass's share code
// lives on the index and is handed out one open at a time. Both sides read these shapes, so an app's storage, its
// internal door and the index can never disagree on what a connection is.
import {
  APP_DEFAULT_LINK_LEVEL,
  APP_LINK_LEVELS,
  isApp,
  isLevel,
  linkLevelOffered,
  TITLE_MAX,
  type App,
  type Level,
} from './constants';

// The most connected tabs one host holds. Past it, `409 connection_limit`, and an app's internal door refuses
// a reverse tab.
export const CONNECTIONS_PER_ITEM = 50;

// The role a new connection's pass grants unless the person picks another: Editor, as the owner asked, in every app
// that offers it (all of them today); else the app's own default link level.
export const CONNECTION_DEFAULT_LEVEL: Level = 'edit';

// A connection's id, made by the index: `cn_` and random letters and digits, so ids cannot be walked.
export const CONNECTION_ID_PREFIX = 'cn_';
const CONNECTION_ID = /^cn_[A-Za-z0-9]{16,64}$/;
export const isConnectionId = (value: unknown): value is string =>
  typeof value === 'string' && CONNECTION_ID.test(value);

// An item or tab id as the index takes them (its codec's `isId`).
const PART_ID_MAX = 200;
const PART_ID = new RegExp(`^[A-Za-z0-9_-]{1,${PART_ID_MAX}}$`);
const isPartId = (value: unknown): value is string =>
  typeof value === 'string' && PART_ID.test(value);

// What the host app keeps on a connected tab: which connection, and which app and item it stands for. Nothing in it
// is secret; it opens nothing without the index.
export type TabConnection = {
  id: string;
  app: App;
  itemId: string;
};

// A connection as read from anywhere (a tab body, a request, a stored column), or null for anything malformed. The
// answer is a fresh object with exactly these three fields, so nothing else written beside them is ever kept.
export function readTabConnection(value: unknown): TabConnection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!isConnectionId(v.id) || !isApp(v.app) || !isPartId(v.itemId)) return null;
  return { id: v.id, app: v.app, itemId: v.itemId };
}

// A stored connection column is never longer than this; a longer one is malformed, not parsed.
export const TAB_CONNECTION_TEXT_MAX = 512;

// The column an app keeps a connection in (`tabs.connection`, JSON), read back; null when empty or malformed.
export function parseTabConnectionText(text: string | null | undefined): TabConnection | null {
  if (!text || text.length > TAB_CONNECTION_TEXT_MAX) return null;
  try {
    return readTabConnection(JSON.parse(text));
  } catch {
    return null;
  }
}

// The column's text for a connection, in one fixed key order.
export const tabConnectionText = (connection: TabConnection): string =>
  JSON.stringify({ id: connection.id, app: connection.app, itemId: connection.itemId });

// The roles a connection to one of `app`'s items may grant (the Connect picker's order), and the one it starts at.
export const connectionLevels = (app: App): readonly Level[] => APP_LINK_LEVELS[app];
export const connectionDefaultLevel = (app: App): Level =>
  linkLevelOffered(app, CONNECTION_DEFAULT_LEVEL)
    ? CONNECTION_DEFAULT_LEVEL
    : APP_DEFAULT_LINK_LEVEL[app];

// `POST /items/:id/connections` (the host's id), with the person's token and the host's grant.
export type ConnectionInput = {
  // The item to connect to.
  targetId: string;
  // The host tab that holds it: a new tab's id, or the tab being connected again.
  tabId: string;
  // The pass's role; `connectionDefaultLevel(target's app)` when left out.
  level?: Level;
  // Add a connected tab back to the host in the target too.
  both?: boolean;
};

export function readConnectionInput(value: unknown): ConnectionInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!isPartId(v.targetId) || !isPartId(v.tabId)) return null;
  if (v.level !== undefined && !isLevel(v.level)) return null;
  if (v.both !== undefined && typeof v.both !== 'boolean') return null;
  return {
    targetId: v.targetId,
    tabId: v.tabId,
    ...(v.level === undefined ? {} : { level: v.level }),
    ...(v.both === undefined ? {} : { both: v.both }),
  };
}

// Its answer: the connection to put on the host tab, the name to give it (the target's title), the pass's role, and
// the reverse when both ways was asked: made (`made`, with the tab it is in) or taken back (`unreached`).
export type ConnectionMade = {
  connection: TabConnection;
  name: string;
  level: Level;
  reverse:
    { state: 'made'; connection: TabConnection; tabId: string } | { state: 'unreached' } | null;
};

// `GET /connections/:id` with the host's grant: where the tab leads. `via: 'item'` is the target's own address (the
// reader reaches it themselves); `via: 'link'` is the pass's share address, at `level`.
export type ConnectionOpen = {
  app: App;
  itemId: string;
  name: string;
  href: string;
  via: 'item' | 'link';
  level: Level | null;
  // The target's picture on the reader's own origin (`/api/previews/...`): the item's for `via: 'item'` (asked with
  // the reader's Bearer), the pass's live image for `via: 'link'` (no credential).
  preview: string;
};

// Why a connection opens nothing, as `{ error }` on the open door: the target in the Trash or gone (410), the pass
// deleted or lapsed (410), not this host's or tab's (a copy, 404).
export const CONNECTION_REFUSALS = [
  'connection_target_gone',
  'connection_link_removed',
  'not_found',
] as const;
export type ConnectionRefusal = (typeof CONNECTION_REFUSALS)[number];

// The index's reverse write into the target app: `POST <app>/api/internal/items/:id/connected-tabs` with that app's
// `INDEX_KEY`. The app appends one connected tab, loose, at the end of the tab bar, and answers `{ tabId }`; the same
// connection id again answers the tab it already made.
export const itemConnectedTabsPath = (itemId: string) =>
  `/items/${encodeURIComponent(itemId)}/connected-tabs`;

export type ConnectedTabWrite = {
  name: string;
  connection: TabConnection;
};

// The door's body, or null: the name is the host's title as the index has it, trimmed and cut to `TITLE_MAX`.
export function readConnectedTabWrite(value: unknown): ConnectedTabWrite | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const connection = readTabConnection(v.connection);
  if (!connection || typeof v.name !== 'string') return null;
  const name = v.name.trim().slice(0, TITLE_MAX);
  return name ? { name, connection } : null;
}

// The host app's removal door on the index: `DELETE /app/items/:id/connections/:connectionId?tab=<tabId>` with the
// app's key, once a connected tab has left the host. The index deletes the connection and its pass only when both
// the host and the tab are the connection's, so a copy's tab, or a duplicate, takes nothing away.
export const appConnectionPath = (hostId: string, connectionId: string, tabId: string) =>
  `/app/items/${encodeURIComponent(hostId)}/connections/${encodeURIComponent(connectionId)}?tab=${encodeURIComponent(tabId)}`;
