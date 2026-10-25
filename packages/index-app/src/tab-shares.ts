// A tab shared between items: one tab in several of a person's items at once, an edit in any reaching the others
// (each app's "Add to <Item>", its `tab-<item>-many-to-many.md` spec). Each item's content lives in its own Durable
// Object, so every item holding a shared tab keeps its own copy under the same tab id, and lists the OTHER holders in
// `tab_shares`. A write to the tab (a save, a rename, an agent's changeset, an undo) fills `share_outbox` from a
// trigger, so no write path can forget it; the room's alarm drains it, sending the tab's current name and body to
// each other holder, which keeps the later write (by its time, then by its content, so every holder settles on the
// same one). A copy taken in from another holder is sent on only to holders the sender did not list, which is how a
// holder that joined a moment ago hears of a write made by one that has not yet heard of it.
//
// Holders come and go by message too: `join` tells the others an item now holds the tab, `leave` that one no longer
// does. A holder that answers `gone` (it no longer holds the tab, or no longer exists) is dropped.
//
// The app supplies what only it knows: its link table (`document_tabs`, `plan_tabs`, ...), how it stores a tab taken
// in as a new tab, the rows it derives from a body (stats, image or sheet references, the item's saved time), and
// optionally what travels beside a body (the images the sender may serve). Everything else is here, once.
//
// Cost: a save of a shared tab adds one primary-key read (the trigger's `tab_shares` check). A drain sends at most
// DRAIN_SHARES messages, one Durable Object call each, reading each body once however many holders it goes to. A tab
// is held by at most MAX_TAB_HOLDERS items, so one write fans out to at most MAX_TAB_HOLDERS - 1 calls.

import { FLUSH_IDLE_MS, FLUSH_RETRY_MS, type SqlExec } from './outbox';

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
-- A key written again is deleted and inserted under a new id, so a drain in flight keeps it.
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

export type TabShares<E> = ReturnType<typeof createTabShares<E>>;

type StoredTab = { name: string; data: string; updated_at: number };
type ShareRow = {
  id: number;
  kind: 'body' | 'join' | 'leave';
  tab_id: string;
  to_item: string;
  member: string;
};

