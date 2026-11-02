// What a tab has to draw (docs/specs/006-document/document-snapshots.md "An empty document is never asked for"): its
// elements. The api stores it as `tabs.element_count`; the editor's own Explorer row and an offline document's row
// read it the same way.
export function drawnCount(tab: { elements?: unknown }): number {
  return Array.isArray(tab.elements) ? tab.elements.length : 0;
}
