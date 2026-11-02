// What an item's Durable Object owes the index (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item
// pushes"): its summary (`PUT /app/items/:id/summary`), each changed tab's comment threads and actions for the
// Inbox (`PUT /app/items/:id/collab/:tabId`), and who edited it, for the Timeline and their Most Used days
// (`PUT /app/items/:id/events`), all with the app's key.
//
// The item keeps an outbox in its own SQLite: a key per changed thing, written in the same transaction as the
// change (by triggers, or by the app's own writes), so no write path can forget one and a save makes no network call.
// The room's alarm drains it on idle, at most once a minute (`nextFlushAt`), and deletes the keys it pushed. A key
// written again meanwhile has a new id and stays for the next drain; a drain that fails keeps every key it did not
// push and retries a minute later.
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

// One drain over the outbox's rows (oldest first): up to DRAIN_TABS tabs, APP_EVENTS_MAX editors and CARD_MOVES_MAX
// card moves (one push). Without a
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
  const failures: unknown[] = [];
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
  return { done, failures, pushes: tasks.length, more: pending.length < rows.length };
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
