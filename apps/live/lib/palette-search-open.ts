import { useSyncExternalStore } from 'react';

// Whether the palette strip's Search panel is open (docs/specs/007-editor/toolbar-layout.md "Search"). The panel
// hangs under the strip where the top-centre stack (the session timer) also sits, so while it is open the stack
// stands its timer aside rather than covering the search field. A module store, like the active tour: one editor per
// page.
let open = false;
const listeners = new Set<() => void>();

export function paletteSearchOpen(): boolean {
  return open;
}

export function setPaletteSearchOpen(next: boolean): void {
  if (next === open) return;
  open = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePaletteSearchOpen(): boolean {
  return useSyncExternalStore(subscribe, paletteSearchOpen, () => false);
}
