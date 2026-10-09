'use client';

// A card table's rows on the grid (docs/specs/029-sheets/sheet.md "Card tables"): Open Card at the right of every card
// row's Title cell; a draft row tinted, with Save and Cancel in its Controls cell (for someone who may edit); and in a
// column whose field has set values (Type, State, Priority, Assignee, a choice field) or a date, a dropdown arrow in
// the active cell that picks one. Nothing is drawn over the frozen rows or columns a row has scrolled under.
import { useRef, useState } from 'react';
import { DateInput, Tooltip, lucideGlyph, openDatePicker } from '@livediagram/ui';
import {
  lucideCheck,
  lucideChevronDown,
  lucideExternalLink,
  lucideX,
} from '@livediagram/icons/lucide';
import {
  cellKey,
  displayValue,
  isoFromSerial,
  layoutIndex,
  serialFromIso,
  type CardTable,
} from '@livediagram/sheets';
import { usePlan, type PlanContextValue } from '@/components/plan/PlanContext';
import { OptionRows } from '@/components/plan/OptionRows';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { cardFieldChoice } from './card-field-options';
import { cellBox } from './sheet-geometry';
import { useSheetController, type SheetController } from './sheet-controller';
import { cancelCardRow, saveCardRow } from './useCardTableSync';

const OpenGlyph = lucideGlyph(lucideExternalLink, 13);
const SaveGlyph = lucideGlyph(lucideCheck, 14);
const CancelGlyph = lucideGlyph(lucideX, 14);
const ChevronGlyph = lucideGlyph(lucideChevronDown, 13);

// The first year a picked date is taken from (the serial dates' epoch, 1899, aside).
const DATE_YEAR_MIN = 1900;
const STRIP_GAP_PX = 4;
// Save and Cancel together: two 24 px buttons and the 4 px between.
const STRIP_PX = 52;
// Open Card's inset from the Title cell's right edge.
const OPEN_INSET_PX = 3;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function SheetCardRows() {
  const c = useSheetController();
  const plan = usePlan();
  const tables = c.sheet.layout.cardTables;
  if (!plan || !tables?.length || !c.interactive) return null;
  return (
    <>
      {tables.map((t) => (
        <TableRows key={t.id} c={c} plan={plan} table={t} />
      ))}
      {c.canEdit ? <ActiveCellChoice c={c} plan={plan} /> : null}
    </>
  );
}

