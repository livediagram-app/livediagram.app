// What an item's Durable Object owes the index (liveworkspace/docs/one-explorer-contracts.md "What an item
// pushes"): its summary (`PUT /app/items/:id/summary`), each changed tab's comment threads and actions for the
// Inbox (`PUT /app/items/:id/collab/:tabId`), and who edited it, for the Timeline and their Most Used days
// (`PUT /app/items/:id/events`), all with the app's key.
//
// The item keeps an outbox in its own SQLite: a key per changed thing, written in the same transaction as the
// change (by triggers, or by `queueOutbox`), so no write path can forget one and a save makes no network call.
// The room's alarm drains it on idle, at most once a minute (`nextFlushAt`), and deletes the keys it pushed. A key
// written again meanwhile has a new id and stays for the next drain; a drain that fails keeps every key it did not
// push and retries a minute later.
//
// Kinds: `summary` (key ''), `tab` (key: the tab id), `edit` (key: `<person>@<time>`, one per person).

import {
  APP_EVENTS_MAX,
  COLLAB_MAX_ACTIONS,
  COLLAB_MAX_THREADS,
  IndexError,
  type AppTimelineEvent,
  type CollabPush,
  type IndexAppClient,
  type ItemSummary,
} from '@liveworkspace/index-client';

// How long the outbox waits after a write before it pushes (the contract's "on idle"), the least gap between two
// pushes ("at most once a minute"), and when a failed push is tried again.
export const FLUSH_IDLE_MS = 2_000;
export const FLUSH_MIN_GAP_MS = 60_000;
export const FLUSH_RETRY_MS = 60_000;
// Tabs one drain pushes: one request each, so a drain after a 200-tab import stays well inside a Durable Object's
// subrequest budget; the rest go in the next drain, which the room runs straight after (`more`).
export const DRAIN_TABS = 50;
// Pushes in flight at once.
export const PUSH_CONCURRENCY = 6;

// When the next drain runs after a write at `now`.
export const nextFlushAt = (now: number, lastFlushAt: number): number =>
  Math.max(now + FLUSH_IDLE_MS, lastFlushAt + FLUSH_MIN_GAP_MS);

export type OutboxRow = { id: number; kind: string; key: string };

// ---------- Who edited ---------------------------------------------------------------------------------------

// An `edit` key is `<person>@<time>`: one per person, the time of their latest write, so a morning of saves is
// one key and the drain reports it as one `edited` event (the index keeps one per person, item and day).
const EDITOR_SEP = '@';

export const editKeyOf = (personId: string, at: number): string => `${personId}${EDITOR_SEP}${at}`;

// The key range [from, to) holding every edit key of this person: '@' + 1 is 'A'.
export const editKeyRange = (personId: string): [string, string] => [
  `${personId}${EDITOR_SEP}`,
  `${personId}A`,
];

export function editedOf(key: string): AppTimelineEvent | null {
  const at = key.lastIndexOf(EDITOR_SEP);
  const actorId = key.slice(0, at);
  const time = Number(key.slice(at + 1));
  if (at <= 0 || !Number.isFinite(time)) return null;
  return { type: 'edited', actorId, at: time };
}

// ---------- The collab push ----------------------------------------------------------------------------------

// A tab's threads and actions capped as the index caps one push: a tab past it keeps its newest.
export function capCollabPush(push: CollabPush): CollabPush {
  return {
    threads: [...push.threads].sort((a, b) => b.latestAt - a.latestAt).slice(0, COLLAB_MAX_THREADS),
    actions: [...push.actions]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, COLLAB_MAX_ACTIONS),
  };
}

// ---------- The drain ----------------------------------------------------------------------------------------

export type OutboxSource = {
  // A tab's comment threads and actions (empty when the tab is gone, so the index drops its rows).
  collab: (tabId: string) => Promise<CollabPush>;
  // The item's summary (≤ 2 KB) and its last save; `ownerId` gets the owner's activity report.
  summary: () => Promise<{ summary: ItemSummary; updatedAt: number; ownerId?: string | null }>;
  // The owner's newest save, for liveworkspace's onboarding emails (`reportOwnerActivity`). Never throws.
  onSummary?: (ownerId: string, at: number) => Promise<void>;
};

// `done`: the row ids pushed (or no longer pushed), to delete. `failures`: pushes that failed; their keys stay.
// `more`: keys were left for the next drain.
export type DrainOutcome = { done: number[]; failures: unknown[]; pushes: number; more: boolean };

// An item the index does not hold (never made there, or purged) takes no push: the key is done.
const gone = (err: unknown) => err instanceof IndexError && err.status === 404;

async function inBatches(tasks: (() => Promise<void>)[]): Promise<void> {
  for (let i = 0; i < tasks.length; i += PUSH_CONCURRENCY) {
    await Promise.all(tasks.slice(i, i + PUSH_CONCURRENCY).map((t) => t()));
  }
}

