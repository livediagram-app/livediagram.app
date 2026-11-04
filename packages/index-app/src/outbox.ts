// What an item's Durable Object owes the index (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item
// pushes"): its summary (`PUT /app/items/:id/summary`), each changed tab's comment threads and actions for the
// Inbox (`PUT /app/items/:id/collab/:tabId`), and who edited it, for the Timeline and their Most Used days
// (`PUT /app/items/:id/events`), all with the app's key.
//
// The item keeps an outbox in its own SQLite: a key per changed thing, written in the same transaction as the
// change (by triggers, or by the app's own writes), so no write path can forget one and a save makes no network call.
// The room's alarm drains it on idle, at most once a minute (`nextFlushAt`), and deletes the keys it pushed. A key
// written again meanwhile has a new id and stays for the next drain. A key whose push fails stays, counts the attempt
// and waits longer each time (a minute, doubling, at most an hour); one the index refuses for good, or one that
// failed OUTBOX_MAX_ATTEMPTS times, is parked: kept and never sent again, until a write to the same thing replaces it
// (one-explorer-contracts.md "When a push fails").
//
// Kinds: `summary` (key ''), `tab` (key: the tab id), `edit` (key: `<person>@<time>`, one per person), `card_moved`
// (key: a plan card's move as JSON, for webhooks: liveworkspace/docs/specs/004-index/webhooks.md "What it sends").