function TableRows({
  c,
  plan,
  table,
}: {
  c: SheetController;
  plan: PlanContextValue;
  table: CardTable;
}) {
  const ix = layoutIndex(c.sheet.layout);
  const cols = table.cols
    .map((col) => ix.colPos.get(col.c))
    .filter((x): x is number => x !== undefined);
  if (!cols.length) return null;
  const first = Math.min(...cols);
  const last = Math.max(...cols);
  // Open Card on every card row in view, at the right of its Title cell (else the table's first column).
  const titleCol =
    ix.colPos.get(table.cols.find((x) => x.field.trim().toLowerCase() === 'title')?.c ?? '') ??
    first;
  const viewH = c.view.height - c.geometry.headH;
  // A box scrolled under the frozen rows or columns is hidden there, as its cell is.
  const g = c.geometry;
  const frozenH = g.rows[g.frozenRows] ?? 0;
  const frozenW = g.cols[g.frozenCols] ?? 0;
  const underFrozen = (rp: number, cp: number, box: { x: number; y: number }) =>
    (rp >= g.frozenRows && g.frozenRows > 0 && box.y < frozenH) ||
    (cp >= g.frozenCols && g.frozenCols > 0 && box.x < frozenW);
  const opens = Object.entries(table.rows).flatMap(([r, itemId]) => {
    const rp = ix.rowPos.get(r);
    if (rp === undefined || c.geometry.hiddenRow(rp) || !plan.items.has(itemId)) return [];
    const box = cellBox(c.geometry, rp, titleCol, c.scroll);
    // Only the rows in view (all of them before the view is measured).
    const inView = c.view.height <= 0 || (box.y + box.h > 0 && box.y < viewH);
    return inView && !underFrozen(rp, titleCol, box) ? [{ r, itemId, box }] : [];
  });
  return (
    <>
      {opens.map(({ r, itemId, box }) => (
        <div
          key={`open-${r}`}
          className="absolute z-[8]"
          style={{ left: box.x + box.w - 24 - OPEN_INSET_PX, top: box.y + (box.h - 24) / 2 }}
          onPointerDown={stop}
          onDoubleClick={stop}
        >
          <RowButton c={c} quiet label="Open Card" onClick={() => plan.openItem(itemId)}>
            <OpenGlyph />
          </RowButton>
        </div>
      ))}
      {(c.canEdit ? (table.drafts ?? []) : []).map((r) => {
        const rp = ix.rowPos.get(r);
        if (rp === undefined || c.geometry.hiddenRow(rp)) return null;
        const a = cellBox(c.geometry, rp, first, c.scroll);
        if (rp >= g.frozenRows && g.frozenRows > 0 && a.y < frozenH) return null;
        const b = cellBox(c.geometry, rp, last, c.scroll);
        const itemId = table.rows[r];
        const card = itemId && plan.items.has(itemId) ? itemId : null;
        // Save and Cancel sit in the row's Controls cell (the table's controls column), centred; a table without one
        // yet has them just past its last column.
        const ctlPos = table.controls ? ix.colPos.get(table.controls) : undefined;
        const ctl = ctlPos !== undefined ? cellBox(c.geometry, rp, ctlPos, c.scroll) : null;
        const left = ctl ? ctl.x + (ctl.w - STRIP_PX) / 2 : b.x + b.w + STRIP_GAP_PX;
        return (
          <div key={r}>
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                left: a.x,
                top: a.y,
                width: b.x + b.w - a.x,
                height: a.h,
                backgroundColor: `color-mix(in srgb, ${c.palette.focus} 10%, transparent)`,
                boxShadow: `inset 3px 0 0 ${c.palette.focus}`,
              }}
            />
            <div
              role="group"
              aria-label="Unsaved card row"
              className="absolute z-[8] flex items-center gap-1"
              style={{ left, top: a.y + (a.h - 24) / 2 }}
              onPointerDown={stop}
              onDoubleClick={stop}
            >
              <RowButton
                c={c}
                primary
                label={card ? 'Save Card' : 'Add Card'}
                onClick={() => {
                  void saveCardRow(c, plan, table.id, r).then((ok) => ok && c.focusGrid());
                }}
              >
                <SaveGlyph />
              </RowButton>
              <RowButton
                c={c}
                label="Cancel Changes"
                onClick={() => {
                  cancelCardRow(c, plan, table.id, r);
                  c.focusGrid();
                }}
              >
                <CancelGlyph />
              </RowButton>
            </div>
          </div>
        );
      })}
    </>
  );
}

