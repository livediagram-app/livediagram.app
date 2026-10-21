// Whether a tab has anything to draw where it is shown away from its own canvas (a tab window, the split view's other
// pane, a Dashboard's Diagram slot): elements, pages (a tab in Pages always has one) or a form. Without, those say the
// tab has nothing on it yet. Pure.
import { opensInOf } from './editor-mode';
import { tabKindOf } from './tab-kind';

export function tabHasDrawing(tab: {
  kind?: string;
  opensIn?: string;
  elements: readonly unknown[];
  form?: unknown;
}): boolean {
  if (tab.elements.length > 0) return true;
  if (tabKindOf(tab) === 'form') return tab.form != null;
  return opensInOf(tab) === 'pages';
}
