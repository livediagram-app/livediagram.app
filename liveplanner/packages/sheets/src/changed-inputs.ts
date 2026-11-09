// Which of a write's touched cells hold a different input in `after` than in `before`
// (blueprint sheet-store.md "Client"): the cells a workbook must forget when a write lands on a view that may already
// show it. A person's own write was shown when it was made, so its answer changes no input and nothing that reads it
// is worked out again. Formats are left out: no value reads them.
import type { CellInput, Sheet } from './sheet';

function sameInput(a: CellInput | undefined, b: CellInput | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function changedInputs(before: Sheet, after: Sheet, keys: readonly string[]): string[] {
  return keys.filter(
    (key) => !sameInput(before.cells.get(key)?.input, after.cells.get(key)?.input),
  );
}
