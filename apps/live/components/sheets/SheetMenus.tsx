'use client';

// The grid's menus (docs/specs/029-sheets/sheet.md "Cell menu", "Rows and columns", "Filter", "Sort"): the cell menu
// and a header's menu at the pointer, a filter column's values and condition, and Custom Sort. Rows in the shared
// context menu; every row that changes something only for someone who may edit.
import { Button } from '@livediagram/ui';
import { useMemo, useState } from 'react';
import {
  CONDITION_OPS,
  columnLetters,
  columnValueCounts,
  type FilterCondition,
  type SortKey,
} from '@livediagram/sheets';
import { ContextMenu, ContextMenuDivider } from '@/components/palette/ContextMenu';
import { MenuActionRow, MenuHeader } from '@/components/primitives/PortalMenu';
import { useSheetController } from './sheet-controller';
import type { SheetActions } from './useSheetActions';
import { useSheetClipboard } from './useSheetClipboard';
import { Glyph, SheetCellMenu } from './SheetCellMenu';
import { FilterIcon, SortIcon, ClearFormatIcon } from './sheet-icons';

const CONDITION_LABELS: Record<NonNullable<FilterCondition['op']>, string> = {
  empty: 'Is empty',
  notEmpty: 'Is not empty',
  contains: 'Text contains',
  notContains: 'Text does not contain',
  startsWith: 'Text starts with',
  endsWith: 'Text ends with',
  exactly: 'Text is exactly',
  dateBefore: 'Date is before',
  dateAfter: 'Date is after',
  dateOn: 'Date is',
  gt: 'Greater than',
  gte: 'Greater than or equal to',
  lt: 'Less than',
  lte: 'Less than or equal to',
  between: 'Is between',
  eq: 'Is equal to',
  neq: 'Is not equal to',
};

export function SheetMenus({ actions }: { actions: SheetActions }) {
  const c = useSheetController();
  const clip = useSheetClipboard();
  const menu = c.menu;
  if (!menu) return null;
  const close = () => {
    c.setMenu(null);
    c.focusGrid();
  };
  const act = (fn: () => void) => () => {
    fn();
    close();
  };
  if (menu.kind === 'cell')
    return <SheetCellMenu at={{ x: menu.x, y: menu.y }} actions={actions} onClose={close} />;
  if (menu.kind === 'header') {
    const rows = menu.axis === 'r';
    const g = c.selection.ranges[c.selection.ranges.length - 1]!;
    const n = rows ? g.r2 - g.r1 + 1 : g.c2 - g.c1 + 1;
    const what = rows ? (n > 1 ? `${n} Rows` : 'Row') : n > 1 ? `${n} Columns` : 'Column';
    return (
      <ContextMenu
        position={{ x: menu.x, y: menu.y }}
        label={rows ? 'Row menu' : 'Column menu'}
        onClose={close}
      >
        <MenuHeader
          title={rows ? `Row ${menu.index + 1}` : `Column ${columnLetters(menu.index)}`}
        />
        {c.canEdit ? (
          <>
            <MenuActionRow
              plain
              label={`Insert ${n} ${rows ? 'Above' : 'Left'}`}
              icon={<Glyph t={rows ? '↥' : '↤'} />}
              onClick={act(() => actions.insert(menu.axis, 'before'))}
            />
            <MenuActionRow
              plain
              label={`Insert ${n} ${rows ? 'Below' : 'Right'}`}
              icon={<Glyph t={rows ? '↧' : '↦'} />}
              onClick={act(() => actions.insert(menu.axis, 'after'))}
            />
            <MenuActionRow
              plain
              label={`Delete ${what}`}
              icon={<Glyph t="−" />}
              onClick={act(() => actions.remove(menu.axis))}
            />
            <MenuActionRow
              plain
              label="Clear"
              icon={<ClearFormatIcon />}
              onClick={act(() => actions.clear('all'))}
            />
            <MenuActionRow
              plain
              label={`Hide ${what}`}
              icon={<Glyph t="◌" />}
              onClick={act(() => actions.hide(menu.axis, true))}
            />
            <MenuActionRow
              plain
              label="Fit to Data"
              icon={<Glyph t="⇔" />}
              onClick={act(() =>
                actions.autofit(menu.axis, range(rows ? g.r1 : g.c1, rows ? g.r2 : g.c2)),
              )}
            />
            <ResizeRow
              axis={menu.axis}
              at={menu.index}
              onResize={(px) => {
                actions.resize(menu.axis, range(rows ? g.r1 : g.c1, rows ? g.r2 : g.c2), px);
                close();
              }}
            />
            {!rows ? (
              <>
                <ContextMenuDivider />
                <MenuActionRow
                  plain
                  label="Sort A to Z"
                  icon={<SortIcon />}
                  onClick={act(() => actions.sortColumn(true))}
                />
                <MenuActionRow
                  plain
                  label="Sort Z to A"
                  icon={<SortIcon />}
                  onClick={act(() => actions.sortColumn(false))}
                />
              </>
            ) : null}
          </>
        ) : (
          <MenuActionRow
            plain
            label="Copy"
            icon={<Glyph t="⧉" />}
            onClick={act(() => clip.copyNow(false))}
          />
        )}
      </ContextMenu>
    );
  }
  if (menu.kind === 'filter')
    return (
      <FilterMenu
        colId={menu.colId}
        at={{ x: menu.x, y: menu.y }}
        actions={actions}
        onClose={close}
      />
    );
  return <SortDialog actions={actions} onClose={close} />;
}

