import { useSyncExternalStore } from 'react';
import { createListeners } from './listeners';

// Which tab pill is mid-drag, for surfaces outside the tab bar that answer the drag: the side by
// side drop zone (docs/specs/007-editor/split-view.md). The tab bar's HTML5 drag owns the gesture;
// this only mirrors its start and end, so a listener elsewhere on the page knows a tab (and which
// one) is in flight without reading dataTransfer, which the browser hides until drop.
//
// The pill's own dragend is not enough to end it: a drop that moves the pill (into a tab folder,
// whose group re-parents it) unmounts the element the browser reports dragend to, so that event
// never reaches the page. While a drag is live the document listens for its end however it comes:
// a drop anywhere, a dragend that does reach the page, Escape, or a press after a cancelled drag
// (the browser sends no pointer events mid-drag, so the next press means the drag is over). The
// listeners go the moment the drag ends, so nothing listens between drags.

let draggedTabId: string | null = null;
const listeners = createListeners();

const end = () => setDraggedTab(null);
const onKeyDown = (e: Event) => {
  if ((e as KeyboardEvent).key === 'Escape') end();
};

// Bubble for drop and dragend so the drop target's own handler (the side by side zone's opens the
// tab) runs before the zone unmounts; capture for the press and Escape so nothing that stops them
// can hide the end.
function listen(on: boolean): void {
  const method = on ? 'addEventListener' : 'removeEventListener';
  document[method]('drop', end);
  document[method]('dragend', end);
  document[method]('pointerdown', end, true);
  document[method]('keydown', onKeyDown, true);
}

export function setDraggedTab(tabId: string | null): void {
  if (draggedTabId === tabId) return;
  const was = draggedTabId;
  draggedTabId = tabId;
  if ((was === null) !== (tabId === null)) listen(tabId !== null);
  listeners.notify();
}

function getDraggedTab(): string | null {
  return draggedTabId;
}

export function useDraggedTab(): string | null {
  return useSyncExternalStore(listeners.subscribe, getDraggedTab, () => null);
}
