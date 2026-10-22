// What a tab has to draw (docs/specs/006-document/document-snapshots.md "An empty document is never asked for"): its
// elements, and its form when it holds one. A Form tab's form is not an element, so
// counting elements alone read a form as an empty tab: no Explorer snapshot. The api stores it as
// `tabs.element_count`; the editor's own Explorer row and an offline document's row read it the same way.
export function drawnCount(tab: { elements?: unknown; form?: unknown }): number {
  const elements = Array.isArray(tab.elements) ? tab.elements.length : 0;
  const form = tab.form !== null && typeof tab.form === 'object' && !Array.isArray(tab.form);
  return elements + (form ? 1 : 0);
}
