// Named ranges (docs/specs/029-sheets/sheet.md "Named ranges", formulas.md "Named ranges"): what a name may be, and
// finding one on a sheet or across a tab's sheets. Names are kept as given and looked up case aside.
import { RANGE_NAME_MAX, RANGE_NAMES_MAX } from './limits';
import type { RangeName, SheetLayout } from './sheet';

const NAME_SHAPE = /^[A-Za-z_][A-Za-z0-9_.]*$/;
// What a formula would read as a cell reference: A1 style (up to four letters, then a row, as the parser reads one)
// or R1C1 style.
const CELL_LIKE = /^(?:[A-Za-z]{1,4}[0-9]+|[Rr][0-9]+[Cc][0-9]+)$/;

// Why `name` cannot name a range on `layout` (`except` the name being renamed), or null when it can.
export function rangeNameProblem(
  name: string,
  layout: SheetLayout,
  except?: string,
): string | null {
  const n = name.trim();
  if (n.length === 0 || n.length > RANGE_NAME_MAX || !NAME_SHAPE.test(n))
    return 'Names start with a letter or _, then letters, digits, _ or .';
  if (/^(true|false)$/i.test(n)) return 'TRUE and FALSE cannot be names';
  if (CELL_LIKE.test(n)) return 'That reads as a cell reference';
  const others = (layout.names ?? []).filter((x) => !sameName(x.name, except ?? ''));
  if (others.some((x) => sameName(x.name, n))) return 'Another range on this sheet is called that';
  if (others.length >= RANGE_NAMES_MAX) return `A sheet holds up to ${RANGE_NAMES_MAX} names`;
  return null;
}

export const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function findRangeName(layout: SheetLayout, name: string): RangeName | undefined {
  return layout.names?.find((x) => sameName(x.name, name));
}

// The sheet a name reads (formulas.md "Named ranges"): the formula's own when it has it, else the one other sheet of
// the tab that does; none, or several, is null.
export function nameHome<S extends { id: string; layout: SheetLayout }>(
  name: string,
  own: S | undefined,
  tab: readonly S[],
): { sheet: S; range: RangeName } | null {
  const mine = own && findRangeName(own.layout, name);
  if (own && mine) return { sheet: own, range: mine };
  const hits = tab
    .filter((s) => s.id !== own?.id)
    .map((s) => ({ sheet: s, range: findRangeName(s.layout, name) }))
    .filter((x): x is { sheet: S; range: RangeName } => !!x.range);
  return hits.length === 1 ? hits[0]! : null;
}
