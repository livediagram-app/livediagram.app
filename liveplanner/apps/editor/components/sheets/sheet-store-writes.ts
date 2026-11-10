// The sheet store's writes worked out before they land (sheet-store-client.ts): each checked and split into parts
// against the sheet as the parts before it leave it, the readers a deletion or sort rewrites on the tab's other sheets,
// and an undo as it lands on the sheets now.
import {
  Workbook,
  applyLayoutChange,
  applySheetWrite,
  cellKey,
  inverseLayoutChanges,
  rangeOptions,
  shrinkReadersOf,
  splitWrite,
  validateWrite,
  writeForRules,
  type Sheet,
  type SheetLayout,
  type SheetPerson,
  type SheetRejection,
  type SheetWrite,
  type WriteCheck,
} from '@liveplanner/sheets';
import { nextSeq } from '@/lib/offline-queue/plan-queue';
import { writeRefusalMessage } from './sheet-store-messages';
import type { Entry, Inverse, SheetStoreDeps } from './sheet-store-types';

let widCounter = 0;
export const newWid = () => `w${Date.now().toString(36)}${(widCounter++).toString(36)}`;

export function keysOf(write: SheetWrite): string[] | undefined {
  if (write.kind !== 'cells') return undefined;
  return write.cells.map((c) => cellKey(c.r, c.c));
}

// One sheet's write in a change, split into its parts, each with its write id and queue order.
export type PlannedWrite = {
  sheetId: string;
  write: SheetWrite;
  parts: SheetWrite[];
  ids: { wid: string; seq: number }[];
};

// What a change's writes are once checked (writeAll), or the first refusal, already said in a toast.
export function plannedWrites(
  entries: ReadonlyMap<string, Entry>,
  workbooks: ReadonlyMap<string, Workbook>,
  deps: SheetStoreDeps,
  by: () => SheetPerson,
  edits: readonly { sheetId: string; write: SheetWrite }[],
  now: number,
  checked: boolean,
): PlannedWrite[] | SheetRejection {
  const states = new Map<string, Sheet>();
  const plan: PlannedWrite[] = [];
  for (const { sheetId, write: asMade } of edits) {
    const entry = entries.get(sheetId);
    if (!entry) return 'write_invalid';
    // What is typed or pasted takes its cell's rule: `done` is saved as the option `Done` (data-validation.md).
    const write = checked ? writeForRules(entry.view.layout, asMade) : asMade;
    const parts = splitWrite(write);
    let state = states.get(sheetId) ?? entry.view;
    // A Dropdown from a Range's options are worked out here, from the tab's workbook (the api cannot).
    const wb = workbooks.get(entry.view.tabId);
    const checks: WriteCheck = {
      // Quiet writes (a card table's sync, a seed) are the system's, stored as they are.
      checkRules: checked,
      locale: deps.locale,
      ...(wb ? { rangeValues: (rule) => rangeOptions(wb, sheetId, rule) } : {}),
    };
    for (const part of parts) {
      const check = validateWrite(state, part, checks);
      if (!check.ok) {
        deps.toast(writeRefusalMessage(check, state.layout));
        return check.error;
      }
      // Only a later part or write needs the sheet as this one leaves it.
      if (parts.length > 1 || edits.length > 1)
        state = applySheetWrite(state, part, { now, by: by() }).sheet;
    }
    states.set(sheetId, state);
    plan.push({
      sheetId,
      write,
      parts,
      ids: parts.map(() => ({ wid: newWid(), seq: nextSeq() })),
    });
  }
  return plan;
}

// Rows or columns deleted from a sheet shrink the ranges into it held by the tab's other loaded sheets, and a sort
// keeps them on their rows (formulas.md "Other sheets"), in the same change, so one undo puts them back; the api shrinks them too, for writers that are not
// an editor (and finds nothing left to do after this). Linear in the tab's formula references.
export function withReaders(
  entries: ReadonlyMap<string, Entry>,
  edits: readonly { sheetId: string; write: SheetWrite }[],
): { sheetId: string; write: SheetWrite }[] {
  const out = [...edits];
  const named = new Set(edits.map((e) => e.sheetId));
  for (const { sheetId, write } of edits) {
    if (write.kind !== 'layout') continue;
    if (
      !write.changes.some(
        (c) =>
          c.k === 'deleteRows' ||
          c.k === 'deleteCols' ||
          c.k === 'orderRows' ||
          c.k === 'orderCols',
      )
    )
      continue;
    const target = entries.get(sheetId)?.view;
    if (!target) continue;
    for (const [id, entry] of entries) {
      if (named.has(id) || entry.view.tabId !== target.tabId) continue;
      const cells = shrinkReadersOf(sheetId, target.layout, write.changes, entry.view.cells);
      if (cells.length) out.push({ sheetId: id, write: { kind: 'cells', cells } });
    }
  }
  return out;
}

// The undo of a change, as it lands on the sheets now: a deletion's undo puts back what it took into the layout
// as it is (and as the undo's earlier writes to that sheet leave it), so links, drafts and merges made since stay.
export function undoWrites(
  entries: ReadonlyMap<string, Entry>,
  inverses: readonly Inverse[],
): { sheetId: string; write: SheetWrite }[] {
  const landing = new Map<string, SheetLayout>();
  return inverses.map(({ sheetId, write, before, applied }) => {
    const now = landing.get(sheetId) ?? entries.get(sheetId)?.view.layout;
    let out = write;
    if (before && applied?.kind === 'layout' && write.kind === 'layout' && now)
      out = { ...write, changes: inverseLayoutChanges(before, applied.changes, now) };
    if (now && out.kind === 'layout')
      landing.set(sheetId, out.changes.reduce(applyLayoutChange, now));
    return { sheetId, write: out };
  });
}
