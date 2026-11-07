import type { BoxedElement } from './index';
import { isRetiredElement, retiredElementName } from './retired-kinds';

// The one-line name a boxed element goes by in a LIST of elements: the
// Collaborate Panel's rows (docs/specs/012-collaboration/assigned-actions.md §5) and the Inbox's rows
// (docs/specs/013-workspace/inbox.md), both of which name the element an action or comment
// thread hangs off. Shared so the in-editor panel and the api worker's
// collaboration index cannot disagree on what a row is called.
//
// An element uses its label, or "Untitled" when that is blank so a row never reads as empty.
export function elementDisplayLabel(el: BoxedElement): string {
  const label = (el as { label?: string }).label;
  if (label && label.trim().length > 0) return label.trim();
  // An unlabelled retired element (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements") is named
  // by what it was, as its placeholder names it, rather than "Untitled": a retired shape kind or type alike (a stored
  // table reads "Table").
  if (isRetiredElement(el)) return retiredElementName(el);
  return 'Untitled';
}
