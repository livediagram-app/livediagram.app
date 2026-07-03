import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { ElementLink, TableElement } from '@livediagram/diagram';
import { Tooltip } from '@/components/primitives/Tooltip';
import { CellLinkIcon } from '@/components/canvas/table-icons';
import { TableCellEditor } from '@/components/canvas/TableCellEditor';
import { describeLink } from '@/lib/link-label';

// Cell font size per preset (element-space px; the canvas zoom scales
// it like everything else). 'scale' has no per-element basis on a grid,
// so it reads as the medium size.
export const CELL_FONT_PX: Record<string, number> = { sm: 11, md: 13, lg: 16, scale: 13 };

// 'scale' cell text tracks the row height (~40%), clamped to a legible range,
// so it grows / shrinks as the table is resized. Shared by the table-wide
// default and the per-cell override so the two can't drift.
export const scaleCellFontPx = (rowH: number): number =>
  Math.max(9, Math.min(40, Math.round(rowH * 0.4)));

// Key for the shift-click multi-cell selection set.
export const cellKey = (r: number, c: number): string => `${r}:${c}`;

// Everything one cell needs from TableView's scope, bundled once per
// table render so the per-cell call site stays `<TableCellView r c text
// ctx />`. Style tokens are the table-wide resolutions; handlers are
// the parent's selection / menu / edit machinery.
export type TableCellCtx = {
  element: TableElement;
  rows: number;
  cols: number;
  showControls: boolean;
  selectedCell: { r: number; c: number } | null;
  extraCells: Set<string>;
  editing: { r: number; c: number } | null;
  editorRef: RefObject<HTMLDivElement | null>;
  cellPad: number;
  gridBorder: string | undefined;
  headerFill: string;
  headerTextColor: string | undefined;
  alignItems: string;
  alignX: 'left' | 'center' | 'right';
  fontPx: number;
  rowH: number;
  stroke: string;
  tabSummaries: { id: string; name: string }[];
  onFollowLink?: (link: ElementLink) => void;
  beginEdit: (r: number, c: number) => void;
  setSelectedCell: (v: { r: number; c: number } | null) => void;
  setExtraCells: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setCellMenuPos: (v: { x: number; y: number } | null) => void;
  menuPositionFor: (cells: { r: number; c: number }[]) => { x: number; y: number };
  selectionCells: () => { r: number; c: number }[];
  pressedCellRef: { current: { r: number; c: number } | null };
  cellLongPress: { onPointerDown: (e: ReactPointerEvent) => void };
  cancelHoverClear: () => void;
  setHoveredCol: (c: number | null) => void;
  setHoveredRow: (r: number | null) => void;
  commitCell: (r: number, c: number, text: string) => void;
  commitAndAppendRow: (r: number, c: number, text: string) => void;
  moveTo: (fromR: number, fromC: number, toR: number, toC: number) => void;
  caretInfo: () => {
    collapsed: boolean;
    atStart: boolean;
    atEnd: boolean;
    firstLine: boolean;
    lastLine: boolean;
  };
  setEditing: (v: { r: number; c: number } | null) => void;
  onCommitTable: (
    id: string,
    patch: Partial<Pick<TableElement, 'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'>>,
  ) => void;
};

