// items: a project's item store (docs/specs/026-plan/items.md, blueprint item-store.md
// "Data and persistence"). Every write raises the project's `items_rev` in the same batch, so the
// room op carries one store revision per write; an update is guarded by the item's own `rev`.

import { isSafeColourValue } from '@liveplanner/project';
import type { Item, ItemPerson } from '@liveplanner/items';
import type { PlanEnv } from '../types';

type ItemRow = {
  id: string;
  type: string;
  item_key: number;
  rank: string;
  fields: string;
  rev: number;
  created_at: number;
  updated_at: number;
  created_by: string;
  updated_by: string;
};

const COLUMNS =
  'id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by';

const UNKNOWN_PERSON: ItemPerson = { id: '', name: 'Someone', color: '#94a3b8' };

function parsePerson(text: string): ItemPerson {
  try {
    const p = JSON.parse(text) as Partial<ItemPerson>;
    // A colour stored before participant colours were checked is read as none (unsafe-colours.ts).
    return typeof p.id === 'string' &&
      typeof p.name === 'string' &&
      typeof p.color === 'string' &&
      isSafeColourValue(p.color)
      ? { id: p.id, name: p.name, color: p.color }
      : UNKNOWN_PERSON;
  } catch {
    return UNKNOWN_PERSON;
  }
}

function parseFields(text: string): Item['fields'] {
  try {
    const f: unknown = JSON.parse(text);
    return f && typeof f === 'object' && !Array.isArray(f) ? (f as Item['fields']) : {};
  } catch {
    return {};
  }
}

function itemFromRow(row: ItemRow): Item {
  return {
    id: row.id,
    type: row.type,
    key: row.item_key,
    rank: row.rank,
    fields: parseFields(row.fields),
    rev: row.rev,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: parsePerson(row.created_by),
    updatedBy: parsePerson(row.updated_by),
  };
}

type ItemStoreHead = { rev: number; nextKey: number; count: number };

export async function getItemStoreHead(env: PlanEnv, projectId: string): Promise<ItemStoreHead> {
  const row = await env.PLAN_DB.prepare(
    `SELECT d.items_rev AS rev, d.items_next_key AS next_key,
            (SELECT COUNT(*) FROM items i WHERE i.plan_id = d.id) AS count
       FROM plan d WHERE d.id = ?`,
  )
    .bind(projectId)
    .first<{ rev: number; next_key: number; count: number }>();
  return { rev: row?.rev ?? 0, nextKey: row?.next_key ?? 1, count: row?.count ?? 0 };
}

// The store's revision alone: what a read needs, without the head's count.
export async function getItemsRev(env: PlanEnv, projectId: string): Promise<number> {
  const row = await env.PLAN_DB.prepare(`SELECT items_rev AS rev FROM plan WHERE id = ?`)
    .bind(projectId)
    .first<{ rev: number }>();
  return row?.rev ?? 0;
}

export async function listItems(env: PlanEnv, projectId: string): Promise<Item[]> {
  const res = await env.PLAN_DB.prepare(`SELECT ${COLUMNS} FROM items WHERE plan_id = ?`)
    .bind(projectId)
    .all<ItemRow>();
  return (res.results ?? []).map(itemFromRow);
}

export async function readItem(env: PlanEnv, projectId: string, id: string): Promise<Item | null> {
  const row = await env.PLAN_DB.prepare(`SELECT ${COLUMNS} FROM items WHERE plan_id = ? AND id = ?`)
    .bind(projectId, id)
    .first<ItemRow>();
  return row ? itemFromRow(row) : null;
}

