import type { BoxedElement } from './index';

// The one-line name a boxed element goes by in a LIST of elements: the
// Collaborate Panel's rows (docs/specs/012-collaboration/assigned-actions.md §5) and the Activity page's rows
// (docs/specs/013-workspace/activity-page.md), both of which name the element an action or comment
// thread hangs off. Shared so the in-editor panel and the api worker's
// collaboration index cannot disagree on what a row is called.
//
// Tables have no single label (the cells carry the text), so they are
// described as "Table" plus the first non-empty cell rather than a
// stray fallback. Everything else uses its label, or "Untitled" when
// that is blank so a row never reads as empty.
export function elementDisplayLabel(el: BoxedElement): string {
  if (el.type === 'table') {
    const firstCell = el.cells.flat().find((c) => c.trim().length > 0);
    return firstCell ? `Table: ${firstCell.trim()}` : 'Table';
  }
  const label = (el as { label?: string }).label;
  return label && label.trim().length > 0 ? label.trim() : 'Untitled';
}