// One table cell (spec/09 Table), lifted out of TableView's render
// loop: the header / zebra / per-cell style resolution, the selection +
// context-menu + shift-multi-select gestures, the in-cell editor mount,
// and the linked-cell badge. Pure render slice — all state stays in
// TableView and arrives through ctx.
export function TableCellView({
  r,
  c,
  text: cell,
  ctx,
}: {
  r: number;
  c: number;
  text: string;
  ctx: TableCellCtx;
}) {
  const {
    element,
    rows,
    cols,
    showControls,
    selectedCell,
    extraCells,
    editing,
    editorRef,
    cellPad,
    gridBorder,
    headerFill,
    headerTextColor,
    alignItems,
    alignX,
    fontPx,
    rowH,
    stroke,
    tabSummaries,
    onFollowLink,
    beginEdit,
    setSelectedCell,
    setExtraCells,
    setCellMenuPos,
    menuPositionFor,
    selectionCells,
    pressedCellRef,
    cellLongPress,
    cancelHoverClear,
    setHoveredCol,
    setHoveredRow,
    commitCell,
    commitAndAppendRow,
    moveTo,
    caretInfo,
    setEditing,
    onCommitTable,
  } = ctx;
  const isHeader = (element.headerRow && r === 0) || (element.headerColumn && c === 0);
  const bodyRow = element.headerRow ? r - 1 : r;
  const zebraBg =
    element.zebra && !isHeader && bodyRow >= 0 && bodyRow % 2 === 1 ? `${stroke}11` : null;
  const cs = element.cellStyles?.[r]?.[c] ?? null;
  const isSelCell =
    (selectedCell?.r === r && selectedCell?.c === c) || extraCells.has(cellKey(r, c));
  const cellAlignX = cs?.alignX ?? alignX;
  const cellJustify =
    cellAlignX === 'left' ? 'flex-start' : cellAlignX === 'right' ? 'flex-end' : 'center';
  const cellFontPx = cs?.textSize
    ? cs.textSize === 'scale'
      ? scaleCellFontPx(rowH)
      : (CELL_FONT_PX[cs.textSize] ?? fontPx)
    : fontPx;
  const isEditingCell = editing?.r === r && editing?.c === c;
  return (
    <div
      key={`${r}-${c}`}
      role={isHeader ? (element.headerRow && r === 0 ? 'columnheader' : 'rowheader') : 'cell'}
      aria-colindex={c + 1}
      onMouseEnter={() => {
        cancelHoverClear();
        setHoveredCol(c);
        setHoveredRow(r);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        beginEdit(r, c);
      }}
      onClick={(e) => {
        if (showControls && !isEditingCell) {
          e.stopPropagation();
          // Shift presses were consumed at pointerdown (the
          // multi-cell toggle); the trailing click must not
          // collapse the selection it just built.
          if (e.shiftKey) return;
          setSelectedCell({ r, c });
          setExtraCells(new Set());
        }
      }}
      onContextMenu={(e) => {
        // Right-click opens the per-cell context menu (spec/09) —
        // the explicit gesture on desktop; touch long-presses
        // instead (cellLongPress). Swallowed so the element
        // context menu doesn't also open over it. On a cell
        // already in the multi-selection the set is kept (the
        // menu acts on all of it); elsewhere it re-anchors.
        if (showControls && !isEditingCell) {
          e.preventDefault();
          e.stopPropagation();
          const inSelection =
            (selectedCell?.r === r && selectedCell?.c === c) || extraCells.has(cellKey(r, c));
          if (!inSelection) {
            setSelectedCell({ r, c });
            setExtraCells(new Set());
          }
          // Beside the acting selection (right, else left), never
          // over it — matching the element menus.
          setCellMenuPos(menuPositionFor(inSelection ? selectionCells() : [{ r, c }]));
        }
      }}
      onPointerDown={
        showControls && !isEditingCell
          ? (e) => {
              if (e.shiftKey && e.button === 0) {
                // Shift-click multi-cell select happens HERE, on
                // pointerdown with the press claimed: the element
                // layer's own shift handler fires on pointerdown
                // too and would toggle the whole TABLE into the
                // canvas multi-select (tearing down the cell
                // selection) before a click ever arrived.
                e.stopPropagation();
                if (!selectedCell) {
                  setSelectedCell({ r, c });
                  return;
                }
                if (r === selectedCell.r && c === selectedCell.c) return;
                setExtraCells((prev) => {
                  const next = new Set(prev);
                  const key = cellKey(r, c);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                });
                return;
              }
              pressedCellRef.current = { r, c };
              cellLongPress.onPointerDown(e);
            }
          : undefined
      }
      className="relative min-w-0 overflow-hidden"
      style={{
        padding: cellPad,
        borderRight: c < cols - 1 ? gridBorder : undefined,
        borderBottom: r < rows - 1 ? gridBorder : undefined,
        backgroundColor:
          cs?.bg ?? (isHeader ? headerFill : (zebraBg ?? element.fillColor ?? 'transparent')),
        display: 'flex',
        justifyContent: cellJustify,
        alignItems,
        color: cs?.textColor ?? (isHeader ? headerTextColor : undefined),
        // Selection outline in the table's own accent (its
        // stroke, which tracks the theme) rather than a fixed
        // light blue that clashes on non-default themes. Thin +
        // softened with transparency so it marks the cell
        // without shouting over the content.
        outline: isSelCell
          ? `1.5px solid color-mix(in srgb, ${stroke} 55%, transparent)`
          : undefined,
        outlineOffset: isSelCell ? '-1.5px' : undefined,
        fontSize: cellFontPx,
        fontWeight: (cs?.bold ?? (isHeader || element.textBold)) ? (isHeader ? 700 : 600) : 400,
        fontStyle: (cs?.italic ?? element.textItalic) ? 'italic' : undefined,
        textDecoration:
          [
            (cs?.underline ?? element.textUnderline) && 'underline',
            element.textStrikethrough && 'line-through',
          ]
            .filter(Boolean)
            .join(' ') || undefined,
        lineHeight: 1.2,
      }}
    >
      {isEditingCell ? (
        <TableCellEditor
          editorRef={editorRef}
          element={element}
          r={r}
          c={c}
          rows={rows}
          cols={cols}
          alignX={cellAlignX}
          onCommitTable={onCommitTable}
          commitCell={commitCell}
          commitAndAppendRow={commitAndAppendRow}
          moveTo={moveTo}
          caretInfo={caretInfo}
          setEditing={setEditing}
        />
      ) : (
        <span className="whitespace-pre-wrap break-words">{cell}</span>
      )}
      {/* Linked-cell badge: a small link glyph in the corner.
          Clicking it follows the link (works in view + edit
          sessions) without selecting / editing the cell. */}
      {cs?.link && !isEditingCell ? (
        <Tooltip title="Follow link" description={describeLink(cs.link, tabSummaries)}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (cs.link) onFollowLink?.(cs.link);
            }}
            aria-label="Follow cell link"
            className="pointer-events-auto absolute right-0.5 top-0.5 z-[var(--z-panel)] flex h-4 w-4 items-center justify-center rounded text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
          >
            <CellLinkIcon />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
