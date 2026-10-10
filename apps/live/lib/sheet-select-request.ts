// Selecting a cell of a Sheet from outside it (the Plan tour's Formulas step, docs/specs/026-plan/plan-tour.md
// "Spreadsheets"): a drawn Sheet listens for its sheet id, and a request selects that cell as a click would, as the
// person's own view (nothing saved or sent). Main bundle, and tiny: the Sheet's chunk subscribes when it draws.

export type SheetCellAt = { r: number; c: number };

const listeners = new Map<string, (at: SheetCellAt) => void>();

// Called by a drawn Sheet; returns the unsubscribe.
export function listenForSheetSelect(
  sheetId: string,
  select: (at: SheetCellAt) => void,
): () => void {
  listeners.set(sheetId, select);
  return () => {
    if (listeners.get(sheetId) === select) listeners.delete(sheetId);
  };
}

// False when no Sheet of that sheet is drawn to take it.
export function requestSheetSelect(sheetId: string, at: SheetCellAt): boolean {
  const select = listeners.get(sheetId);
  if (!select) return false;
  select(at);
  return true;
}
