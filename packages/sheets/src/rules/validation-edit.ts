// Making and removing validation rules (docs/specs/029-sheets/data-validation.md "Making and changing rules"): a rule
// written over a range first takes that range out of every other rule (a rule partly covered keeps the rest of its
// cells, as up to four rules), as Google Sheets does; and the checkbox toggle (Space, a press on a box).
import type { GridRange } from '../address';
import { makeAxisIds, type Rand } from '../ids';
import { idRangeOf, posRangeOf } from '../layout';
import type { LayoutChange } from '../store-layout';
import type { CellChange, SheetWrite } from '../store';
import { cellKey, type SheetLayout, type ValidationRule } from '../sheet';
import type { Workbook } from '../engine/workbook';
import { checkboxValue, validationRuleAt } from './validation';

// `a` less `b`, as up to four rectangles: the bands above, below, left and right of their overlap.
export function subtractRect(a: GridRange, b: GridRange): GridRange[] {
  const r1 = Math.max(a.r1, b.r1);
  const r2 = Math.min(a.r2, b.r2);
  const c1 = Math.max(a.c1, b.c1);
  const c2 = Math.min(a.c2, b.c2);
  if (r1 > r2 || c1 > c2) return [a];
  const out: GridRange[] = [];
  if (a.r1 < r1) out.push({ r1: a.r1, c1: a.c1, r2: r1 - 1, c2: a.c2 });
  if (r2 < a.r2) out.push({ r1: r2 + 1, c1: a.c1, r2: a.r2, c2: a.c2 });
  if (a.c1 < c1) out.push({ r1, c1: a.c1, r2, c2: c1 - 1 });
  if (c2 < a.c2) out.push({ r1, c1: c2 + 1, r2, c2: a.c2 });
  return out;
}

// The changes that take `ranges` out of every validation rule: each rule touched is removed, and its leftover cells
// come back as new rules (same settings, new ids).
function subtractRange(
  layout: SheetLayout,
  ranges: readonly GridRange[],
  rand: Rand = Math.random,
  taken: Set<string> = new Set((layout.rules ?? []).map((x) => x.id)),
): LayoutChange[] {
  const out: LayoutChange[] = [];
  for (const rule of layout.rules ?? []) {
    const p = posRangeOf(layout, rule);
    if (!p) continue;
    let pieces: GridRange[] = [p];
    for (const g of ranges) pieces = pieces.flatMap((x) => subtractRect(x, g));
    if (pieces.length === 1 && sameRect(pieces[0]!, p)) continue;
    out.push({ k: 'vrule', id: rule.id, rule: null });
    for (const piece of pieces) {
      const ids = idRangeOf(layout, piece.r1, piece.c1, piece.r2, piece.c2);
      if (!ids) continue;
      const [id] = makeAxisIds(1, rand, taken);
      taken.add(id!);
      out.push({ k: 'vrule', id: id!, rule: { ...rule, id: id!, ...ids } });
    }
  }
  return out;
}

function sameRect(a: GridRange, b: GridRange): boolean {
  return a.r1 === b.r1 && a.c1 === b.c1 && a.r2 === b.r2 && a.c2 === b.c2;
}

export type RuleSettings = Omit<ValidationRule, 'id' | 'r1' | 'c1' | 'r2' | 'c2'>;

// A rule over `range` (an existing rule's id to edit it in place), taking the range out of every other rule.
export function setValidationRule(
  layout: SheetLayout,
  range: GridRange,
  settings: RuleSettings,
  rand: Rand = Math.random,
  id?: string,
): { write: SheetWrite; id: string } | null {
  const ids = idRangeOf(layout, range.r1, range.c1, range.r2, range.c2);
  if (!ids) return null;
  const taken = new Set((layout.rules ?? []).map((x) => x.id));
  const own = id && taken.has(id) ? id : makeAxisIds(1, rand, taken)[0]!;
  taken.add(own);
  // The rule being edited is replaced whole: only the others give up the range.
  const others: SheetLayout = {
    ...layout,
    rules: (layout.rules ?? []).filter((x) => x.id !== own),
  };
  const changes = subtractRange(others, [range], rand, taken);
  changes.push({ k: 'vrule', id: own, rule: { ...settings, id: own, ...ids } });
  return { write: { kind: 'layout', changes }, id: own };
}

// Remove Validation: the ranges taken out of every rule; null when no rule touches them.
export function removeValidation(
  layout: SheetLayout,
  ranges: readonly GridRange[],
  rand: Rand = Math.random,
): SheetWrite | null {
  const changes = subtractRange(layout, ranges, rand);
  return changes.length ? { kind: 'layout', changes } : null;
}

// Whether any cell of the ranges is a checkbox.
export function selectionHasCheckbox(layout: SheetLayout, ranges: readonly GridRange[]): boolean {
  if (!layout.rules?.some((x) => x.is === 'check')) return false;
  for (const g of ranges)
    for (const rule of layout.rules) {
      if (rule.is !== 'check') continue;
      const p = posRangeOf(layout, rule);
      if (p && p.r1 <= g.r2 && g.r1 <= p.r2 && p.c1 <= g.c2 && g.c1 <= p.c2) return true;
    }
  return false;
}

// Space, or a press on a box: every checkbox cell of the ranges ticked when any is not, else all unticked
// (data-validation.md "Using a checkbox"). Null when no checkbox cell is selected. Merged-away cells are skipped by
// the caller passing a merge's top-left.
export function toggleCheckboxes(
  wb: Workbook,
  sheetId: string,
  ranges: readonly GridRange[],
): SheetWrite | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet || !selectionHasCheckbox(sheet.layout, ranges)) return null;
  const { layout } = sheet;
  const boxes: { r: string; c: string; on: boolean }[] = [];
  const seen = new Set<string>();
  // Only where a checkbox rule meets the selection: a whole selected column never walks every row.
  const checks = (layout.rules ?? []).flatMap((x) => {
    const p = x.is === 'check' ? posRangeOf(layout, x) : null;
    return p ? [p] : [];
  });
  for (const g of ranges)
    for (const p of checks)
      for (let r = Math.max(g.r1, p.r1); r <= Math.min(g.r2, p.r2); r++)
        for (let c = Math.max(g.c1, p.c1); c <= Math.min(g.c2, p.c2); c++) {
          // The cell's own rule (a later rule may have split this one away).
          if (validationRuleAt(layout, r, c)?.is !== 'check') continue;
          const rowId = layout.rows[r]!;
          const colId = layout.cols[c]!;
          const key = cellKey(rowId, colId);
          if (seen.has(key)) continue;
          seen.add(key);
          const input = sheet.cells.get(key)?.input;
          // A formula's box is its formula's: the toggle leaves it.
          if (input && 'f' in input) continue;
          const v = input
            ? 'b' in input
              ? input.b
              : 'n' in input
                ? input.n
                : 's' in input
                  ? input.s
                  : null
            : null;
          boxes.push({ r: rowId, c: colId, on: checkboxValue(v) === true });
        }
  if (!boxes.length) return null;
  const tick = boxes.some((b) => !b.on);
  const cells: CellChange[] = boxes.map((b) => ({ r: b.r, c: b.c, i: { b: tick } }));
  return { kind: 'cells', cells };
}
