// A path's edit mode (docs/specs/023-whiteboard/path-tool.md "Editing"): pure operations on its
// anchors, the hit test behind every press, and the rule for when the mode is open. The gesture
// (components/canvas/path/usePathEditGesture) owns the events and the commit.
import type { Element } from '@livediagram/document';

/** Edit mode is open when the element being edited is a path. */
export function isPathEditing(elements: readonly Element[], editingId: string | null): boolean {
  if (editingId === null) return false;
  return elements.some((el) => el.id === editingId && el.type === 'path');
}
