// items (migration 0068): a document's item store (docs/specs/026-plan/items.md, blueprint item-store.md
// "Data and persistence"). Every write raises the document's `items_rev` in the same batch, so the
// room op carries one store revision per write; an update is guarded by the item's own `rev`.

import type { Item, ItemPerson } from '@livediagram/items';
import type { Env } from '../types';

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
    return typeof p.id === 'string' && typeof p.name === 'string' && typeof p.color === 'string'
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

export function itemFromRow(row: ItemRow): Item {
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

export type ItemStoreHead = { rev: number; nextKey: number; count: number };

export async function getItemStoreHead(env: Env, documentId: string): Promise<ItemStoreHead> {
  const row = await env.DB.prepare(
    `SELECT d.items_rev AS rev, d.items_next_key AS next_key,
            (SELECT COUNT(*) FROM items i WHERE i.document_id = d.id) AS count
       FROM documents d WHERE d.id = ?`,
  )
    .bind(documentId)
    .first<{ rev: number; next_key: number; count: number }>();
  return { rev: row?.rev ?? 0, nextKey: row?.next_key ?? 1, count: row?.count ?? 0 };
}

// The store's revision alone: what a read needs, without the head's count.
export async function getItemsRev(env: Env, documentId: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT items_rev AS rev FROM documents WHERE id = ?`)
    .bind(documentId)
    .first<{ rev: number }>();
  return row?.rev ?? 0;
}

export async function listItems(env: Env, documentId: string): Promise<Item[]> {
  const res = await env.DB.prepare(`SELECT ${COLUMNS} FROM items WHERE document_id = ?`)
    .bind(documentId)
    .all<ItemRow>();
  return (res.results ?? []).map(itemFromRow);
}

export async function readItem(env: Env, documentId: string, id: string): Promise<Item | null> {
  const row = await env.DB.prepare(`SELECT ${COLUMNS} FROM items WHERE document_id = ? AND id = ?`)
    .bind(documentId, id)
    .first<ItemRow>();
  return row ? itemFromRow(row) : null;
}

export async function itemKeyTaken(env: Env, documentId: string, key: number): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT 1 AS x FROM items WHERE document_id = ? AND item_key = ?',
  )
    .bind(documentId, key)
    .first<{ x: number }>();
  return row !== null;
}

function bumpRev(env: Env, documentId: string, nextKey?: number): D1PreparedStatement {
  return nextKey === undefined
    ? env.DB.prepare(
        'UPDATE documents SET items_rev = items_rev + 1 WHERE id = ? RETURNING items_rev',
      ).bind(documentId)
    : env.DB.prepare(
        `UPDATE documents SET items_rev = items_rev + 1, items_next_key = MAX(items_next_key, ?)
          WHERE id = ? RETURNING items_rev`,
      ).bind(nextKey, documentId);
}

function insertStatement(env: Env, documentId: string, item: Item): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO items (document_id, ${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    documentId,
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
export async function insertItems(env: Env, documentId: string, items: Item[]): Promise<number> {
  const maxKey = Math.max(...items.map((i) => i.key));
  const results = await env.DB.batch([
    bumpRev(env, documentId, maxKey + 1),
    ...items.map((i) => insertStatement(env, documentId, i)),
  ]);
  return revOf(results[0]);
}

// Writes `next` over the row stored at `expectedRev`. Returns the store's new rev, or null when
// the row moved on (or went) since it was read.
export async function updateItemAtRev(
  env: Env,
  documentId: string,
  next: Item,
  expectedRev: number,
): Promise<number | null> {
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE items SET type = ?, rank = ?, fields = ?, rev = ?, updated_at = ?, updated_by = ?
        WHERE document_id = ? AND id = ? AND rev = ?`,
    ).bind(
      next.type,
      next.rank,
      JSON.stringify(next.fields),
      next.rev,
      next.updatedAt,
      JSON.stringify(next.updatedBy),
      documentId,
      next.id,
      expectedRev,
    ),
    // Raises the store rev only when the guarded update landed.
    env.DB.prepare(
      `UPDATE documents SET items_rev = items_rev + 1
        WHERE id = ? AND changes() > 0 RETURNING items_rev`,
    ).bind(documentId),
  ]);
  if ((results[0]?.meta?.changes ?? 0) === 0) return null;
  return revOf(results[1]);
}

// Returns the store's new rev, or null when there was no such item.
export async function deleteItemRow(
  env: Env,
  documentId: string,
  id: string,
): Promise<number | null> {
  const results = await env.DB.batch([
    env.DB.prepare('DELETE FROM items WHERE document_id = ? AND id = ?').bind(documentId, id),
    env.DB.prepare(
      `UPDATE documents SET items_rev = items_rev + 1
        WHERE id = ? AND changes() > 0 RETURNING items_rev`,
    ).bind(documentId),
  ]);
  if ((results[0]?.meta?.changes ?? 0) === 0) return null;
  return revOf(results[1]);
}

// A document copy takes the items with it, ids and keys unchanged, so every card on the copied
// tabs still finds its item (docs/specs/026-plan/items.md "Copies and exports"). `onlyIds` limits
// a tab-scoped visitor's copy to the items their tab shows.
export function copyItemsStatements(
  env: Env,
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
    env.DB.prepare(
      `INSERT INTO items (document_id, ${COLUMNS})
       SELECT ?, ${COLUMNS} FROM items WHERE document_id = ?${filter}`,
    ).bind(...binds),
    env.DB.prepare(
      `UPDATE documents SET
         items_rev = (SELECT items_rev FROM documents WHERE id = ?2),
         items_next_key = (SELECT items_next_key FROM documents WHERE id = ?2)
       WHERE id = ?1`,
    ).bind(targetId, sourceId),
  ];
}
