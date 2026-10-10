// The formula being written right now, so a click on another Sheet of the same tab can put that sheet's cell in
// it (docs/specs/029-sheets/sheet.md "Writing formulas": "A reference to a cell of another sheet on the tab is made
// by clicking that sheet's cells while writing"). One at a time: only one editor has the caret.
export type PointInto = (
  from: { r: number; c: number },
  to: { r: number; c: number },
  sheetTitle: string,
) => boolean;

// `refocus` hands the caret back to the formula once the pointing is done.
type Target = { sheetId: string; tabId: string; point: PointInto; refocus: () => void };

let target: Target | null = null;

export function setPointingTarget(next: Target): void {
  target = next;
}

// Only the sheet that set it clears it (another may have taken over since).
export function clearPointingTarget(sheetId: string): void {
  if (target?.sheetId === sheetId) target = null;
}

// The formula another sheet of `tabId` is writing, if any.
export function pointingTargetFor(sheetId: string, tabId: string): Target | null {
  return target && target.sheetId !== sheetId && target.tabId === tabId ? target : null;
}
