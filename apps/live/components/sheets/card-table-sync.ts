// Card tables (docs/specs/029-sheets/sheet.md "Card tables"): rows of a sheet that are Plan cards, kept in step both
// ways. Pure: what to write to the sheet when cards change (pull), and what to write to the cards when this person
// edits the sheet (push). The hook (useCardTableSync) runs them.
import {
  cardSourceOf,
  builtInFieldOf,
  fieldKeyOf,
  isCardDateField,
  isArchived,
  isTrashed,
  resolveFields,
  resolveType,
  typeIn,
  type Item,
  type ItemPatch,
  type ItemTypeDef,
} from '@livediagram/items';
import {
  isoFromSerial,
  cellKey,
  layoutIndex,
  type CardTable,
  type CellChange,
  type CellInput,
  type FormatPatch,
  type Sheet,
  type SheetWrite,
  type Workbook,
} from '@livediagram/sheets';

export type CardPlan = {
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  statusNames: ReadonlyMap<string, string>;
};

// A header's field as the card table reads it: the card's number (read only), its type, a built-in field by id, or
// anything else (a custom field's label) lower case. Names resolve as the card functions read them (builtInFieldOf).
const NUMBER = '#key';
const TYPE = '#type';
const norm = (field: string) => builtInFieldOf(field) ?? field.trim().toLowerCase();
// The key a field is written by: a built-in field's id, else its label (resolveFields finds the custom field).
const keyOf = (field: string) => builtInFieldOf(field) ?? field;
// Fields a cleared cell leaves as they are: the type, a card's title and its state (a card always has them).
const KEPT_WHEN_CLEARED = new Set([TYPE, 'title', 'status']);
const live = (item: Item | undefined): item is Item =>
  !!item && !isTrashed(item) && !isArchived(item);

// A card field's value as the import writes it into a cell.
export function cardCell(
  value: string | number | boolean | null | undefined,
  field: string,
): { i: CellInput | null; f?: FormatPatch } {
  if (value === null || value === undefined || value === '') return { i: null };
  if (typeof value === 'number')
    return isCardDateField(field) ? { i: { n: value }, f: { nf: 'date' } } : { i: { n: value } };
  return { i: { s: String(value) } };
}

const sameInput = (a: CellInput | undefined, b: CellInput | null) =>
  JSON.stringify(a ?? null) === JSON.stringify(b);

// Cards to rows: every linked row's cells that no longer say what its card says.
export function pullChanges(sheet: Sheet, plan: CardPlan): CellChange[] {
  const tables = sheet.layout.cardTables;
  if (!tables?.length) return [];
  const ix = layoutIndex(sheet.layout);
  const source = cardSourceOf(plan.items.values(), plan.types, { statusNames: plan.statusNames });
  const out: CellChange[] = [];
  for (const t of tables)
    for (const [r, itemId] of Object.entries(t.rows)) {
      const item = plan.items.get(itemId);
      // A draft row is the person's until it is saved or cancelled.
      if (!ix.rowPos.has(r) || !live(item) || t.drafts?.includes(r)) continue;
      for (const col of t.cols) {
        if (!ix.colPos.has(col.c)) continue;
        const want = cardCell(source.fieldOf(item, col.field) as never, col.field);
        if (sameInput(sheet.cells.get(cellKey(r, col.c))?.input, want.i)) continue;
        out.push({ r, c: col.c, i: want.i, ...(want.f ? { f: want.f } : {}) });
      }
    }
  return out;
}

export type CardCreate = {
  tableId: string;
  row: string;
  type: string;
  status: string;
  fields: Item['fields'];
};

// What this person's write means for the card tables: the rows it edited become drafts (saved to their cards with
// the row's Save), and a deleted linked row's card goes to the Trash.
export type PushPlan = {
  drafts: { tableId: string; row: string }[];
  trash: string[];
};

// What a row's Save writes: a patch to its card, or a new card; or why it cannot ("No column 'Doing'").
export type RowSave =
  | { kind: 'patch'; id: string; patch: ItemPatch }
  | { kind: 'create'; create: CardCreate }
  | { kind: 'none' }
  | { kind: 'refused'; message: string };

// A cell's value as a card field takes it: a date serial as an ISO date for a date field.
function fieldValue(v: unknown, field: string): unknown {
  if (typeof v === 'number' && isCardDateField(field)) return isoFromSerial(v);
  if (typeof v === 'object' && v !== null) return undefined; // an error or an array: nothing to write
  return v;
}

const blank = (v: unknown) => v === null || v === undefined || v === '';

// The table a row of `sheet` belongs to: linked to it, or a new row directly under one of its rows (or its header).
// A row linked to a card the plan does not have (its card never made, or deleted for good) counts as new, so its
// next edit makes it a card again; a trashed card stays linked.
function tableOfRow(
  sheet: Sheet,
  r: string,
  items: ReadonlyMap<string, Item>,
): { table: CardTable; linked: string | null } | null {
  const rows = sheet.layout.rows;
  const at = rows.indexOf(r);
  for (const t of sheet.layout.cardTables ?? []) {
    const id = t.rows[r];
    if (id && items.has(id)) return { table: t, linked: id };
    const above = rows[at - 1];
    if (id || (at > 0 && above && (above === t.head || t.rows[above])))
      return { table: t, linked: null };
  }
  return null;
}

