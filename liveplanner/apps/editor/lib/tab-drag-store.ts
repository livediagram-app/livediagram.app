import { useSyncExternalStore } from 'react';
import { createListeners } from '@/lib/listeners';

// Which tab pill is mid-drag, for surfaces outside the tab bar that answer the drag: the side by
// side drop zone (docs/specs/007-editor/split-view.md). The tab bar's HTML5 drag owns the gesture;
// this only mirrors its start and end, so a listener elsewhere on the page knows a tab (and which
// one) is in flight without reading dataTransfer, which the browser hides until drop.

let draggedTabId: string | null = null;
const listeners = createListeners();

export function setDraggedTab(tabId: string | null): void {
  if (draggedTabId === tabId) return;
  draggedTabId = tabId;
  listeners.notify();
}

function getDraggedTab(): string | null {
  return draggedTabId;
}

export function useDraggedTab(): string | null {
  return useSyncExternalStore(listeners.subscribe, getDraggedTab, () => null);
}