// Resize…: opens a field with the line's size in pixels (a column at least 24, a row at least 18).
function ResizeRow({
  axis,
  at,
  onResize,
}: {
  axis: 'r' | 'c';
  at: number;
  onResize: (px: number) => void;
}) {
  const c = useSheetController();
  const offs = axis === 'c' ? c.geometry.cols : c.geometry.rows;
  const now = Math.round(offs[at + 1]! - offs[at]!);
  const [open, setOpen] = useState(false);
  const [px, setPx] = useState(String(now || (axis === 'c' ? 100 : 24)));
  const min = axis === 'c' ? 24 : 18;
  if (!open)
    return (
      <MenuActionRow plain label="Resize…" icon={<Glyph t="↔" />} onClick={() => setOpen(true)} />
    );
  const done = () => {
    const n = Math.round(Number(px));
    if (Number.isFinite(n) && n > 0) onResize(Math.min(2000, Math.max(min, n)));
  };
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-[12px]"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <label htmlFor="sheet-resize-px">{axis === 'c' ? 'Width' : 'Height'}</label>
      <input
        id="sheet-resize-px"
        autoFocus
        inputMode="numeric"
        className="h-7 w-16 rounded-md border bg-transparent px-2 text-right tabular-nums outline-none"
        style={{ borderColor: c.palette.border }}
        value={px}
        onChange={(e) => setPx(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') done();
        }}
      />
      <span style={{ color: c.palette.muted }}>px</span>
      <Button variant="primary" size="xs" onClick={done}>
        OK
      </Button>
    </div>
  );
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

