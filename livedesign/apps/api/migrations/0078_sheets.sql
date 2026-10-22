-- Sheets: a document's sheet store (docs/specs/029-sheets/sheet-store.md, blueprint sheet-store.md "Data and
-- persistence"). A Sheet element on a tab names its sheet; the grid lives here, apart from the tab, so a sheet of
-- tens of thousands of cells never weighs on the tab's elements, snapshots or room.
CREATE TABLE sheets (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  -- The tab the sheet was made on, for life: tab-scoped links and references between sheets are by tab.
  tab_id TEXT NOT NULL,
  title TEXT NOT NULL,
  -- JSON SheetLayout: the row and column ids in order, sizes, hidden, freeze, merges, filter.
  layout TEXT NOT NULL,
  rev INTEGER NOT NULL,
  -- Kept in step with sheet_cells by every write, for the caps without a scan.
  cell_count INTEGER NOT NULL DEFAULT 0,
  cell_bytes INTEGER NOT NULL DEFAULT 0,
  -- Set by the daily sweep when no element frames the sheet; cleared when one does again.
  unframed_since INTEGER,
  -- The last write's own token: every statement of a write's batch checks it, so a write that lost the rev race
  -- (its guarded head update matched nothing) writes no cells even when a stale rev + 1 equals the current one.
  write_nonce TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (document_id, id)
);

CREATE INDEX sheets_tab ON sheets(document_id, tab_id);

-- One row per cell with an input or a format, by row id and column id: a row's place is only its position in the
-- layout, so inserting, moving and sorting rows rewrites no cell.
CREATE TABLE sheet_cells (
  document_id TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  col_id TEXT NOT NULL,
  input TEXT,
  format TEXT,
  PRIMARY KEY (document_id, sheet_id, row_id, col_id),
  FOREIGN KEY (document_id, sheet_id) REFERENCES sheets(document_id, id) ON DELETE CASCADE
);