export function createTabShares<E>(config: TabSharesConfig<E>) {
  const { linkTable, itemColumn } = config;
  if (!/^\w+$/.test(linkTable) || !/^\w+$/.test(itemColumn))
    throw new Error('tab-shares: bad table name');

  async function storedTab(db: ShareDb, itemId: string, tabId: string): Promise<StoredTab | null> {
    return db
      .prepare(
        `SELECT t.name, t.data, t.updated_at FROM tabs t JOIN ${linkTable} l ON l.tab_id = t.id
          WHERE l.${itemColumn} = ? AND t.id = ?`,
      )
      .bind(itemId, tabId)
      .first<StoredTab>();
  }

  async function membersOf(db: ShareDb, tabId: string): Promise<string[]> {
    const { results } = await db
      .prepare('SELECT item_id FROM tab_shares WHERE tab_id = ? ORDER BY item_id')
      .bind(tabId)
      .all<{ item_id: string }>();
    return results.map((r) => r.item_id);
  }

  // One share_outbox key, under a new id when it was already there (a drain in flight then keeps it).
  function enqueue(
    db: ShareDb,
    kind: ShareRow['kind'],
    tabId: string,
    to: string,
    member = '',
  ): D1PreparedStatement[] {
    return [
      db
        .prepare(
          'DELETE FROM share_outbox WHERE kind = ? AND tab_id = ? AND to_item = ? AND member = ?',
        )
        .bind(kind, tabId, to, member),
      db
        .prepare('INSERT INTO share_outbox (kind, tab_id, to_item, member) VALUES (?, ?, ?, ?)')
        .bind(kind, tabId, to, member),
    ];
  }

  const learn = (db: ShareDb, tabId: string, member: string) =>
    db
      .prepare('INSERT OR IGNORE INTO tab_shares (tab_id, item_id) VALUES (?, ?)')
      .bind(tabId, member);

  async function extraOf(env: E, itemId: string, tab: SharedTabBody): Promise<unknown> {
    return config.extra ? config.extra.read(env, itemId, tab) : undefined;
  }

  async function applyExtra(
    env: E,
    itemId: string,
    tab: SharedTabBody,
    extra: unknown,
    now: number,
  ) {
    return config.extra && extra !== undefined
      ? config.extra.apply(env, itemId, tab, extra, now)
      : [];
  }

  // ---------- Joining ----------------------------------------------------------------------------------------

  // The joining item's first step, on the item it joins through: the tab as held here and its holders. Records
  // nothing, so a join that fails part way leaves no holder that holds nothing. Null: no such tab here.
  async function copyOf(env: E, itemId: string, tabId: string): Promise<SharedTabCopy | null> {
    const db = config.db(env);
    const tab = await storedTab(db, itemId, tabId);
    if (!tab) return null;
    const body = { id: tabId, name: tab.name, data: tab.data, updatedAt: tab.updated_at };
    const extra = await extraOf(env, itemId, body);
    return {
      name: tab.name,
      data: tab.data,
      updatedAt: tab.updated_at,
      members: [itemId, ...(await membersOf(db, tabId))],
      ...(extra === undefined ? {} : { extra }),
    };
  }

  // The joining item's own step: the tab as a new tab at the end of its order, under the same id, dated as the copy
  // it took, and the holders it now shares it with. False when it already holds a tab with that id.
  async function take(
    env: E,
    itemId: string,
    tabId: string,
    copy: SharedTabCopy,
  ): Promise<boolean> {
    const db = config.db(env);
    const held = await db.prepare('SELECT 1 AS present FROM tabs WHERE id = ?').bind(tabId).first();
    if (held) return false;
    const position = await db
      .prepare(
        `SELECT COALESCE(MAX(order_index) + 1, 0) AS next FROM ${linkTable} WHERE ${itemColumn} = ?`,
      )
      .bind(itemId)
      .first<{ next: number }>();
    const body = { id: tabId, name: copy.name, data: copy.data, updatedAt: copy.updatedAt };
    const members = copy.members.filter((m) => m !== itemId);
    await db.batch([
      ...config.insertTab(env, itemId, body, position?.next ?? 0),
      // Dated as the copy, not now: a write the holder made since is then newer, and lands here when it comes.
      db.prepare('UPDATE tabs SET updated_at = ? WHERE id = ?').bind(copy.updatedAt, tabId),
      ...members.map((m) => learn(db, tabId, m)),
      ...(await applyExtra(env, itemId, body, copy.extra, Date.now())),
    ]);
    return true;
  }

  // The last step, back on the item joined through: it now shares the tab with `member`, tells the other holders so,
  // and sends `member` the tab again if it changed since `seenUpdatedAt`. False: no such tab here.
  async function recordJoin(
    env: E,
    itemId: string,
    tabId: string,
    member: string,
    seenUpdatedAt: number,
  ): Promise<boolean> {
    const db = config.db(env);
    const tab = await storedTab(db, itemId, tabId);
    if (!tab) return false;
    const others = (await membersOf(db, tabId)).filter((m) => m !== member);
    await db.batch([
      learn(db, tabId, member),
      ...others.flatMap((m) => enqueue(db, 'join', tabId, m, member)),
      ...(tab.updated_at === seenUpdatedAt ? [] : enqueue(db, 'body', tabId, member)),
    ]);
    return true;
  }

  // How many items hold the tab here, this one included (0: none). The link route refuses a join past
  // MAX_TAB_HOLDERS.
  async function holders(env: E, itemId: string, tabId: string): Promise<number> {
    const db = config.db(env);
    if (!(await storedTab(db, itemId, tabId))) return 0;
    return 1 + (await membersOf(db, tabId)).length;
  }

  // ---------- Leaving ----------------------------------------------------------------------------------------

  // Before a tab's delete from this item (shareLeaveStatements below).
  const leaveStatements = (env: E, tabId: string) => shareLeaveStatements(config.db(env), tabId);

  // Every (tab, holder) pair the item shares: an item purged for good says goodbye to each first.
  async function allShares(env: E): Promise<{ tabId: string; to: string }[]> {
    const db = config.db(env);
    const { results } = await db
      .prepare('SELECT tab_id, item_id FROM tab_shares ORDER BY tab_id, item_id')
      .all<{ tab_id: string; item_id: string }>();
    return results.map((r) => ({ tabId: r.tab_id, to: r.item_id }));
  }

  // An item going for good (a purge: the Trash's, Take Offline's, a closed account's) tells the other holders of
  // its shared tabs it left, so their copies stop counting it. Best effort, one call per holder: a holder that misses
  // this hears `gone` the next time it sends here, and drops it then.
  async function leaveAll(env: E, itemId: string, send: ShareSend): Promise<number> {
    const byHolder = new Map<string, ShareMessage[]>();
    for (const { tabId, to } of await allShares(env)) {
      const list = byHolder.get(to) ?? [];
      list.push({ kind: 'leave', tabId });
      byHolder.set(to, list);
    }
    let told = 0;
    for (const [to, messages] of byHolder) {
      try {
        await send(to, messages);
        told += 1;
      } catch (error) {
        console.warn('[tab-shares] leave failed', { itemId, to, error: String(error) });
      }
    }
    return told;
  }

  // ---------- Receiving --------------------------------------------------------------------------------------

  // Whether `incoming` is the later write: by time, then (a tie, from two holders in the same millisecond) by
  // content, so every holder keeps the same one.
  function isLater(
    incoming: { name: string; data: string; updatedAt: number },
    held: StoredTab,
  ): boolean {
    if (incoming.updatedAt !== held.updated_at) return incoming.updatedAt > held.updated_at;
    if (incoming.data !== held.data) return incoming.data > held.data;
    return incoming.name > held.name;
  }

  // What another holder (`from`) sent. One answer per message.
  async function receive(
    env: E,
    itemId: string,
    from: string,
    messages: readonly ShareMessage[],
  ): Promise<ShareAnswer[]> {
    const answers: ShareAnswer[] = [];
    for (const message of messages) answers.push(await receiveOne(env, itemId, from, message));
    return answers;
  }

  async function receiveOne(
    env: E,
    itemId: string,
    from: string,
    message: ShareMessage,
  ): Promise<ShareAnswer> {
    const db = config.db(env);
    const { tabId } = message;
    if (message.kind === 'leave') {
      await db.batch([
        db.prepare('DELETE FROM tab_shares WHERE tab_id = ? AND item_id = ?').bind(tabId, from),
        db.prepare('DELETE FROM share_outbox WHERE tab_id = ? AND to_item = ?').bind(tabId, from),
      ]);
      return 'ok';
    }
    const held = await storedTab(db, itemId, tabId);
    if (!held) return 'gone';
    if (message.kind === 'join') {
      if (message.member !== itemId) await learn(db, tabId, message.member).run();
      return 'ok';
    }
    // A body from a holder this item has not heard of yet (its join is still on its way) makes it one.
    if (!isLater(message, held)) {
      await learn(db, tabId, from).run();
      return 'ok';
    }
    const now = Date.now();
    const body = {
      id: tabId,
      name: message.name,
      data: message.data,
      updatedAt: message.updatedAt,
    };
    // The sender sends to every holder it knows, so this item sends on only to the ones it did not know.
    const informed = JSON.stringify([from, ...message.members]);
    await db.batch([
      learn(db, tabId, from),
      db
        .prepare('UPDATE tabs SET name = ?, data = ?, updated_at = ?, rev = rev + 1 WHERE id = ?')
        .bind(message.name, message.data, message.updatedAt, tabId),
      ...config.bodyTaken(env, itemId, body, now),
      ...(await applyExtra(env, itemId, body, message.extra, now)),
      db
        .prepare(
          `DELETE FROM share_outbox WHERE kind = 'body' AND tab_id = ?
             AND to_item IN (SELECT value FROM json_each(?))`,
        )
        .bind(tabId, informed),
    ]);
    return 'ok';
  }

  // ---------- Sending ----------------------------------------------------------------------------------------

  // Send what share_outbox holds, one message per call, each to the item it is for. A message sent is deleted by the
  // id read, so one written again meanwhile stays; one that failed stays for the next drain; a holder that answered
  // `gone` is dropped, with whatever else was waiting for it about that tab.
  async function drain(env: E, itemId: string, send: ShareSend): Promise<ShareDrain> {
    const db = config.db(env);
    const rows = (
      await db
        .prepare('SELECT id, kind, tab_id, to_item, member FROM share_outbox ORDER BY id LIMIT ?')
        .bind(DRAIN_SHARES + 1)
        .all<ShareRow>()
    ).results;
    const more = rows.length > DRAIN_SHARES;
    let sent = 0;
    let failed = 0;
    // A tab sent to several holders is read once per drain.
    const bodies = new Map<string, Promise<ShareMessage | null>>();
    for (const row of rows.slice(0, DRAIN_SHARES)) {
      let message: ShareMessage | null;
      if (row.kind === 'body') {
        if (!bodies.has(row.tab_id)) bodies.set(row.tab_id, messageOf(env, itemId, row));
        message = await bodies.get(row.tab_id)!;
      } else {
        message = await messageOf(env, itemId, row);
      }
      if (message) {
        let answer: ShareAnswer;
        try {
          [answer = 'ok'] = await send(row.to_item, [message]);
        } catch (error) {
          console.warn('[tab-shares] send failed', {
            itemId,
            to: row.to_item,
            kind: row.kind,
            error: String(error),
          });
          failed += 1;
          continue;
        }
        sent += 1;
        if (answer === 'gone') {
          await db.batch([
            db
              .prepare('DELETE FROM tab_shares WHERE tab_id = ? AND item_id = ?')
              .bind(row.tab_id, row.to_item),
            db
              .prepare('DELETE FROM share_outbox WHERE tab_id = ? AND to_item = ?')
              .bind(row.tab_id, row.to_item),
          ]);
          continue;
        }
      }
      await db.prepare('DELETE FROM share_outbox WHERE id = ?').bind(row.id).run();
    }
    return { sent, failed, more };
  }

  // The message a row stands for, read now; null when there is nothing left to say (the tab went since).
  async function messageOf(env: E, itemId: string, row: ShareRow): Promise<ShareMessage | null> {
    if (row.kind === 'leave') return { kind: 'leave', tabId: row.tab_id };
    if (row.kind === 'join') return { kind: 'join', tabId: row.tab_id, member: row.member };
    const db = config.db(env);
    const tab = await storedTab(db, itemId, row.tab_id);
    if (!tab) return null;
    const body = { id: row.tab_id, name: tab.name, data: tab.data, updatedAt: tab.updated_at };
    const extra = await extraOf(env, itemId, body);
    return {
      kind: 'body',
      tabId: row.tab_id,
      name: tab.name,
      data: tab.data,
      updatedAt: tab.updated_at,
      members: [itemId, ...(await membersOf(db, row.tab_id))],
      ...(extra === undefined ? {} : { extra }),
    };
  }

  // ---------- The notice -------------------------------------------------------------------------------------

  // How many of the item's tabs are shared with other items, and with how many items: what deleting it or taking it
  // offline leaves in those (each app's "Shared-tab notice").
  async function count(env: E, itemId: string): Promise<SharedTabsCount> {
    const db = config.db(env);
    const row = await db
      .prepare(
        `SELECT COUNT(DISTINCT s.tab_id) AS tabs, COUNT(DISTINCT s.item_id) AS items
           FROM tab_shares s JOIN ${linkTable} l ON l.tab_id = s.tab_id
          WHERE l.${itemColumn} = ? AND s.item_id <> l.${itemColumn}`,
      )
      .bind(itemId)
      .first<SharedTabsCount>();
    return { tabs: row?.tabs ?? 0, items: row?.items ?? 0 };
  }

  return {
    copyOf,
    take,
    recordJoin,
    holders,
    leaveStatements,
    allShares,
    leaveAll,
    receive,
    drain,
    count,
  };
}

