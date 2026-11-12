// The shapes and the schema of a tab shared between items (tab-shares.ts, which re-exports all of it): the caps, the
// tables and trigger in each item's SQLite, the messages holders send each other, and what the app configures.

// The items one tab may be held by at once, the first included. Each join tells every earlier holder, so a tab held
// by n items has sent about n²/2 small `join` messages over its life, and a write to it is n - 1 calls.
export const MAX_TAB_HOLDERS = 20;

// Messages one drain sends. Each is one call to another item; a body is up to a tab's size.
export const DRAIN_SHARES = 50;

// The tables and the trigger, in the item's SQLite, for the app's link table (`<item>_tabs`). Idempotent. The
// tables reference `tabs (id)`, so a tab's delete takes its holders with it.
export function tabSharesSchema(): string {
  return `
-- A tab shared with other items (@liveworkspace/index-app tab-shares.ts): every item that holds it keeps its own
-- copy under the same tab id, and this lists the OTHER items holding it.
CREATE TABLE IF NOT EXISTS tab_shares (
  tab_id  TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, item_id)
) WITHOUT ROWID;

-- What this item owes the other holders of its shared tabs, drained by the room's alarm:
--   body:  the tab's current name and body, read when sent
--   join:  member now holds the tab too
--   leave: this item no longer holds the tab
-- A key written again is deleted and inserted under a new id, so a drain in flight keeps it. The app's next step,
-- outbox.ts outboxRetrySchema, adds each key's failed sends (attempts) and next try (retry_at).
CREATE TABLE IF NOT EXISTS share_outbox (
  id      INTEGER PRIMARY KEY,
  kind    TEXT    NOT NULL CHECK (kind IN ('body', 'join', 'leave')),
  tab_id  TEXT    NOT NULL,
  to_item TEXT    NOT NULL,
  member  TEXT    NOT NULL DEFAULT '',
  UNIQUE (kind, tab_id, to_item, member)
);
CREATE TRIGGER IF NOT EXISTS share_outbox_tab_update AFTER UPDATE OF data, name ON tabs
  WHEN EXISTS (SELECT 1 FROM tab_shares WHERE tab_id = NEW.id)
BEGIN
  DELETE FROM share_outbox WHERE kind = 'body' AND tab_id = NEW.id;
  INSERT INTO share_outbox (kind, tab_id, to_item) SELECT 'body', NEW.id, item_id FROM tab_shares WHERE tab_id = NEW.id;
END;
`;
}

export type ShareMessage =
  // The tab as the sender holds it, and the holders it knows (itself included). `extra` is the app's (the images
  // the sender may serve, say), read by the sender and applied by the receiver.
  | {
      kind: 'body';
      tabId: string;
      name: string;
      data: string;
      updatedAt: number;
      members: string[];
      extra?: unknown;
    }
  | { kind: 'join'; tabId: string; member: string }
  | { kind: 'leave'; tabId: string };

// `gone`: the receiver does not hold the tab, so the sender stops sending it.
export type ShareAnswer = 'ok' | 'gone';

// What an item joining a tab's holders takes from the one it joins through.
export type SharedTabCopy = {
  name: string;
  data: string;
  updatedAt: number;
  // Every holder but the joining one, the sender first.
  members: string[];
  extra?: unknown;
};

// A tab as it travels between holders.
export type SharedTabBody = { id: string; name: string; data: string; updatedAt: number };

// The slice of D1 (or an item's D1-shaped facade, item-db.ts) this uses.
export type ShareDb = Pick<D1Database, 'prepare' | 'batch'>;

export type TabSharesConfig<E> = {
  // The item's SQLite (its D1-shaped facade) in the env the app's code runs with.
  db: (env: E) => ShareDb;
  // The app's link table and its item column (`document_tabs`, `document_id`).
  linkTable: string;
  itemColumn: string;
  // The statements that store a tab taken in from another holder as a new tab of `itemId` at `orderIndex`: the app's
  // own tab write (body, link row, stats, references, saved time). The kit then dates it as the copy.
  insertTab: (
    env: E,
    itemId: string,
    tab: SharedTabBody,
    orderIndex: number,
  ) => D1PreparedStatement[];
  // Beside a later body taken in over the held one (the kit writes name, data, updated_at and rev): the rows the app
  // derives from a body, as a local write keeps them (element count, stats, references, the item's saved time).
  bodyTaken: (env: E, itemId: string, tab: SharedTabBody, now: number) => D1PreparedStatement[];
  // What travels beside a body, when the app needs more than the body (optional): `read` on the sender, `apply`'s
  // statements in the same transaction as the body on the receiver (a join, or a later body).
  extra?: {
    read: (env: E, itemId: string, tab: SharedTabBody) => Promise<unknown>;
    apply: (
      env: E,
      itemId: string,
      tab: SharedTabBody,
      extra: unknown,
      now: number,
    ) => Promise<D1PreparedStatement[]>;
  };
};

export type ShareDrain = { sent: number; failed: number; more: boolean };
export type SharedTabsCount = { tabs: number; items: number };

// The send a drain makes: one call to the item `to`'s Durable Object (its `receiveShares` RPC).
export type ShareSend = (to: string, messages: ShareMessage[]) => Promise<ShareAnswer[]>;
