import { migrateStoredTab, parseTabIcon, parseTabParent, type Tab } from '@liveknowledge/document';
import { parseKnowledgeFields } from '@liveknowledge/knowledge';
import { storedTabConnection } from '@liveworkspace/index-app';
import type { TabDTO, TabSummaryDTO } from './types';

// tabs row shape as read from the document's SQLite. The `data` column is the
// JSON-serialised Tab body, MINUS the `id` and `name` fields, which
// live as real columns alongside the document link's `order_index` and
// the tab's `updated_at`; the parser below reassembles the canonical Tab shape.

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
  // A connected tab's connection (liveworkspace/docs/specs/004-index/connected-tabs.md), `tabs.connection`: JSON of
  // `{ id, app, itemId }`, or NULL for every other tab. Read sites that don't select it leave it undefined.
  connection?: string | null;
  // The page this one sits under (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree"), read out
  // of the body by the outline alone (`json_extract(data, '$.parent')`), so the tree draws from the summaries. Read
  // sites that do not select it leave it undefined.
  parent?: unknown;
  // The page's knowledge fields (docs/specs/030-knowledgebase/verification.md "The fields"), read out of the body by
  // the outline alone (`json_extract(data, '$.knowledge')`, JSON text), so the page tree shows each page's verified
  // state from the summaries, with no read per row. Read sites that do not select it leave it undefined.
  knowledge?: unknown;
  // The page's icon (docs/specs/030-knowledgebase/page-surface.md "The page icon"), read out of the body by the
  // outline alone (`json_extract(data, '$.icon')`, JSON text), so the page tree shows each page's icon from the
  // summaries. Read sites that do not select it leave it undefined.
  icon?: unknown;
};

// The connection a row carries, as the wire shape spreads it: absent for a tab that is not connected.
function connectionField(row: TabRow) {
  const connection = storedTabConnection(row.connection);
  return connection ? { connection } : {};
}

// The parent a row carries: absent at the top level, and for anything stored there that is not an id.
function parentField(row: TabRow) {
  const parent = parseTabParent(row.parent);
  return parent === undefined ? {} : { parent };
}

// The knowledge fields a row carries: absent for a page with none, and for anything stored there that is not them.
function knowledgeField(row: TabRow) {
  if (typeof row.knowledge !== 'string') return {};
  try {
    const knowledge = parseKnowledgeFields(JSON.parse(row.knowledge));
    return Object.keys(knowledge).length > 0 ? { knowledge } : {};
  } catch {
    return {};
  }
}

// The icon a row carries: absent for a page with none, and for anything stored there that is not one.
function iconField(row: TabRow) {
  if (typeof row.icon !== 'string') return {};
  try {
    const icon = parseTabIcon(JSON.parse(row.icon));
    return icon ? { icon } : {};
  } catch {
    return {};
  }
}

// Pure mapper from a stored tab row to the wire-format DTO. Pulled out of db.ts
// so the JSON.parse + camelCase reassembly contract has a test surface
// of its own without dragging the rest of the storage module along (same
// pattern as share-link-row.ts, folder-row.ts).
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
  // Every tab read passes through here, so this is where stored tabs are settled
  // (docs/specs/011-theme/retired-schemes.md "Where a stored tab is settled"): malformed or older-shaped tab
  // and element fields. The same object for any other tab.
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
    ...parentField(row),
    ...knowledgeField(row),
    ...iconField(row),
    ...connectionField(row),
  };
}