// The items of `ids` that exist, in no set order: one query however many (the ids as one JSON parameter).
export async function readItems(env: PlanEnv, projectId: string, ids: string[]): Promise<Item[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT ${COLUMNS} FROM items WHERE plan_id = ? AND id IN (SELECT value FROM json_each(?))`,
  )
    .bind(projectId, JSON.stringify(ids))
    .all<ItemRow>();
  return (res.results ?? []).map(itemFromRow);
}

// Every card write raises the store's rev and marks the project saved (`saved_at`), as a tab write does: a card is
// part of the project, so the Explorer's "Updated" line, its snapshot (docs/specs/006-project/project-snapshots.md:
// a board draws its cards) both follow it. Both in the projects statement the write runs anyway.
const SAVED = 'saved_at = MAX(saved_at, ?)';

function bumpRev(env: PlanEnv, projectId: string, nextKey?: number): D1PreparedStatement {
  const now = Date.now();
  return nextKey === undefined
    ? env.PLAN_DB.prepare(
        `UPDATE plan SET items_rev = items_rev + 1, ${SAVED} WHERE id = ? RETURNING items_rev`,
      ).bind(now, projectId)
    : env.PLAN_DB.prepare(
        `UPDATE plan SET items_rev = items_rev + 1, items_next_key = MAX(items_next_key, ?), ${SAVED}
          WHERE id = ? RETURNING items_rev`,
      ).bind(nextKey, now, projectId);
}

function insertStatement(env: PlanEnv, projectId: string, item: Item): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    `INSERT INTO items (plan_id, ${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    projectId,
    item.id,
    item.type,
    item.key,
    item.rank,
    JSON.stringify(item.fields),
    item.rev,
    item.createdAt,
    item.updatedAt,
    JSON.stringify(item.createdBy),
    JSON.stringify(item.updatedBy),
  );
}

function revOf(result: D1Result | undefined): number {
  const row = (result?.results as { items_rev?: number }[] | undefined)?.[0];
  return row?.items_rev ?? 0;
}

// Inserts new items (their keys already chosen) and returns the store's new rev. Throws on a
// primary-key or key collision; the caller maps it to 409.
export async function insertItems(env: PlanEnv, projectId: string, items: Item[]): Promise<number> {
  const maxKey = Math.max(...items.map((i) => i.key));
  const results = await env.PLAN_DB.batch([
    bumpRev(env, projectId, maxKey + 1),
    ...items.map((i) => insertStatement(env, projectId, i)),
  ]);
  return revOf(results[0]);
}

// Writes `next` over the row stored at `expectedRev`. Returns the store's new rev, or null when
// the row moved on (or went) since it was read.
export async function updateItemAtRev(
  env: PlanEnv,
  projectId: string,
  next: Item,
  expectedRev: number,
): Promise<number | null> {
  const results = await env.PLAN_DB.batch([
    updateAtRevStatement(env, projectId, next, expectedRev),
    // Raises the store rev only when the guarded update landed.
    env.PLAN_DB.prepare(
      `UPDATE plan SET items_rev = items_rev + 1, ${SAVED}
        WHERE id = ? AND changes() > 0 RETURNING items_rev`,
    ).bind(Date.now(), projectId),
  ]);
  if ((results[0]?.meta?.changes ?? 0) === 0) return null;
  return revOf(results[1]);
}

// Writes each `next` over its row stored at `expectedRev`, in one batch with one rev raise. Returns the store's
// new rev and the ids that landed; an id missing from `landed` moved on (or went) since it was read. The rev is
// raised even when none landed: the caller then retries, and a collaborator who saw the gap refetches.
export async function updateItemsAtRev(
  env: PlanEnv,
  projectId: string,
  writes: { next: Item; expectedRev: number }[],
): Promise<{ rev: number; landed: Set<string> }> {
  const results = await env.PLAN_DB.batch([
    ...writes.map((w) => updateAtRevStatement(env, projectId, w.next, w.expectedRev)),
    bumpRev(env, projectId),
  ]);
  const landed = new Set(
    writes.filter((_, i) => (results[i]?.meta?.changes ?? 0) > 0).map((w) => w.next.id),
  );
  return { rev: revOf(results[writes.length]), landed };
}

function updateAtRevStatement(
  env: PlanEnv,
  projectId: string,
  next: Item,
  expectedRev: number,
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    `UPDATE items SET type = ?, rank = ?, fields = ?, rev = ?, updated_at = ?, updated_by = ?
      WHERE plan_id = ? AND id = ? AND rev = ?`,
  ).bind(
    next.type,
    next.rank,
    JSON.stringify(next.fields),
    next.rev,
    next.updatedAt,
    JSON.stringify(next.updatedBy),
    projectId,
    next.id,
    expectedRev,
  );
}

// Returns the store's new rev and the item as it was deleted (its comments retract from the Timeline,
// docs/specs/013-workspace/timeline.md §4.3), or null when there was no such item. The item is read
// by the delete itself, so a comment written a moment before cannot slip between a read and it.
export async function deleteItemRow(
  env: PlanEnv,
  projectId: string,
  id: string,
): Promise<{ rev: number; item: Item } | null> {
  const results = await env.PLAN_DB.batch([
    env.PLAN_DB.prepare(`DELETE FROM items WHERE plan_id = ? AND id = ? RETURNING ${COLUMNS}`).bind(
      projectId,
      id,
    ),
    env.PLAN_DB.prepare(
      `UPDATE plan SET items_rev = items_rev + 1, ${SAVED}
        WHERE id = ? AND changes() > 0 RETURNING items_rev`,
    ).bind(Date.now(), projectId),
  ]);
  const row = (results[0]?.results as ItemRow[] | undefined)?.[0];
  if (!row) return null;
  return { rev: revOf(results[1]), item: itemFromRow(row) };
}

// A project copy takes the items with it, ids and keys unchanged, so every card on the copied
// tabs still finds its item (docs/specs/026-plan/items.md "Copies and exports"). `onlyIds` limits
// a tab-scoped visitor's copy to the items their tab shows.
export function copyItemsStatements(
  env: PlanEnv,
  sourceId: string,
  targetId: string,
  onlyIds: readonly string[] | null,
): D1PreparedStatement[] {
  const filter = onlyIds === null ? '' : ` AND id IN (SELECT value FROM json_each(?))`;
  const binds: unknown[] = [
    targetId,
    sourceId,
    ...(onlyIds === null ? [] : [JSON.stringify(onlyIds)]),
  ];
  return [
    env.PLAN_DB.prepare(
      `INSERT INTO items (plan_id, ${COLUMNS})
       SELECT ?, ${COLUMNS} FROM items WHERE plan_id = ?${filter}`,
    ).bind(...binds),
    env.PLAN_DB.prepare(
      `UPDATE plan SET
         items_rev = (SELECT items_rev FROM plan WHERE id = ?2),
         items_next_key = (SELECT items_next_key FROM plan WHERE id = ?2)
       WHERE id = ?1`,
    ).bind(targetId, sourceId),
  ];
}
