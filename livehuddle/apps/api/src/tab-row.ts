import { migrateStoredTab, type Tab } from '@livehuddle/document';
import { storedTabConnection } from '@liveworkspace/index-app';
import type { TabDTO, TabSummaryDTO } from './types';
import { tabFolderColourOf } from '@liveworkspace/api-schema/tab-folder-colour';

// tabs row shape as read from D1. The `data` column is the
// JSON-serialised Tab body, MINUS the `id` and `name` fields, which
// live as real columns alongside the document link's `order_index` and
// the tab's `updated_at`. The split is historical (data was a single
// column on diagrams before migration 0006 and grew its own columns
// from there); the parser below reassembles the canonical Tab shape.

export type TabRow = {
  id: string;
  document_id: string;
  name: string;
  order_index: number;
  data: string;
  updated_at: number;
  // The tab revision (docs/specs/024-agents/agent-changesets.md "The tab revision").
  rev: number;
  // Per-document folder name from the document_tabs link (docs/specs/006-document/tab-folders.md).
  // NULL when the tab is loose. Read sites that don't join the link
  // for folder (none today) leave it undefined, which maps the same
  // as NULL.
  folder?: string | null;
  // The folder's colour from the same link row (tab-folders.md "Folder colour"), a hue name or NULL for Automatic.
  folder_color?: string | null;
  // A connected tab's connection (liveworkspace/docs/specs/004-index/connected-tabs.md), `tabs.connection`: JSON of
  // `{ id, app, itemId }`, or NULL for every other tab. Read sites that don't select it leave it undefined.
  connection?: string | null;
};

// The folder colour a row carries: a hue name for a tab in a folder, else none (Automatic, or loose).
function folderColorField(row: TabRow): string | undefined {
  return row.folder ? tabFolderColourOf(row.folder_color) : undefined;
}

// The connection a row carries, as the wire shape spreads it: absent for a tab that is not connected.
function connectionField(row: TabRow) {
  const connection = storedTabConnection(row.connection);
  return connection ? { connection } : {};
}

// Pure mapper from D1 tab row to wire-format DTO. Pulled out of db.ts
// so the JSON.parse + camelCase reassembly contract has a test surface
// of its own without dragging the rest of the D1 module along (same
// pattern as shape-library-row.ts).
//
// Critical because every tab read in the editor passes through this:
// a regression that dropped a field from the spread, swapped id with
// documentId, or mis-cased a column would corrupt documents silently on
// next load (no other surface signal, the data just looks wrong).
//
// The data column carries the entire Tab body except id + name (those
// duplicate to real columns for SQL queries that don't need to parse
// JSON), so `JSON.parse(row.data)` returns an `Omit<Tab, 'id' | 'name'>`.
// Spread it first, then overwrite/extend with the row-column fields so
// a forged `data` blob can't override id / name / documentId / orderIndex
// / updatedAt with its own values.
export function rowToTab(row: TabRow): TabDTO {
  // Every tab read passes through here, so this is where stored tabs are
  // migrated: retired schemes (docs/specs/011-theme/retired-schemes.md) and retired element fields
  // (docs/specs/009-elements/web-components-and-no-groups.md groups). The same object for any other tab.
  const data = migrateStoredTab(JSON.parse(row.data) as Omit<Tab, 'id' | 'name'>);
  return {
    ...data,
    id: row.id,
    name: row.name,
    documentId: row.document_id,
    orderIndex: row.order_index,
    updatedAt: row.updated_at,
    rev: row.rev,
    // Folder is link metadata, not body content — it overrides any
    // stale `folder` a forged data blob might carry (the client
    // strips it before persisting, so it should never be in `data`).
    folder: row.folder ?? undefined,
    folderColor: folderColorField(row),
    // Link metadata too: a connection lives in its column, never in `data`.
    connection: undefined,
    ...connectionField(row),
  };
}

// Lightweight version, no JSON parse: returns just the columns the
// Explorer / TabBar need to list tabs without paying for the full
// data deserialise. Used by listTabSummariesFor in db.ts.
export function rowToTabSummary(row: TabRow): TabSummaryDTO {
  return {
    id: row.id,
    documentId: row.document_id,
    name: row.name,
    orderIndex: row.order_index,
    updatedAt: row.updated_at,
    folder: row.folder ?? undefined,
    folderColor: folderColorField(row),
    ...connectionField(row),
  };
}
