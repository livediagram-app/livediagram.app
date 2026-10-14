import { useEffect } from 'react';
import type { Element } from '@livediagram/document';

// An element dialog (the link picker, line data, code, Sankey Flows, Sequence, Edit Outline) is open "for" an element
// id. When that element leaves the active tab (a collaborator deletes it, an undo takes it away, the tab changes),
// its dialog stops rendering; this closes it too, so it never reopens by itself if the element comes back.
export type DialogFor = readonly [openForId: string | null, close: () => void];

export function useCloseVanishedDialogs(
  elements: readonly Element[],
  dialogs: readonly DialogFor[],
): void {
  const open = dialogs.filter(([id]) => id !== null);
  // Only the open ids drive the check, so an idle editor pays one empty scan per elements change.
  const key = open.map(([id]) => id).join('\n');
  useEffect(() => {
    if (open.length === 0) return;
    const ids = new Set(elements.map((el) => el.id));
    for (const [id, close] of open) if (!ids.has(id!)) close();
    // `open` is rebuilt every render; `key` names what it holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, key]);
}
