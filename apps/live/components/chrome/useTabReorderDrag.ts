import { useState, type DragEvent as ReactDragEvent } from 'react';

// The tab bar's drag-reorder machinery (spec/30), lifted out of
// TabBar's pill renderer: which pill is being dragged, which pill +
// side the pointer is over (driving the insertion caret), and the five
// drag handlers each pill mounts. Deterministic drop: the side comes
// from the pointer's position within the pill, so the caret sits
// exactly where the tab will land.
export function useTabReorderDrag(
  onReorder: (sourceId: string, targetId: string, placeBefore?: boolean) => void,
) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: 'before' | 'after' } | null>(
    null,
  );

  // The insertion caret to show on this pill: the side the dragged tab
  // will land, or null when this pill isn't the current drop target.
  const caretFor = (tabId: string): 'before' | 'after' | null =>
    dropTarget?.id === tabId && dragId != null && dragId !== tabId ? dropTarget.side : null;

  const handlersFor = (tabId: string) => ({
    onDragStart: (e: ReactDragEvent) => {
      e.dataTransfer.setData('text/plain', tabId);
      e.dataTransfer.effectAllowed = 'move';
      setDragId(tabId);
    },
    onDragOver: (e: ReactDragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragId === tabId) return;
      // Pick the side from the pointer's position within the pill so the
      // insertion caret sits exactly where the tab will land.
      const rect = e.currentTarget.getBoundingClientRect();
      const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
      if (dropTarget?.id !== tabId || dropTarget.side !== side) setDropTarget({ id: tabId, side });
    },
    onDragLeave: () => {
      if (dropTarget?.id === tabId) setDropTarget(null);
    },
    onDrop: (e: ReactDragEvent) => {
      e.preventDefault();
      const src = e.dataTransfer.getData('text/plain');
      const side = dropTarget?.id === tabId ? dropTarget.side : 'before';
      if (src && src !== tabId) onReorder(src, tabId, side === 'before');
      setDragId(null);
      setDropTarget(null);
    },
    onDragEnd: () => {
      setDragId(null);
      setDropTarget(null);
    },
  });

  return { caretFor, handlersFor };
}
