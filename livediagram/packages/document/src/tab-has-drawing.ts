// Whether a tab has anything to draw where it is shown away from its own canvas (the split view's other pane, a
// Dashboard's Diagram slot): elements or a form. Without, those say the tab has nothing on it yet. Pure.
import { tabKindOf } from './tab-kind';

export function tabHasDrawing(tab: {
  kind?: string;
  elements: readonly unknown[];
  form?: unknown;
}): boolean {
  if (tab.elements.length > 0) return true;
  return tabKindOf(tab) === 'form' && tab.form != null;
}
