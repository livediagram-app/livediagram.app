// shape_libraries: owner-scoped named sets of reusable shapes
// (docs/specs/013-workspace/shape-libraries.md). Mirrors custom-themes.ts: flat owner-keyed rows, a
// newest-first list, a JSON column the row mapper parses.

import type { ShapeLibrary, ShapeLibraryItem, ShapeLibrarySource } from '@livediagram/api-schema';
import { rowToShapeLibrary, type ShapeLibraryRow } from '../shape-library-row';
import type { Runtime } from '../types';

const COLS = 'id, owner_id, name, source, items, created_at, updated_at';

export async function listShapeLibrariesByOwner(
  env: Runtime,
  ownerId: string,
): Promise<ShapeLibrary[]> {
  const result = await env.db
    .prepare(`SELECT ${COLS} FROM shape_libraries WHERE owner_id = ? ORDER BY created_at DESC`)
    .bind(ownerId)
    .all<ShapeLibraryRow>();
  return (result.results ?? []).map(rowToShapeLibrary);
}

export async function getShapeLibrary(env: Runtime, id: string): Promise<ShapeLibrary | null> {
  const row = await env.db
    .prepare(`SELECT ${COLS} FROM shape_libraries WHERE id = ?`)
    .bind(id)
    .first<ShapeLibraryRow>();
  return row ? rowToShapeLibrary(row) : null;
}

/** How many libraries an owner has, and their names (for the cap and the clash rule). */
export async function shapeLibraryNamesByOwner(env: Runtime, ownerId: string): Promise<string[]> {
  const result = await env.db
    .prepare('SELECT name FROM shape_libraries WHERE owner_id = ?')
    .bind(ownerId)
    .all<{ name: string }>();
  return (result.results ?? []).map((r) => r.name);
}

export async function createShapeLibrary(
  env: Runtime,
  lib: {
    id: string;
    ownerId: string;
    name: string;
    source: ShapeLibrarySource;
    items: ShapeLibraryItem[];
  },
): Promise<ShapeLibrary> {
  const now = Date.now();
  await env.db
    .prepare(
      `INSERT INTO shape_libraries (id, owner_id, name, source, items, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(lib.id, lib.ownerId, lib.name, lib.source, JSON.stringify(lib.items), now, now)
    .run();
  return { ...lib, createdAt: now, updatedAt: now };
}

export async function updateShapeLibrary(
  env: Runtime,
  id: string,
  patch: { name?: string; items?: ShapeLibraryItem[] },
): Promise<void> {
  const now = Date.now();
  // Partial: an absent field is left alone (the custom-themes semantic).
  if (patch.name !== undefined) {
    await env.db
      .prepare('UPDATE shape_libraries SET name = ?, updated_at = ? WHERE id = ?')
      .bind(patch.name, now, id)
      .run();
  }
  if (patch.items !== undefined) {
    await env.db
      .prepare('UPDATE shape_libraries SET items = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(patch.items), now, id)
      .run();
  }
}

export async function deleteShapeLibrary(env: Runtime, id: string): Promise<void> {
  // Placed shapes are ordinary elements in their documents: nothing to cascade.
  await env.db.prepare('DELETE FROM shape_libraries WHERE id = ?').bind(id).run();
}
