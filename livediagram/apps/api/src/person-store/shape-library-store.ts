// Shape libraries in a person's store (docs/specs/013-workspace/shape-libraries.md): the reads and writes the
// PersonStore's RPCs run, over its SQLite. Every row is the one person's, so nothing here filters by owner; the
// owner id a library reports is the store's person, passed in.

import {
  uniqueLibraryName,
  type ShapeLibrary,
  type ShapeLibraryItem,
  type ShapeLibrarySource,
} from '@livediagram/api-schema';
import type { DocumentSql } from '../document-room/document-db';
import { rowToShapeLibrary, type ShapeLibraryRow } from '../shape-library-row';

const COLS = 'id, name, source, items, created_at, updated_at';

function rowOf(ownerId: string, row: Record<string, unknown>): ShapeLibrary {
  return rowToShapeLibrary({ ...(row as Omit<ShapeLibraryRow, 'owner_id'>), owner_id: ownerId });
}

export function listLibraries(sql: DocumentSql, ownerId: string): ShapeLibrary[] {
  return sql
    .exec(`SELECT ${COLS} FROM shape_libraries ORDER BY created_at DESC, id`)
    .toArray()
    .map((row) => rowOf(ownerId, row));
}

export function getLibrary(sql: DocumentSql, ownerId: string, id: string): ShapeLibrary | null {
  const row = sql.exec(`SELECT ${COLS} FROM shape_libraries WHERE id = ?`, id).toArray()[0];
  return row ? rowOf(ownerId, row) : null;
}

// The names in use, oldest first (for the cap and the clash rule).
export function libraryNames(sql: DocumentSql): string[] {
  return sql
    .exec('SELECT name FROM shape_libraries ORDER BY created_at, id')
    .toArray()
    .map((row) => String(row.name));
}

export type NewShapeLibrary = {
  id: string;
  name: string;
  source: ShapeLibrarySource;
  items: ShapeLibraryItem[];
};

export function createLibrary(
  sql: DocumentSql,
  ownerId: string,
  lib: NewShapeLibrary,
  now: number,
): ShapeLibrary {
  sql.exec(
    `INSERT INTO shape_libraries (id, name, source, items, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    lib.id,
    lib.name,
    lib.source,
    JSON.stringify(lib.items),
    now,
    now,
  );
  return { ...lib, ownerId, createdAt: now, updatedAt: now };
}

// Partial: an absent field is left alone.
export function updateLibrary(
  sql: DocumentSql,
  id: string,
  patch: { name?: string; items?: ShapeLibraryItem[] },
  now: number,
): void {
  if (patch.name !== undefined) {
    sql.exec(
      'UPDATE shape_libraries SET name = ?, updated_at = ? WHERE id = ?',
      patch.name,
      now,
      id,
    );
  }
  if (patch.items !== undefined) {
    sql.exec(
      'UPDATE shape_libraries SET items = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(patch.items),
      now,
      id,
    );
  }
}

// Placed shapes are ordinary elements in their canvases: nothing to cascade. Answers whether it was there.
export function deleteLibrary(sql: DocumentSql, id: string): boolean {
  if (sql.exec('SELECT 1 FROM shape_libraries WHERE id = ?', id).toArray().length === 0)
    return false;
  sql.exec('DELETE FROM shape_libraries WHERE id = ?', id);
  return true;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// A create as the route asks for it, decided in one go inside the store (nothing else runs between the checks and
// the write): refused at the cap or for an id in use; otherwise made under the first free form of its name.
export function createLibraryChecked(
  sql: DocumentSql,
  ownerId: string,
  lib: NewShapeLibrary,
  cap: number,
  now: number,
): ShapeLibrary | 'cap' | 'exists' {
  const taken = libraryNames(sql);
  if (taken.length >= cap) return 'cap';
  if (sql.exec('SELECT 1 FROM shape_libraries WHERE id = ?', lib.id).toArray().length > 0) {
    return 'exists';
  }
  return createLibrary(sql, ownerId, { ...lib, name: uniqueLibraryName(lib.name, taken) }, now);
}

// An update as the route asks for it: a rename refused when another of the person's libraries has the name.
export function updateLibraryChecked(
  sql: DocumentSql,
  ownerId: string,
  id: string,
  patch: { name?: string; items?: ShapeLibraryItem[] },
  now: number,
): ShapeLibrary | 'not_found' | 'name_taken' {
  const existing = getLibrary(sql, ownerId, id);
  if (!existing) return 'not_found';
  if (patch.name !== undefined) {
    const name = patch.name;
    const others = libraryNames(sql).filter((n) => !sameName(n, existing.name));
    if (others.some((n) => sameName(n, name))) return 'name_taken';
  }
  updateLibrary(sql, id, patch, now);
  return getLibrary(sql, ownerId, id) ?? existing;
}

// A guest's libraries, as their store hands them to the account they sign in to (person-store.ts `adopt`).
export type LibraryRecord = {
  id: string;
  name: string;
  source: string;
  items: string;
  createdAt: number;
  updatedAt: number;
};

export function exportLibraries(sql: DocumentSql): LibraryRecord[] {
  return sql
    .exec(`SELECT ${COLS} FROM shape_libraries ORDER BY created_at, id`)
    .toArray()
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      source: String(row.source),
      items: String(row.items),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    }));
}

// The guest's libraries join the account's: one whose name the account already uses takes the next free " (n)"
// first, so the account never holds two libraries of one name. The cap applies to creates, never to this move. A
// library id already here (the same guest signing in twice) keeps the account's copy.
export function importLibraries(
  sql: DocumentSql,
  records: readonly LibraryRecord[],
): { moved: number; renamed: number } {
  const taken = libraryNames(sql);
  let moved = 0;
  let renamed = 0;
  for (const record of records) {
    if (sql.exec('SELECT 1 FROM shape_libraries WHERE id = ?', record.id).toArray().length > 0) {
      continue;
    }
    const name = uniqueLibraryName(record.name, taken);
    taken.push(name);
    if (name !== record.name) renamed++;
    sql.exec(
      `INSERT INTO shape_libraries (id, name, source, items, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      record.id,
      name,
      record.source,
      record.items,
      record.createdAt,
      record.updatedAt,
    );
    moved++;
  }
  return { moved, renamed };
}
