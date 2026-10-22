// The open edit of a sheet, focused again (docs/specs/029-sheets/sheet.md "Formula bar"): the cell's editor or the
// formula bar's field, whichever holds it (one at a time, both marked `data-sheet-editor`). Used where focus left the
// edit while it stays open: a formula it cannot save keeps it, and the keys after belong to it.
export function focusOpenEdit(sheetId: string): boolean {
  const el = document.querySelector<HTMLTextAreaElement>(
    `textarea[data-sheet-editor="${sheetId}"]`,
  );
  if (!el) return false;
  el.focus({ preventScroll: true });
  return true;
}