// One drain over the outbox's rows (oldest first): up to DRAIN_TABS tabs and APP_EVENTS_MAX editors. Without a
// client (no index configured) every key is done.
export async function drainIndexOutbox(
  itemId: string,
  rows: readonly OutboxRow[],
  client: IndexAppClient | null,
  source: OutboxSource,
): Promise<DrainOutcome> {
  if (rows.length === 0) return { done: [], failures: [], pushes: 0, more: false };
  const tabs = new Set(
    rows
      .filter((r) => r.kind === 'tab')
      .map((r) => r.key)
      .slice(0, DRAIN_TABS),
  );
  const editors = new Set(
    rows
      .filter((r) => r.kind === 'edit')
      .slice(0, APP_EVENTS_MAX)
      .map((r) => r.id),
  );
  const pending = rows.filter(
    (r) => (r.kind !== 'tab' || tabs.has(r.key)) && (r.kind !== 'edit' || editors.has(r.id)),
  );
  const done: number[] = [];
  const failures: unknown[] = [];
  const tasks: (() => Promise<void>)[] = [];
  const edits: { id: number; event: AppTimelineEvent }[] = [];
  let activity: Promise<void> | null = null;

  const push = (ids: number[], send: () => Promise<void>) =>
    tasks.push(async () => {
      try {
        if (client) await send();
        done.push(...ids);
      } catch (err) {
        if (gone(err)) done.push(...ids);
        else failures.push(err);
      }
    });

  for (const row of pending) {
    if (row.kind === 'tab') {
      // One tab read at a time: a drain after a big import holds one tab in memory, never the item.
      const body = capCollabPush(await source.collab(row.key));
      push([row.id], () => client!.pushCollab(itemId, row.key, body));
    } else if (row.kind === 'summary') {
      const { summary, updatedAt, ownerId } = await source.summary();
      if (ownerId && updatedAt > 0 && source.onSummary)
        activity = source.onSummary(ownerId, updatedAt);
      push([row.id], () => client!.pushSummary(itemId, summary, updatedAt));
    } else if (row.kind === 'edit') {
      const event = editedOf(row.key);
      if (event) edits.push({ id: row.id, event });
      else done.push(row.id);
    } else {
      // A kind no longer pushed.
      done.push(row.id);
    }
  }
  if (edits.length > 0) {
    push(
      edits.map((e) => e.id),
      () =>
        client!.pushEvents(
          itemId,
          edits.map((e) => e.event),
        ),
    );
  }
  await Promise.all([inBatches(tasks), activity]);
  return { done, failures, pushes: tasks.length, more: pending.length < rows.length };
}

// ---------- The outbox table, for an item whose Durable Object holds one item --------------------------------

// The slice of `SqlStorage` these use (a test hands it node:sqlite).
export type SqlExec = {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
};

export const INDEX_OUTBOX_SCHEMA = `
CREATE TABLE IF NOT EXISTS index_outbox (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT    NOT NULL,
  key  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS index_outbox_kind_key ON index_outbox (kind, key);
`;

export function ensureOutboxSchema(sql: SqlExec): void {
  for (const statement of INDEX_OUTBOX_SCHEMA.split(';')) {
    if (statement.trim()) sql.exec(statement);
  }
}

// Queue a key, replacing an older copy of it (so the drain pushes the newest state once).
export function queueOutbox(sql: SqlExec, kind: 'summary' | 'tab', key = ''): void {
  sql.exec('DELETE FROM index_outbox WHERE kind = ? AND key = ?', kind, key);
  sql.exec('INSERT INTO index_outbox (kind, key) VALUES (?, ?)', kind, key);
}

// A person's write to the item: replaces their edit key with one at `at`. Call it after a request that wrote, so
// the edit is the person's who asked, never a guess from the content.
export function recordEditor(
  sql: SqlExec,
  personId: string,
  at: number,
  table = 'index_outbox',
): void {
  const [from, to] = editKeyRange(personId);
  sql.exec(`DELETE FROM ${table} WHERE kind = 'edit' AND key >= ? AND key < ?`, from, to);
  sql.exec(`INSERT INTO ${table} (kind, key) VALUES ('edit', ?)`, editKeyOf(personId, at));
}

export function outboxPending(sql: SqlExec): boolean {
  return sql.exec('SELECT 1 FROM index_outbox LIMIT 1').toArray().length > 0;
}

// Read, push and clear: one drain of `index_outbox`. Throws the first failure after clearing what was pushed.
export async function drainOutboxTable(
  sql: SqlExec,
  itemId: string,
  client: IndexAppClient | null,
  source: OutboxSource,
): Promise<{ keys: number; pushes: number; more: boolean }> {
  const rows = sql
    .exec('SELECT id, kind, key FROM index_outbox ORDER BY id')
    .toArray() as unknown as OutboxRow[];
  const outcome = await drainIndexOutbox(itemId, rows, client, source);
  if (outcome.done.length > 0) {
    sql.exec(
      'DELETE FROM index_outbox WHERE id IN (SELECT value FROM json_each(?))',
      JSON.stringify(outcome.done),
    );
  }
  if (outcome.failures.length > 0) throw outcome.failures[0];
  return { keys: outcome.done.length, pushes: outcome.pushes, more: outcome.more };
}
