// Select All's reach (the canvas's Cmd/Ctrl+A): every element on the tab.
import type { Tab } from '@livehuddle/document';

export function selectAllIds(tab: Pick<Tab, 'elements'>): Set<string> {
  return new Set(tab.elements.map((el) => el.id));
}
