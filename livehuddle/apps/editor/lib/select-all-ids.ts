// Select All's reach (the canvas's Cmd/Ctrl+A): every element a press could reach, less those on
// hidden or locked layers (docs/specs/006-document/layers.md).
import type { Tab } from '@livehuddle/document';

export function selectAllIds(tab: Pick<Tab, 'elements'>, inert: ReadonlySet<string>): Set<string> {
  return new Set(tab.elements.map((el) => el.id).filter((id) => !inert.has(id)));
}
