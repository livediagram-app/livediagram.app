import type { TableElement } from '@livediagram/document';

export type TablePatch = Partial<
  Pick<TableElement, 'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'>
>;

// Values in a table patch: text, numbers, null, flat style objects, and arrays (one or two deep) of them.
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameValue(a[i], b[i])) return false;
    return true;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(b)) {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every((k) =>
      sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

/** True when applying `patch` to `table` would write only what is already there: the editor's blur committing
 *  the text Escape or Enter just committed, or a cell opened and left untouched. docs/specs/009-elements/
 *  table-rows-fit-text.md "One step per edit". Linear in the cells the patch carries. */
export function tablePatchChangesNothing(table: TableElement, patch: TablePatch): boolean {
  return (Object.keys(patch) as (keyof TablePatch)[]).every((k) => sameValue(table[k], patch[k]));
}
