// Text serialisation of a Tab: the JSON snapshot, the non-visual export format the editor's Export dialog shares
// with import. It shares nothing with a rasteriser beyond the Tab data model.

import type { Tab } from './index';

// ---------------------------------------------------------------------
// File (JSON)
// ---------------------------------------------------------------------

// Wraps the Tab in a small envelope with a schema-version field so
// the import path (#11) can detect the format and forward-migrate
// across future schema breaks.
//
// `schemaVersion` is intentionally numeric + monotonic — when the
// Tab shape changes incompatibly we bump it; the import path checks
// `<= CURRENT` and either accepts or refuses with a clear error.
// 2: freehand points are packed (docs/specs/006-document/stroke-points.md); a version 1 file
// imports through the stored-tab migration, and an older editor refuses a version 2 file.
export const TAB_SCHEMA_VERSION = 2;

export type ExportedTabEnvelope = {
  schemaVersion: number;
  kind: 'livedesign.tab';
  exportedAt: number;
  tab: Tab;
};

// The JSON envelope as a string — shared by the Blob download and the
// export dialog's view/copy panel, which shows the same text
// in an editable box.
export function tabToJsonText(tab: Tab): string {
  const envelope: ExportedTabEnvelope = {
    schemaVersion: TAB_SCHEMA_VERSION,
    kind: 'livedesign.tab',
    exportedAt: Date.now(),
    tab,
  };
  return JSON.stringify(envelope, null, 2);
}

// ---------------------------------------------------------------------
// Text serialisation of a Tab
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------
