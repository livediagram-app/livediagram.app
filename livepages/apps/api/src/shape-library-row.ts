import type { ShapeLibrary, ShapeLibraryItem, ShapeLibrarySource } from '@livediagram/api-schema';

// shape_libraries row shape as read from D1 (migration 0060). The `items` column is a JSON string
// (the validated item list); every read parses it here so the rest of the worker handles a
// structured list. Its own module, like custom-theme-row.ts, so the mapping has its own tests.

export type ShapeLibraryRow = {
  id: string;
  owner_id: string;
  name: string;
  source: string;
  items: string;
  created_at: number;
  updated_at: number;
};

// A row whose items fail to parse reads as a library with none: one bad row must not fail the list.
function parseItems(id: string, json: string): ShapeLibraryItem[] {
  try {
    const items: unknown = JSON.parse(json);
    if (Array.isArray(items)) return items as ShapeLibraryItem[];
  } catch {
    // Logged below, once for either failure.
  }
  console.warn('[shape-libraries] corrupt items', { id });
  return [];
}

export function rowToShapeLibrary(row: ShapeLibraryRow): ShapeLibrary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    source: row.source as ShapeLibrarySource,
    items: parseItems(row.id, row.items),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