import {
  APP_EVENTS_MAX,
  CARD_MOVES_MAX,
  COLLAB_MAX_ACTIONS,
  COLLAB_MAX_THREADS,
  IndexError,
  type AppTimelineEvent,
  type CardMove,
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

// `attempts` and `retry_at` (when it may go again, ms) count a key's failed pushes; a row stored before they existed
// reads as 0, never tried.
export type OutboxRow = {
  id: number;
  kind: string;
  key: string;
  attempts?: number | null;
  retry_at?: number | null;
};

// ---------- When a push fails --------------------------------------------------------------------------------

// Pushes a key may fail before it is parked: with the waits below, about six hours of trying, so an outage of an
// afternoon heals by itself.
export const OUTBOX_MAX_ATTEMPTS = 12;
// The longest wait between two tries of a key.
export const RETRY_MAX_MS = 60 * 60_000;
// Answers that say the push itself is wrong (malformed, not this app's to write, too large, unprocessable): sending
// it again changes nothing, so its keys are parked at once. A 404 is done (the item is gone); anything else (401,
// 408, 429, 5xx, a network failure) is tried again later.
export const FINAL_STATUSES: ReadonlySet<number> = new Set([400, 403, 413, 422]);

// How long a key waits after its `attempts`-th failure: a minute, doubling, at most RETRY_MAX_MS.
export const retryDelayMs = (attempts: number): number =>
  Math.min(FLUSH_RETRY_MS * 2 ** Math.max(0, attempts - 1), RETRY_MAX_MS);

// What a failed push means for its keys: `gone` done, `final` parked, `retry` tried again after a wait. The
// index's client keeps no Retry-After, so a 429 waits its turn like any other failure.
export type PushFailureKind = 'gone' | 'final' | 'retry';
export function pushFailureOf(err: unknown): PushFailureKind {
  if (!(err instanceof IndexError)) return 'retry';
  if (err.status === 404) return 'gone';
  return FINAL_STATUSES.has(err.status) ? 'final' : 'retry';
}

// The schema step that gives an app's outbox tables (`outbox`, and tab-shares.ts's `share_outbox`) their attempt
// count and next try: plain ALTERs, so the app appends it as a versioned step of its own, which runs once. Every row
// already there reads as never tried.
export function outboxRetrySchema(tables: readonly string[] = ['outbox', 'share_outbox']): string {
  return tables
    .map(
      (table) => `
ALTER TABLE ${table} ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ${table} ADD COLUMN retry_at INTEGER NOT NULL DEFAULT 0;`,
    )
    .join('');
}

// When the earliest key the table owes may go (ms; 0 for a key never tried), or null when it owes nothing but
// parked keys. One read over the table, which holds a key per changed thing.
export function outboxDueAt(sql: SqlExec, table = 'outbox'): number | null {
  const row = sql
    .exec(`SELECT MIN(retry_at) AS due FROM ${table} WHERE attempts < ?`, OUTBOX_MAX_ATTEMPTS)
    .toArray()[0];
  return typeof row?.due === 'number' ? row.due : null;
}

// When the room drains next, after a drain (or a wake, `lastFlushAt` 0), or null when nothing is owed: on idle, at
// most once a minute, and never before the earliest key's wait is over.
export function nextOutboxFlushAt(
  sql: SqlExec,
  now: number,
  lastFlushAt: number,
  table = 'outbox',
): number | null {
  const due = outboxDueAt(sql, table);
  return due === null ? null : Math.max(nextFlushAt(now, lastFlushAt), due);
}

// After a write, with `armed` the drain the room has set (or null): the drain to set instead, or null to keep it. A
// drain set at the usual pace stays without a read; one set far off, for a key in backoff, gives way to the key
// just written, which goes at the usual pace.
export function flushAfterWrite(
  sql: SqlExec,
  armed: number | null,
  now: number,
  lastFlushAt: number,
  table = 'outbox',
): number | null {
  if (armed !== null && armed <= now + FLUSH_MIN_GAP_MS) return null;
  const at = nextOutboxFlushAt(sql, now, lastFlushAt, table);
  return at === null || (armed !== null && armed <= at) ? null : at;
}

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

// ---------- Card moves ---------------------------------------------------------------------------------------

export const CARD_MOVED_KIND = 'card_moved';

// A card's move as its outbox key: the JSON the index takes, its text cut as the index cuts it.
const CARD_TEXT_MAX = 200;
export const cardMoveKeyOf = (move: CardMove): string =>
  JSON.stringify({
    cardId: move.cardId,
    cardKey: move.cardKey,
    card: move.card.slice(0, CARD_TEXT_MAX),
    from: move.from.slice(0, CARD_TEXT_MAX),
    to: move.to.slice(0, CARD_TEXT_MAX),
    ...(move.actorName ? { actorName: move.actorName.slice(0, CARD_TEXT_MAX) } : {}),
    at: move.at,
  } satisfies CardMove);

// The move a key holds, or null for one that doesn't parse (the key is done).
export function cardMoveOf(key: string): CardMove | null {
  try {
    const m = JSON.parse(key) as Partial<CardMove> | null;
    if (
      !m ||
      typeof m.cardId !== 'string' ||
      typeof m.card !== 'string' ||
      typeof m.from !== 'string' ||
      typeof m.to !== 'string' ||
      typeof m.at !== 'number'
    )
      return null;
    return {
      cardId: m.cardId,
      cardKey: typeof m.cardKey === 'number' ? m.cardKey : null,
      card: m.card,
      from: m.from,
      to: m.to,
      ...(typeof m.actorName === 'string' ? { actorName: m.actorName } : {}),
      at: m.at,
    };
  } catch {
    return null;
  }
}

// ---------- The collab push ----------------------------------------------------------------------------------

// A tab's threads and actions capped as the index caps one push: a tab past it keeps its newest.
export function capCollabPush(push: CollabPush): CollabPush {
  return {
    ...push,
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

// A push that failed: the row ids it carried, and why.
export type OutboxFailure = { ids: number[]; error: unknown };

// `done`: the row ids pushed (or no longer pushed), to delete. `failed`: pushes that failed, whose keys stay for
// settleOutbox to count. `more`: keys were left for the next drain.
export type DrainOutcome = {
  done: number[];
  failed: OutboxFailure[];
  pushes: number;
  more: boolean;
};

async function inBatches(tasks: (() => Promise<void>)[]): Promise<void> {
  for (let i = 0; i < tasks.length; i += PUSH_CONCURRENCY) {
    await Promise.all(tasks.slice(i, i + PUSH_CONCURRENCY).map((t) => t()));
  }
}

// One drain over the outbox's rows (oldest first): up to DRAIN_TABS tabs, APP_EVENTS_MAX editors and CARD_MOVES_MAX
// card moves (one push). Without a
// client (no index configured) every key is done.
export async function drainIndexOutbox(
  itemId: string,
  rows: readonly OutboxRow[],
  client: IndexAppClient | null,
  source: OutboxSource,
): Promise<DrainOutcome> {
  if (rows.length === 0) return { done: [], failed: [], pushes: 0, more: false };
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
  const moved = new Set(
    rows
      .filter((r) => r.kind === CARD_MOVED_KIND)
      .slice(0, CARD_MOVES_MAX)
      .map((r) => r.id),
  );
  const pending = rows.filter(
    (r) =>
      (r.kind !== 'tab' || tabs.has(r.key)) &&
      (r.kind !== 'edit' || editors.has(r.id)) &&
      (r.kind !== CARD_MOVED_KIND || moved.has(r.id)),
  );
  const done: number[] = [];
  const failed: OutboxFailure[] = [];
  const tasks: (() => Promise<void>)[] = [];
  const edits: { id: number; event: AppTimelineEvent }[] = [];
  const moves: { id: number; move: CardMove }[] = [];
  let activity: Promise<void> | null = null;

  const push = (ids: number[], send: () => Promise<void>) =>
    tasks.push(async () => {
      try {
        if (client) await send();
        done.push(...ids);
      } catch (err) {
        // An item the index does not hold (never made there, or purged) takes no push: the key is done.
        if (pushFailureOf(err) === 'gone') done.push(...ids);
        else failed.push({ ids, error: err });
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
    } else if (row.kind === CARD_MOVED_KIND) {
      const move = cardMoveOf(row.key);
      if (move) moves.push({ id: row.id, move });
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
  if (moves.length > 0) {
    push(
      moves.map((m) => m.id),
      () =>
        client!.pushCardMoves(
          itemId,
          moves.map((m) => m.move),
        ),
    );
  }
  await Promise.all([inBatches(tasks), activity]);
  return { done, failed, pushes: tasks.length, more: pending.length < rows.length };
}

// ---------- Reading and settling the app's outbox ------------------------------------------------------------

// The slice of D1 (or an item's D1-shaped facade, item-db.ts) the outbox uses.
export type OutboxDb = Pick<D1Database, 'prepare' | 'batch'>;
export type OutboxTable = { table: string; itemColumn: string };

// The keys an item owes, oldest first, parked ones left out. Some may be waiting out a failure: `dueOutboxRows`
// picks the ones a drain sends now.
export async function readOutbox(
  db: OutboxDb,
  outbox: OutboxTable,
  itemId: string,
): Promise<OutboxRow[]> {
  const { table, itemColumn } = outbox;
  return (
    await db
      .prepare(
        `SELECT id, kind, key, attempts, retry_at FROM ${table}
          WHERE ${itemColumn} = ? AND attempts < ? ORDER BY id`,
      )
      .bind(itemId, OUTBOX_MAX_ATTEMPTS)
      .all<OutboxRow>()
  ).results;
}

export const dueOutboxRows = (rows: readonly OutboxRow[], now: number): OutboxRow[] =>
  rows.filter((r) => (r.attempts ?? 0) < OUTBOX_MAX_ATTEMPTS && (r.retry_at ?? 0) <= now);

// After a drain at `now`, in one batch: deletes the keys done and counts each failed key's attempt. A key then
// waits retryDelayMs; one refused for good (FINAL_STATUSES), or failed OUTBOX_MAX_ATTEMPTS times, is parked, with a
// log line. `rows` are the rows the drain sent, for their attempts so far.
export async function settleOutbox(
  db: OutboxDb,
  outbox: OutboxTable,
  itemId: string,
  rows: readonly OutboxRow[],
  outcome: { done: readonly number[]; failed: readonly OutboxFailure[] },
  now: number,
): Promise<{ retried: number; parked: number }> {
  const { table } = outbox;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const done = [...outcome.done];
  // Row ids by the attempts and next try they take, so a drain's failures are a statement or two.
  const updates = new Map<string, { attempts: number; retryAt: number; ids: number[] }>();
  let retried = 0;
  let parked = 0;
  for (const failure of outcome.failed) {
    const kind = pushFailureOf(failure.error);
    if (kind === 'gone') {
      done.push(...failure.ids);
      continue;
    }
    const parkedKinds: string[] = [];
    let waiting = 0;
    for (const id of failure.ids) {
      const attempts = kind === 'final' ? OUTBOX_MAX_ATTEMPTS : (byId.get(id)?.attempts ?? 0) + 1;
      const park = attempts >= OUTBOX_MAX_ATTEMPTS;
      const retryAt = park ? 0 : now + retryDelayMs(attempts);
      const slot = `${attempts}:${retryAt}`;
      const update = updates.get(slot) ?? { attempts, retryAt, ids: [] };
      update.ids.push(id);
      updates.set(slot, update);
      if (park) parkedKinds.push(byId.get(id)?.kind ?? 'unknown');
      else waiting++;
    }
    const error = String(failure.error);
    if (waiting > 0) console.warn('[outbox] push failed', { itemId, keys: waiting, error });
    if (parkedKinds.length > 0) {
      const reason = kind === 'final' ? 'refused' : 'attempts';
      const kinds = [...new Set(parkedKinds)];
      console.warn('[outbox] parked', { itemId, reason, kinds, keys: parkedKinds.length, error });
    }
    retried += waiting;
    parked += parkedKinds.length;
  }
  const statements: D1PreparedStatement[] = [];
  if (done.length > 0)
    statements.push(
      db
        .prepare(`DELETE FROM ${table} WHERE id IN (SELECT value FROM json_each(?))`)
        .bind(JSON.stringify(done)),
    );
  for (const u of updates.values())
    statements.push(
      db
        .prepare(
          `UPDATE ${table} SET attempts = ?, retry_at = ? WHERE id IN (SELECT value FROM json_each(?))`,
        )
        .bind(u.attempts, u.retryAt, JSON.stringify(u.ids)),
    );
  if (statements.length > 0) await db.batch(statements);
  return { retried, parked };
}

// ---------- The outbox table ----------------------------------------------------------------------------------

// The slice of `SqlStorage` the kit uses (a test hands it node:sqlite).
export type SqlExec = {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
};

// A person's write to the item, in an app's outbox table keyed by the item (`plan_id`, `document_id`, `design_id`):
// replaces the person's edit key on that item with one at `at`. Call it after a request that wrote, so the edit is
// the person's who asked, never a guess from the content.
export function recordItemEditor(
  exec: (query: string, ...bindings: (string | number)[]) => unknown,
  outbox: { table: string; itemColumn: string },
  itemId: string,
  personId: string,
  at: number,
): void {
  const { table, itemColumn } = outbox;
  const [from, to] = editKeyRange(personId);
  exec(
    `DELETE FROM ${table} WHERE ${itemColumn} = ? AND kind = 'edit' AND key >= ? AND key < ?`,
    itemId,
    from,
    to,
  );
  exec(
    `INSERT INTO ${table} (${itemColumn}, kind, key) VALUES (?, 'edit', ?)`,
    itemId,
    editKeyOf(personId, at),
  );
}
