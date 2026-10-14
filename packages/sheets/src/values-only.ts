// What a Participant may write on a Sheet: its cells' values, never their formats (docs/specs/013-workspace/share-roles.md
// "What a Participant changes", docs/specs/029-sheets/sheet.md "Who may do what"). The editor and the api both
// read a non-Editor's cell write through this, so a paste, a fill or a cut that carries formats lands as its values.
import type { CellChange, SheetWrite } from './store';

/** Whether a write changes any cell's format. */
export function writesFormats(write: SheetWrite): boolean {
  return write.kind !== 'title' && (write.cells ?? []).some((c) => c.f !== undefined);
}

/** A cells write with every format change taken out; null when nothing but formats was in it. Any other write is
 *  returned as it is (a Participant may not send one at all, which the callers refuse on their own). */
export function valuesOnly(write: SheetWrite): SheetWrite | null {
  if (write.kind !== 'cells') return write;
  const cells: CellChange[] = [];
  for (const { f: _format, ...change } of write.cells) {
    if (change.i !== undefined) cells.push(change);
  }
  return cells.length ? { kind: 'cells', cells } : null;
}
