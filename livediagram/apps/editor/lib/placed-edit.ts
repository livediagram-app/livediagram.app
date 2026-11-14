// The label editor a placement opened (docs/specs/008-canvas/canvas-and-palette.md "Labels"): a palette drop, or an
// event-storming board's next note, puts the new element straight into typing, since the drag already said what and
// where. Escape out of that editor before anything is typed leaves the selection too, as Escape does after any other
// placement: the open editor was the placement's doing, not a layer the person stepped into, so one Escape takes them
// back to nothing selected and the tool keys (V, R, ...) work again instead of typing into the new label.
//
// One mark for the whole page: only one label editor is ever open, and the mark is keyed by the element's id, so a
// commit of any other element never reads it. Escape tells the commit it is the reason through `leaveByEscape`,
// which runs the editor's synchronous commit inside it.

let placed: string | null = null;
let escaping = false;

/** The element whose editor a placement just opened. */
export function markPlacedEdit(id: string): void {
  placed = id;
}

/** Runs the editor's commit as Escape leaving it. */
export function leaveByEscape(commit: () => void): void {
  escaping = true;
  try {
    commit();
  } finally {
    escaping = false;
  }
}

/** Whether this commit of `id` is Escape leaving the editor a placement opened; the mark goes with any commit of it. */
export function takeEscapedPlacedEdit(id: string): boolean {
  if (placed !== id) return false;
  placed = null;
  return escaping;
}
