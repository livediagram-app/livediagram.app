// Opening the editor's search panel (docs/specs/008-canvas/canvas-and-palette.md "Search panel"), the one way every
// door into it (the bottom bar, the tab menu, Cmd+K) does it. Element search walks local tab state, so it also pulls
// every not-yet-visited tab's content: best-effort and fire-and-forget, results refresh as tabs land. Cmd+K once
// opened the panel without it, so its matches missed every tab not yet opened.
export function openSearchWithPrefetch(
  setSearchOpen: (open: boolean) => void,
  loadAllTabs: () => Promise<unknown>,
): void {
  setSearchOpen(true);
  void loadAllTabs();
}