// The active cell's dropdown, when its column's field has set values or is a date.
function ActiveCellChoice({ c, plan }: { c: SheetController; plan: PlanContextValue }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const { r, c: col } = c.selection.active;
  const rowId = c.sheet.layout.rows[r];
  const colId = c.sheet.layout.cols[col];
  if (!rowId || !colId || c.editing) return null;
  const table = c.sheet.layout.cardTables?.find(
    (t) =>
      t.cols.some((x) => x.c === colId) &&
      rowId !== t.head &&
      (t.rows[rowId] || isBelow(c, t, rowId)),
  );
  const field = table?.cols.find((x) => x.c === colId)?.field;
  const choice = field ? cardFieldChoice(field, plan) : null;
  if (!table || !field || !choice) return null;
  const box = cellBox(c.geometry, r, col, c.scroll);
  const value = c.workbook.value(c.sheet.id, r, col);
  const shown = displayValue(
    value,
    c.sheet.cells.get(cellKey(rowId, colId))?.format,
    c.locale,
  ).text;
  // A whole day from the picker, or none to clear it; a day before DATE_YEAR_MIN is not taken.
  const commitDate = (day: string | undefined) => {
    if (!day) return write({ i: null });
    const n = Number(day.slice(0, 4)) >= DATE_YEAR_MIN ? serialFromIso(day) : null;
    if (n !== null) write({ i: { n }, f: { nf: 'date' } });
  };
  const write = (cell: { i: { s: string } | { n: number } | null; f?: { nf: 'date' } }) => {
    setAnchor(null);
    c.write({ kind: 'cells', cells: [{ r: rowId, c: colId, ...cell }] }, 'Cell');
    c.focusGrid();
  };
  return (
    <>
      {choice.kind === 'date' ? (
        // The system date picker opens straight from the arrow, anchored to the cell
        // (docs/specs/004-interface-design/date-fields.md "A dropdown on a date opens the picker"): the field
        // itself is never seen or tabbed to; typing a date stays in the cell.
        <DateInput
          ref={dateRef}
          unstyled
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute opacity-0"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
          value={typeof value === 'number' ? isoFromSerial(value) : undefined}
          onCommit={commitDate}
        />
      ) : null}
      <Tooltip label={`Choose ${field}`}>
        <button
          type="button"
          aria-label={`Choose ${field}`}
          aria-haspopup="dialog"
          aria-expanded={choice.kind === 'date' ? undefined : anchor !== null}
          className="absolute z-[8] flex h-5 w-5 cursor-pointer items-center justify-center rounded transition hover:opacity-80"
          style={{
            // Inside the cell's right edge, in the room its column keeps for it (SheetCells padEnd).
            left: box.x + box.w - 21,
            top: box.y + (box.h - 20) / 2,
            backgroundColor: c.palette.column,
            color: c.palette.text,
          }}
          onPointerDown={stop}
          onClick={(e) => {
            if (choice.kind === 'date') {
              if (dateRef.current) openDatePicker(dateRef.current);
            } else setAnchor(anchor ? null : e.currentTarget);
          }}
        >
          <ChevronGlyph />
        </button>
      </Tooltip>
      {anchor && choice.kind !== 'date' ? (
        <AnchoredPopover
          anchor={anchor}
          name={`Choose ${field}`}
          width={240}
          onClose={() => setAnchor(null)}
        >
          <div
            className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900"
            onPointerDown={stop}
            onKeyDown={stop}
          >
            {choice.options.length ? (
              <OptionRows
                kind="single"
                label={field}
                selected={
                  choice.options.find((o) => o.toLowerCase() === shown.toLowerCase()) ?? null
                }
                rows={choice.options.map((o) => ({ id: o, label: o }))}
                onPick={(o) => write({ i: { s: o } })}
              />
            ) : (
              <p className="px-2 py-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                No choices yet.
              </p>
            )}
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}

// A row directly under the table's header or one of its rows: where a new card is typed.
function isBelow(c: SheetController, t: CardTable, rowId: string): boolean {
  const rows = c.sheet.layout.rows;
  const above = rows[rows.indexOf(rowId) - 1];
  return !!above && (above === t.head || !!t.rows[above]);
}

// One of a card row's buttons: a 24 px icon, named by the shared tooltip; Save in the brand colour.
function RowButton({
  c,
  label,
  primary = false,
  quiet = false,
  onClick,
  children,
}: {
  c: SheetController;
  label: string;
  primary?: boolean;
  // Open Card in a cell: no border or shadow, a tint on hover, so it sits lightly over the title.
  quiet?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // Save, in the brand colour: classes alone (white text on a brand fill carries its dark shade, never an inline
  // background).
  if (primary)
    return (
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-brand-500 bg-brand-500 text-white shadow-sm transition hover:bg-brand-600 dark:bg-brand-600"
          onClick={onClick}
        >
          {children}
        </button>
      </Tooltip>
    );
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition ${
          quiet
            ? 'opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10'
            : 'border shadow-sm hover:opacity-80'
        }`}
        style={
          quiet
            ? { color: c.palette.text }
            : {
                backgroundColor: c.palette.surface,
                borderColor: c.palette.cardBorder,
                color: c.palette.text,
              }
        }
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}
