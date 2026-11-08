// Text serialisation of a Tab: the non-visual export formats (JSON snapshot and Markdown outline), shared by the
// editor's Export dialog and the CLI's export. They share nothing with a rasteriser beyond the Tab data model.

import { isBoxed, type Tab } from './index';

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
  kind: 'livehuddle.tab';
  exportedAt: number;
  tab: Tab;
};

// The JSON envelope as a string — shared by the Blob download and the
// export dialog's view/copy panel (docs/specs/020-import-export/mermaid.md), which shows the same text
// in an editable box.
export function tabToJsonText(tab: Tab): string {
  const envelope: ExportedTabEnvelope = {
    schemaVersion: TAB_SCHEMA_VERSION,
    kind: 'livehuddle.tab',
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

// Extracts every labelled boxed element into
// a markdown document. Reading order: top-to-bottom by y,
// then left-to-right by x. That matches how a person would scan the
// canvas and produces a usable export even for non-tree layouts.
//
// A stored arrow is a retired element (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
// part 4): nothing reads it, so the outline lists no connections.
// The markdown outline as a string — shared by the Blob download and the
// export dialog's view/copy panel (docs/specs/020-import-export/mermaid.md).
export function tabToMarkdownText(tab: Tab): string {
  const lines: string[] = [];
  lines.push(`# ${tab.name || 'Untitled tab'}`);
  lines.push('');

  // Use isBoxed instead of an inline kind list so a future
  // BoxedElement variant doesn't silently drop out of the markdown
  // export. The tag computation below already falls back to
  // `(<type>)` for any non-shape kind.
  const boxed = tab.elements.filter(isBoxed);
  const labelledBoxed = boxed.filter((b) => b.label && b.label.trim().length > 0);
  labelledBoxed.sort((a, b) => a.y - b.y || a.x - b.x);
  if (labelledBoxed.length > 0) {
    lines.push('## Elements');
    lines.push('');
    for (const b of labelledBoxed) {
      const tag = b.type === 'shape' ? `(${b.shape})` : `(${b.type})`;
      lines.push(`- **${b.label}** ${tag}`);
    }
    lines.push('');
  }

  if (labelledBoxed.length === 0) {
    lines.push('_No labelled content._');
  }
  return lines.join('\n');
}
