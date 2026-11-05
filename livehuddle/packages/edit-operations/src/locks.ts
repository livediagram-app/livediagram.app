// What people have locked against change (docs/specs/024-agents/blueprints/edit-operations.md I7):
// a locked element. The tab lock is checked before any operation.

import type { ElementId, Tab } from '@livehuddle/document';
import type { LockReason } from './rejections';

// Every element of the tab that may not change, and why.
export function lockedIds(tab: Tab): Map<ElementId, LockReason> {
  const locked = new Map<ElementId, LockReason>();
  for (const el of tab.elements) if (el.locked) locked.set(el.id, { scope: 'element' });
  return locked;
}
