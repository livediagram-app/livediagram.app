import { migrateLegacyGroups, type Tab } from '@livediagram/diagram';
import type { TabDTO, TabSummaryDTO } from './types';

// tabs row shape as read from D1. The `data` column is the
// JSON-serialised Tab body, MINUS the `id` and `name` fields, which
// live as real columns alongside the diagram link's `order_index` and
// the tab's `updated_at`. The split is historical (data was a single
// column on diagrams before migration 0006 and grew its own columns
// from there); the parser below reassembles the canonical Tab shape.

export type TabRow = {
  id: string;
  diagram_id: string;
  name: string;
  order_index: number;
  data: string;
  updated_at: number;
  // Per-diagram folder name from the diagram_tabs link (spec/30).
  // NULL when the tab is loose. Read sites that don't join the link
  // for folder (none today) leave it undefined, which maps the same
  // as NULL.
  folder?: string | null;
};

// Pure mapper from D1 tab row to wire-format DTO. Pulled out of db.ts
// so the JSON.parse + camelCase reassembly contract has a test surface
// of its own without dragging the rest of the D1 module along (same
// pattern as change-log-row.ts, share-link-row.ts, image-strip.ts).
//
// Critical because every tab read in the editor passes through this:
// a regression that dropped a field from the spread, swapped id with
// diagramId, or mis-cased a column would corrupt diagrams silently on
// next load (no other surface signal, the data just looks wrong).
//
// The data column carries the entire Tab body except id + name (those
// duplicate to real columns for SQL queries that don't need to parse
// JSON), so `JSON.parse(row.data)` returns an `Omit<Tab, 'id' | 'name'>`.
// Spread it first, then overwrite/extend with the row-column fields so
// a forged `data` blob can't override id / name / diagramId / orderIndex
// / updatedAt with its own values.
export function rowToTab(row: TabRow): TabDTO {
  const data = JSON.parse(row.data) as Omit<Tab, 'id' | 'name'>;
  return {
    ...data,
    // Diagrams saved while groups existed carry `groupId`s and group-pinned
    // arrow ends; every tab read passes through here, so this is where they
    // are frozen out (spec/146). A no-op, same array, for any other tab.
    ...(Array.isArray(data.elements) ? { elements: migrateLegacyGroups(data.elements) } : {}),
    id: row.id,
    name: row.name,
    diagramId: row.diagram_id,
    orderIndex: row.order_index,
    updatedAt: row.updated_at,
    // Folder is link metadata, not body content — it overrides any
    // stale `folder` a forged data blob might carry (the client
    // strips it before persisting, so it should never be in `data`).
    folder: row.folder ?? undefined,
  };
}

// Lightweight version, no JSON parse: returns just the columns the
// Explorer / TabBar need to list tabs without paying for the full
// data deserialise. Used by listTabSummariesFor in db.ts.
export function rowToTabSummary(row: TabRow): TabSummaryDTO {
  return {
    id: row.id,
    diagramId: row.diagram_id,
    name: row.name,
    orderIndex: row.order_index,
    updatedAt: row.updated_at,
    folder: row.folder ?? undefined,
  };
}