// Before a tab's delete from an item, in the same batch: every other holder hears that this item left, and nothing
// else it owed them about the tab is sent. Before the tab row's delete, which takes its `tab_shares`. Standalone, so
// the app's tab delete needs no more of the kit than its database.
export function shareLeaveStatements(db: ShareDb, tabId: string): D1PreparedStatement[] {
  return [
    db
      .prepare("DELETE FROM share_outbox WHERE tab_id = ? AND kind IN ('body', 'join')")
      .bind(tabId),
    db
      .prepare(
        `INSERT OR REPLACE INTO share_outbox (kind, tab_id, to_item)
         SELECT 'leave', tab_id, item_id FROM tab_shares WHERE tab_id = ?`,
      )
      .bind(tabId),
  ];
}

// Whether the item's SQLite owes another holder anything (the room arms its share send from this).
export function owesShares(sql: SqlExec): boolean {
  return sql.exec('SELECT 1 FROM share_outbox LIMIT 1').toArray().length > 0;
}

// When the room next sends its shared tabs' holders what they are owed: on idle after a write (FLUSH_IDLE_MS), not
// held to the index outbox's once a minute, since it is a call to another item rather than a push; a minute after a
// failure. The room reads `at` into its one alarm, and runs `send` from the alarm when `due`.
export class ShareSchedule {
  at: number | null = null;
  private readonly owes: () => boolean;
  private readonly now: () => number;