function FilterMenu({
  colId,
  at,
  actions,
  onClose,
}: {
  colId: string;
  at: { x: number; y: number };
  actions: SheetActions;
  onClose: () => void;
}) {
  const c = useSheetController();
  const current = c.sheet.layout.filter?.conds[colId];
  const values = useMemo(
    () => columnValueCounts(c.workbook, c.sheet.id, colId),
    // Counted again whenever a value may have changed (`version`).
    [c.workbook, c.sheet.id, colId, c.version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [kept, setKept] = useState<Set<string>>(
    () => new Set(current?.values ?? values.map((v) => v.text)),
  );
  const [search, setSearch] = useState('');
  const [op, setOp] = useState<FilterCondition['op'] | ''>(current?.op ?? '');
  const [a, setA] = useState(current?.a ?? '');
  const [b, setB] = useState(current?.b ?? '');
  const shown = values.filter((v) => v.text.toLowerCase().includes(search.toLowerCase()));
  const apply = () => {
    const all = kept.size === values.length;
    const cond: FilterCondition = {
      ...(all ? {} : { values: [...kept] }),
      ...(op ? { op, ...(a ? { a } : {}), ...(op === 'between' && b ? { b } : {}) } : {}),
    };
    actions.setFilter(colId, Object.keys(cond).length ? cond : null);
    onClose();
  };
  const field = 'h-7 w-full rounded-md border bg-transparent px-2 text-[12px] outline-none';
  return (
    <ContextMenu position={at} label="Filter column" onClose={onClose}>
      <MenuActionRow
        plain
        label="Sort A to Z"
        icon={<SortIcon />}
        onClick={() => {
          actions.sortColumn(true);
          onClose();
        }}
      />
      <MenuActionRow
        plain
        label="Sort Z to A"
        icon={<SortIcon />}
        onClick={() => {
          actions.sortColumn(false);
          onClose();
        }}
      />
      <ContextMenuDivider />
      <div className="w-64 px-3 py-1.5 text-[12px]" onKeyDown={(e) => e.stopPropagation()}>
        <div className="mb-1 font-semibold">Filter by Values</div>
        <input
          aria-label="Search values"
          placeholder="Search"
          className={field}
          style={{ borderColor: c.palette.border }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-1 flex gap-3">
          <button
            type="button"
            className="cursor-pointer underline"
            onClick={() => setKept(new Set(values.map((v) => v.text)))}
          >
            Select All
          </button>
          <button
            type="button"
            className="cursor-pointer underline"
            onClick={() => setKept(new Set())}
          >
            Clear
          </button>
        </div>
        <ul className="mt-1 max-h-40 overflow-auto">
          {shown.map((v) => (
            <li key={v.text}>
              <label className="flex cursor-pointer items-center gap-1.5 py-0.5">
                <input
                  type="checkbox"
                  checked={kept.has(v.text)}
                  onChange={(e) => {
                    const next = new Set(kept);
                    if (e.target.checked) next.add(v.text);
                    else next.delete(v.text);
                    setKept(next);
                  }}
                />
                <span className="truncate">{v.text || '(Blanks)'}</span>
                <span className="ml-auto" style={{ color: c.palette.muted }}>
                  {v.count}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mb-1 mt-2 font-semibold">Filter by Condition</div>
        <select
          aria-label="Condition"
          className={field}
          style={{ borderColor: c.palette.border }}
          value={op}
          onChange={(e) => setOp(e.target.value as FilterCondition['op'] | '')}
        >
          <option value="">None</option>
          {CONDITION_OPS.map((o) => (
            <option key={o} value={o}>
              {CONDITION_LABELS[o]}
            </option>
          ))}
        </select>
        {op && op !== 'empty' && op !== 'notEmpty' ? (
          <input
            aria-label="Value"
            placeholder="Value"
            className={`${field} mt-1`}
            style={{ borderColor: c.palette.border }}
            value={a}
            onChange={(e) => setA(e.target.value)}
          />
        ) : null}
        {op === 'between' ? (
          <input
            aria-label="And"
            placeholder="And"
            className={`${field} mt-1`}
            style={{ borderColor: c.palette.border }}
            value={b}
            onChange={(e) => setB(e.target.value)}
          />
        ) : null}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="xs" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="xs" onClick={apply}>
            <FilterIcon /> OK
          </Button>
        </div>
      </div>
    </ContextMenu>
  );
}

function SortDialog({ actions, onClose }: { actions: SheetActions; onClose: () => void }) {
  const c = useSheetController();
  const g = c.selection.ranges[c.selection.ranges.length - 1]!;
  const [keys, setKeys] = useState<SortKey[]>([{ col: g.c1, ascending: true }]);
  const [header, setHeader] = useState(false);
  const cols = range(g.c1, g.c2);
  const rect = c.gridEl?.getBoundingClientRect();
  return (
    <ContextMenu
      position={{ x: (rect?.left ?? 100) + 60, y: (rect?.top ?? 100) + 40 }}
      label="Sort range"
      onClose={onClose}
    >
      <div className="w-72 px-3 py-2 text-[12px]" onKeyDown={(e) => e.stopPropagation()}>
        <div className="mb-2 font-semibold">Sort Range</div>
        <label className="mb-2 flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} />
          Data has a header row
        </label>
        {keys.map((k, i) => (
          <div key={i} className="mb-1 flex items-center gap-1.5">
            <span className="w-14">{i === 0 ? 'Sort by' : 'Then by'}</span>
            <select
              aria-label="Column"
              className="h-7 flex-1 rounded-md border bg-transparent px-1"
              style={{ borderColor: c.palette.border }}
              value={k.col}
              onChange={(e) =>
                setKeys(keys.map((x, j) => (j === i ? { ...x, col: Number(e.target.value) } : x)))
              }
            >
              {cols.map((col) => (
                <option key={col} value={col}>
                  Column {columnLetters(col)}
                </option>
              ))}
            </select>
            <select
              aria-label="Order"
              className="h-7 rounded-md border bg-transparent px-1"
              style={{ borderColor: c.palette.border }}
              value={k.ascending ? 'a' : 'z'}
              onChange={(e) =>
                setKeys(
                  keys.map((x, j) => (j === i ? { ...x, ascending: e.target.value === 'a' } : x)),
                )
              }
            >
              <option value="a">A to Z</option>
              <option value="z">Z to A</option>
            </select>
          </div>
        ))}
        <button
          type="button"
          className="mt-1 cursor-pointer underline"
          onClick={() => setKeys([...keys, { col: g.c1, ascending: true }])}
        >
          Add Another Sort Column
        </button>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="xs"

            onClick={() => {
              actions.sortRange(keys, header);
              onClose();
            }}
          >
            Sort
          </Button>
        </div>
      </div>
    </ContextMenu>
  );
}
