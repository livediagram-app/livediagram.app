import { useSyncExternalStore } from 'react';
import { createListeners } from '@/lib/listeners';

// Whether one of the palette's popovers is open: a category's flyout, More or Search
// (docs/specs/007-editor/start-diagramming.md "When it shows"). The template start steps aside while one is, so the
// tiles hang over a clear canvas. A module store, like the active tour: one editor per page.
let open = false;
const listeners = createListeners();

export function palettePopoverOpen(): boolean {
  return open;
}

export function setPalettePopoverOpen(next: boolean): void {
  if (next === open) return;
  open = next;
  listeners.notify();
}

export function usePalettePopoverOpen(): boolean {
  return useSyncExternalStore(listeners.subscribe, palettePopoverOpen, () => false);
}