  constructor(owes: () => boolean, now: () => number = Date.now) {
    this.owes = owes;
    this.now = now;
  }

  // After a wake: anything still owed goes now.
  restore(): void {
    if (this.owes()) this.at = this.now();
  }

  // A write happened: true when it armed a send (the room then re-arms its alarm).
  noteWrite(): boolean {
    if (this.at !== null || !this.owes()) return false;
    this.at = this.now() + FLUSH_IDLE_MS;
    return true;
  }

  due(now: number): boolean {
    return this.at !== null && this.at <= now;
  }

  clear(): void {
    this.at = null;
  }

  // One drain; a failure keeps what was owed and tries again in a minute, more to send goes on idle.
  async send(drain: () => Promise<ShareDrain>): Promise<ShareDrain | null> {
    this.at = null;
    let result: ShareDrain | null = null;
    try {
      result = await drain();
      if (result.failed > 0) this.at = this.now() + FLUSH_RETRY_MS;
      else if (result.more) this.at = this.now() + FLUSH_IDLE_MS;
    } catch (error) {
      console.warn('[tab-shares] send failed', { error: String(error) });
      this.at = this.now() + FLUSH_RETRY_MS;
    }
    // Anything written while the send was in flight goes next time.
    if (this.at === null && this.owes()) this.at = this.now() + FLUSH_IDLE_MS;
    return result;
  }
}
