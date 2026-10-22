// Whether a tab has anything to draw where it is shown away from its own canvas (a tab window, the split view's other
// pane): elements, or pages (every tab has one). Pure.
import { opensInOf } from './editor-mode';

export function tabHasDrawing(tab: {
  kind?: string;
  opensIn?: string;
  elements: readonly unknown[];
}): boolean {
  if (tab.elements.length > 0) return true;
  return opensInOf(tab) === 'pages';
}
