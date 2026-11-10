// A Local only record's Plan stores read as Plan's rows (split.ts, splitLocalDocument).
import type { LocalDocumentInput, MigrationPlanData } from './contract';
import { isRec, num, str } from './split-model';

const json = (v: unknown): string | null =>
  v === undefined || v === null ? null : JSON.stringify(v);

// A Local only record's item and sheet stores (the old offline record's `items`, `sheets`, ...) as Plan's rows, or null
// when it has neither.
export function localPlan(input: LocalDocumentInput): MigrationPlanData | null {
  if (!Array.isArray(input.items) && !Array.isArray(input.sheets)) return null;
  const items = (input.items ?? []).filter(isRec).map((it) => ({
    id: str(it.id) ?? '',
    type: str(it.type) ?? '',
    itemKey: num(it.key, 0),
    rank: str(it.rank) ?? '',
    fields: JSON.stringify(isRec(it.fields) ? it.fields : {}),
    rev: num(it.rev, 0),
    createdAt: num(it.createdAt, 0),
    updatedAt: num(it.updatedAt, 0),
    createdBy: json(it.createdBy),
    updatedBy: json(it.updatedBy),
  }));
  const sheets: MigrationPlanData['sheets'] = [];
  const cells: MigrationPlanData['cells'] = [];
  for (const s of (input.sheets ?? []).filter(isRec)) {
    const id = str(s.id) ?? '';
    sheets.push({
      id,
      tabId: str(s.tabId) ?? '',
      title: str(s.title) ?? '',
      layout: JSON.stringify(s.layout ?? {}),
      rev: num(s.rev, 0),
      createdAt: num(s.createdAt, 0),
      updatedAt: num(s.updatedAt, 0),
      updatedBy: json(s.updatedBy),
    });
    for (const c of Array.isArray(s.cells) ? (s.cells as unknown[]) : []) {
      if (!isRec(c)) continue;
      cells.push({
        sheetId: id,
        rowId: str(c.r) ?? '',
        colId: str(c.c) ?? '',
        input: str(c.i) ?? null,
        format: c.f === undefined ? null : typeof c.f === 'string' ? c.f : JSON.stringify(c.f),
      });
    }
  }
  return {
    itemTypes: json(input.itemTypes),
    itemTypesRev: 0,
    itemsRev: num(input.itemsRev, 0),
    itemsNextKey: num(input.itemsNextKey, items.length + 1),
    items,
    sheets,
    cells,
    formLinks: [],
  };
}
