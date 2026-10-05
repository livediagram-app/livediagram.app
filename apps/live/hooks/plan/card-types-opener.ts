// Opens the Card Types panel from elsewhere than its button (docs/specs/025-plan/item-types.md "The
// Card Types panel"): the palette's Edit Cards. The panel hangs from its cluster button, so the canvas
// chrome, which owns that button, registers how to open it; while no button is on screen (not in
// Plan mode) there is nothing to open.
let opener: (() => void) | null = null;

export function registerCardTypesOpener(open: () => void): () => void {
  opener = open;
  return () => {
    if (opener === open) opener = null;
  };
}

export function openCardTypes(): boolean {
  if (!opener) return false;
  opener();
  return true;
}