// Rows to cards, step one: this person's write marks the table rows it touched (in the table's columns) as drafts,
// and trashes the cards of the linked rows it deleted.
export function pushPlan(before: Sheet, after: Sheet, write: SheetWrite, plan: CardPlan): PushPlan {
  const out: PushPlan = { drafts: [], trash: [] };
  if (!before.layout.cardTables?.length && !after.layout.cardTables?.length) return out;
  if (write.kind === 'layout')
    for (const ch of write.changes)
      if (ch.k === 'deleteRows')
        for (const t of before.layout.cardTables ?? [])
          for (const r of ch.ids) {
            const id = t.rows[r];
            if (id && live(plan.items.get(id)) && !out.trash.includes(id)) out.trash.push(id);
          }
  for (const cell of write.kind === 'title' ? [] : (write.cells ?? [])) {
    const found = tableOfRow(after, cell.r, plan.items);
    if (!found || !found.table.cols.some((col) => col.c === cell.c)) continue;
    if (found.table.drafts?.includes(cell.r)) continue;
    if (!out.drafts.some((d) => d.row === cell.r))
      out.drafts.push({ tableId: found.table.id, row: cell.r });
  }
  return out;
}

// Rows to cards, step two: a row's Save. A linked row writes the fields whose cells no longer say what its card says
// (Number aside; a cleared Type, Title or State keeps the card's); a new row makes a card of its filled cells, of its Type cell's type or the table's, in its State
// cell's state or the table's first card's.
export function rowSave(
  sheet: Sheet,
  wb: Workbook,
  plan: CardPlan,
  tableId: string,
  r: string,
): RowSave {
  const table = sheet.layout.cardTables?.find((t) => t.id === tableId);
  if (!table) return { kind: 'none' };
  const ix = layoutIndex(sheet.layout);
  const rp = ix.rowPos.get(r);
  if (rp === undefined) return { kind: 'none' };
  const naming = {
    statuses: [...plan.statusNames].map(([status, name]) => ({ status, name })),
    items: [...plan.items.values()],
  };
  const valueAt = (c: string) => {
    const cp = ix.colPos.get(c);
    return cp === undefined ? null : wb.value(sheet.id, rp, cp);
  };
  const linkedId = table.rows[r];
  const item = linkedId ? plan.items.get(linkedId) : undefined;
  if (live(item)) {
    const source = cardSourceOf(plan.items.values(), plan.types, { statusNames: plan.statusNames });
    const patch: ItemPatch = {};
    const set: Record<string, unknown> = {};
    const clear: string[] = [];
    let typeDef = typeIn(plan.types, item.type);
    for (const col of table.cols) {
      const field = norm(col.field);
      if (field === NUMBER || !ix.colPos.has(col.c)) continue;
      const want = cardCell(source.fieldOf(item, col.field) as never, col.field);
      if (sameInput(sheet.cells.get(cellKey(r, col.c))?.input, want.i)) continue;
      const v = fieldValue(valueAt(col.c), col.field);
      if (field === TYPE) {
        if (blank(v)) continue;
        const t = resolveType(String(v), plan.types);
        if (!t.ok) return { kind: 'refused', message: t.message };
        if (t.type.id !== item.type) {
          patch.type = t.type.id;
          typeDef = t.type;
        }
        continue;
      }
      if (v === undefined) continue;
      if (blank(v)) {
        if (KEPT_WHEN_CLEARED.has(field)) continue;
        const key = fieldKeyOf(keyOf(col.field), typeDef);
        if (key.ok) clear.push(key.key);
        continue;
      }
      set[keyOf(col.field)] = v;
    }
    const fields = resolveFields(set, typeDef, naming);
    if (!fields.ok) return { kind: 'refused', message: fields.message };
    if (Object.keys(fields.fields).length) patch.set = fields.fields as Item['fields'];
    if (clear.length) patch.clear = clear;
    return patch.set || patch.clear || patch.type
      ? { kind: 'patch', id: item.id, patch }
      : { kind: 'none' };
  }
  if (linkedId && plan.items.has(linkedId)) return { kind: 'none' }; // a trashed card: nothing to write
  const values = table.cols
    .map((col) => ({ field: col.field, v: fieldValue(valueAt(col.c), col.field) }))
    .filter((x) => !blank(x.v) && norm(x.field) !== NUMBER);
  if (!values.length) return { kind: 'none' };
  const typeCell = values.find((x) => norm(x.field) === TYPE);
  const typed = typeCell ? resolveType(String(typeCell.v), plan.types) : null;
  if (typed && !typed.ok) return { kind: 'refused', message: typed.message };
  const typeDef = typed?.ok ? typed.type : typeIn(plan.types, table.type);
  const input: Record<string, unknown> = {};
  for (const x of values) if (norm(x.field) !== TYPE) input[keyOf(x.field)] = x.v;
  const fields = resolveFields(input, typeDef, naming);
  if (!fields.ok) return { kind: 'refused', message: fields.message };
  const f = { ...fields.fields } as Item['fields'];
  // The table's first card in row order.
  const firstLinked = sheet.layout.rows
    .map((row) => (table.rows[row] ? plan.items.get(table.rows[row]) : undefined))
    .find(live);
  const status =
    typeof f['status'] === 'string'
      ? (f['status'] as string)
      : ((firstLinked?.fields['status'] as string | undefined) ?? '');
  delete f['status'];
  if (blank(f['title'])) f['title'] = typeDef.newTitle;
  return {
    kind: 'create',
    create: { tableId: table.id, row: r, type: typeDef.id, status, fields: f },
  };
}
