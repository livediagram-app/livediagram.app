'use client';

// Card tables kept in step (docs/specs/029-sheets/sheet.md "Card tables"), while the Sheet is drawn, for someone who
// may edit: cards changed anywhere rewrite their rows (quietly, no undo step), except rows being edited; this
// person's edits make a row a draft, which its Save writes to the card (or makes a new card) and its Cancel puts
// back; a deleted linked row's card goes to the Trash at once.
import { useEffect, useRef } from 'react';
import { newItemId } from '@livediagram/items';
import {
  CARD_CONTROLS_COL_PX,
  cellKey,
  layoutIndex,
  makeAxisIds,
  type CardTable,
  type CellChange,
  type LayoutChange,
  type Sheet,
  type SheetWrite,
} from '@livediagram/sheets';
import { usePlan, type PlanContextValue } from '@/components/plan/PlanContext';
import { debugLog } from '@/lib/debug-log';
import { pullChanges, pushPlan, rowSave } from './card-table-sync';
import type { SheetController } from './sheet-controller';

export type CardTablePush = (before: Sheet, write: SheetWrite) => void;

// The write that gives a card table its Controls column: the column after its last, when the table's rows are empty
// there, else a new column inserted after it; sized for two buttons.
export function controlsColumnWrite(sheet: Sheet, table: CardTable): SheetWrite | null {
  const ix = layoutIndex(sheet.layout);
  const positions = table.cols
    .map((col) => ix.colPos.get(col.c))
    .filter((x): x is number => x !== undefined);
  if (!positions.length) return null;
  const after = sheet.layout.cols[Math.max(...positions)]!;
  const next = sheet.layout.cols[Math.max(...positions) + 1];
  const rows = [table.head, ...Object.keys(table.rows), ...(table.drafts ?? [])];
  const free = !!next && rows.every((r) => !sheet.cells.get(cellKey(r, next))?.input);
  const changes: LayoutChange[] = [];
  let controls = next;
  if (!free) {
    controls = makeAxisIds(1, Math.random, new Set(sheet.layout.cols))[0]!;
    changes.push({ k: 'insertCols', after, ids: [controls] });
  }
  changes.push(
    { k: 'size', axis: 'c', ids: [controls!], px: CARD_CONTROLS_COL_PX },
    { k: 'cardTable', id: table.id, table: { ...table, controls: controls! } },
  );
  return { kind: 'layout', changes };
}

// Set a card table whole, quietly (its links and drafts are bookkeeping, not an edit to undo).
function setTable(c: SheetController, table: CardTable) {
  c.store.write(
    c.sheet.id,
    { kind: 'layout', changes: [{ k: 'cardTable', id: table.id, table }] },
    { undoable: false },
  );
}

const tableOf = (c: SheetController, id: string) =>
  c.store.sheet(c.sheet.id)?.layout.cardTables?.find((t) => t.id === id);

const withoutDraft = (t: CardTable, r: string): CardTable => {
  const drafts = (t.drafts ?? []).filter((x) => x !== r);
  const rest = { ...t };
  delete rest.drafts;
  return drafts.length ? { ...rest, drafts } : rest;
};

// Rows whose Save is on its way: a second press waits for the first (no second card for one row).
const saving = new Set<string>();

// Save a draft row: its card patched (or made, and the row linked to it), and the draft dropped once that lands. False,
// with a toast, when the plan refuses a value; false, the row still a draft, when the card write is refused.
export async function saveCardRow(
  c: SheetController,
  plan: PlanContextValue,
  tableId: string,
  r: string,
): Promise<boolean> {
  const sheet = c.store.sheet(c.sheet.id);
  const key = `${c.sheet.id}:${tableId}:${r}`;
  if (!sheet || !tableOf(c, tableId) || saving.has(key)) return false;
  const out = rowSave(sheet, c.store.workbook(sheet.tabId), plan, tableId, r);
  if (out.kind === 'refused') {
    c.toast(out.message);
    return false;
  }
  let link: string | null = null;
  let ok = true;
  saving.add(key);
  try {
    if (out.kind === 'patch') ok = await plan.patchItem(out.id, out.patch);
    if (out.kind === 'create') {
      // The item store's own id shape (6 to 32 characters): a UUID is refused.
      link = newItemId();
      const { create } = out;
      ok = await plan.addItem({
        id: link,
        type: create.type,
        fields: create.fields,
        status: create.status,
        after: null,
      });
    }
  } finally {
    saving.delete(key);
  }
  debugLog('[sheets] cardTable.save', { row: r, kind: out.kind, ok });
  if (!ok) {
    c.toast('That row could not be saved to its card. Its edits are kept: try Save again.');
    return false;
  }
  // The table as it is now (a pull or another save may have changed it while the write was out).
  const table = tableOf(c, tableId);
  if (!table) return true;
  const next = withoutDraft(table, r);
  setTable(c, link ? { ...next, rows: { ...next.rows, [r]: link } } : next);
  return true;
}

