// What a Participant may write on a Sheet: its cells' values, never their formats (docs/specs/013-workspace/share-roles.md
// "What a Participant changes", docs/specs/029-sheets/sheet.md "Who may do what"). The editor and the api both
// read a non-Editor's cell write through this, so a paste, a fill or a cut that carries formats lands as its values.
import type { CellChange, SheetWrite } from './store';

// A cell change as sent, before validateWrite has looked at it: the api asks these questions of a write first.
const isChange = (c: unknown): c is CellChange => typeof c === 'object' && c !== null;

/** Whether a write changes any cell's format. A malformed write says no, and is refused by validateWrite. */
export function writesFormats(write: SheetWrite): boolean {
  return (
    write.kind !== 'title' &&
    Array.isArray(write.cells) &&
    write.cells.some((c) => isChange(c) && c.f !== undefined)
  );
}

/** A cells write with every format change taken out; null when nothing but formats was in it. Any other write is
 *  returned as it is (a Participant may not send one at all, which the callers refuse on their own). */
export function valuesOnly(write: SheetWrite): SheetWrite | null {
  if (write.kind !== 'cells' || !Array.isArray(write.cells)) return write;
  const cells: CellChange[] = [];
  for (const sent of write.cells) {
    // Kept as sent, so validateWrite refuses the write rather than this quietly mending it.
    if (!isChange(sent)) {
      cells.push(sent);
      continue;
    }
    const { f: _format, ...change } = sent;
    if (change.i !== undefined) cells.push(change);
  }
  return cells.length ? { kind: 'cells', cells } : null;
}