// Cancel a draft row: a linked row takes its card's values back (the next pull), a new row is emptied.
export function cancelCardRow(
  c: SheetController,
  plan: PlanContextValue,
  tableId: string,
  r: string,
) {
  const table = tableOf(c, tableId);
  if (!table) return;
  const id = table.rows[r];
  const linked = !!id && plan.items.has(id);
  setTable(c, withoutDraft(table, r));
  if (!linked) {
    const cells: CellChange[] = table.cols.map((col) => ({ r, c: col.c, i: null }));
    c.store.write(c.sheet.id, { kind: 'cells', cells }, { undoable: false });
  }
}

export function useCardTableSync(
  c: SheetController,
  setPush: (push: CardTablePush | null) => void,
) {
  const plan = usePlan();
  // Once the cards have loaded: before then every link would read as a card gone.
  const on =
    !!plan && plan.canEdit && plan.status === 'ready' && !!c.sheet.layout.cardTables?.length;
  const items = plan?.items;
  const types = plan?.types;
  const statusNames = plan?.statusNames;

  // A table made before the Controls column had one gets one: the column just past it, if its rows there are empty,
  // else a new column inserted there.
  const missing = on ? c.sheet.layout.cardTables?.find((t) => !t.controls) : undefined;
  useEffect(() => {
    if (!missing) return;
    const write = controlsColumnWrite(c.sheet, missing);
    if (write) c.store.write(c.sheet.id, write, { undoable: false });
  }, [missing, c.sheet, c.store]);

  // A card changed elsewhere while its row waits as a draft: the row's edits are put back (its card wins), said once.
  // Each draft's card revision is remembered when the draft is first seen here.
  const baseline = useRef(new Map<string, number>());
  useEffect(() => {
    if (!on || !plan || !items) return;
    const seen = new Set<string>();
    for (const t of c.sheet.layout.cardTables ?? [])
      for (const r of t.drafts ?? []) {
        const item = items.get(t.rows[r] ?? '');
        if (!item) continue;
        const key = `${t.id}:${r}`;
        seen.add(key);
        // This person's own Save on its way: the card moves on because of it, not elsewhere.
        if (saving.has(`${c.sheet.id}:${t.id}:${r}`)) {
          baseline.current.set(key, item.rev);
          continue;
        }
        const was = baseline.current.get(key);
        if (was === undefined) baseline.current.set(key, item.rev);
        else if (item.rev > was) {
          baseline.current.delete(key);
          cancelCardRow(c, plan, t.id, r);
          c.notify(`Card #${item.key} changed elsewhere, so its row's edits were put back`);
          debugLog('[sheets] cardTable.draftSuperseded', { row: r, item: item.id });
        }
      }
    for (const key of [...baseline.current.keys()])
      if (!seen.has(key)) baseline.current.delete(key);
  }, [on, plan, items, c]);

  // Cards to rows.
  useEffect(() => {
    if (!on || !items || !types || !statusNames) return;
    const cells = pullChanges(c.sheet, { items, types, statusNames });
    if (!cells.length) return;
    debugLog('[sheets] cardTable.pull', { sheet: c.sheet.id, cells: cells.length });
    c.store.write(c.sheet.id, { kind: 'cells', cells }, { undoable: false });
  }, [on, items, types, statusNames, c.sheet, c.store]);

  // This person's writes: edited rows become drafts, deleted rows' cards go to the Trash.
  useEffect(() => {
    if (!on || !plan) {
      setPush(null);
      return;
    }
    setPush((before, write) => {
      const after = c.store.sheet(c.sheet.id);
      if (!after) return;
      const out = pushPlan(before, after, write, plan);
      if (out.trash.length) plan.trashItems(out.trash);
      for (const d of out.drafts) {
        const table = tableOf(c, d.tableId);
        if (table && !table.drafts?.includes(d.row))
          setTable(c, { ...table, drafts: [...(table.drafts ?? []), d.row] });
      }
    });
    return () => setPush(null);
  }, [on, plan, c, setPush]);
}
