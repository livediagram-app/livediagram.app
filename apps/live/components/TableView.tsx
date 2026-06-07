import { useEffect, useRef, useState } from 'react';
import {
  addTableColumn,
  addTableRow,
  defaultStrokeColor,
  defaultTextColor,
  PADDING_PX,
  removeTableColumn,
  removeTableRow,
  setTableCell,
  type TableElement,
} from '@livediagram/diagram';

// Cell font size per preset (element-space px; the canvas zoom scales
// it like everything else). 'scale' has no per-element basis on a grid,
// so it reads as the medium size.
const CELL_FONT_PX: Record<string, number> = { sm: 11, md: 13, lg: 16, scale: 13 };

const MIN_COL_PX = 30;

function ArrowIcon({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const d = {
    left: 'M11 7H3M3 7l3-3M3 7l3 3',
    right: 'M3 7h8M11 7l-3-3M11 7l-3 3',
    up: 'M7 11V3M7 3l3 3M7 3l-3 3',
    down: 'M7 3v8M7 11l-3-3M7 11l3-3',
  }[dir];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 4h8M5.5 4V2.8h3V4M4 4l.4 7.2h5.2L10 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Small "⋯" trigger that sits inside the table's top / left edge. Tapping
// it opens the column / row menu. Kept compact but with a 24px+ hit area
// (the padding) so it stays tappable on touch.
function Trigger({
  open,
  vertical,
  onClick,
}: {
  open: boolean;
  vertical?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={vertical ? 'Row options' : 'Column options'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`pointer-events-auto flex items-center justify-center rounded-full border border-slate-200 shadow-sm transition dark:border-slate-700 ${
        open ? 'bg-brand-500 text-white' : 'bg-white text-brand-600 dark:bg-slate-800'
      } ${vertical ? 'h-7 w-5' : 'h-5 w-7'}`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
        {vertical ? (
          <>
            <circle cx="7" cy="3.5" r="1.1" />
            <circle cx="7" cy="7" r="1.1" />
            <circle cx="7" cy="10.5" r="1.1" />
          </>
        ) : (
          <>
            <circle cx="3.5" cy="7" r="1.1" />
            <circle cx="7" cy="7" r="1.1" />
            <circle cx="10.5" cy="7" r="1.1" />
          </>
        )}
      </svg>
    </button>
  );
}

// Large, tappable menu row (icon + label). Min height 36px for touch.
function MenuButton({
  label,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-9 w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950'
          : 'text-slate-700 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-700'
      }`}
    >
      <span className="shrink-0">{children}</span>
      {label}
    </button>
  );
}

// Renders a TableElement as an editable grid filling the element box.
// Double-click a cell to edit; per-column / per-row insert + delete live
// in tap-to-open menus on the top / left edge. Columns can be given an
// explicit width by dragging the divider on their right edge; columns
// without an override share the remaining space as 1fr tracks. Cell
// padding follows the element's padding preset. Local UI state only;
// content + structure persist via onCommitCells / onCommitColWidths.
export function TableView({
  element,
  isSelected,
  readOnly,
  onCommitCells,
  onCommitColWidths,
}: {
  element: TableElement;
  isSelected: boolean;
  readOnly: boolean;
  onCommitCells: (id: string, cells: string[][]) => void;
  onCommitColWidths: (id: string, colWidths: (number | null)[]) => void;
}) {
  const rows = element.cells.length;
  const cols = element.cells[0]?.length ?? 0;
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<{ axis: 'col' | 'row'; index: number } | null>(null);
  // Live widths while dragging a column divider (committed on release).
  const [resizeWidths, setResizeWidths] = useState<(number | null)[] | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<(number | null)[] | null>(null);

  useEffect(() => {
    if (editing && (editing.r >= rows || editing.c >= cols)) setEditing(null);
  }, [editing, rows, cols]);

  useEffect(() => {
    if (!isSelected) setMenu(null);
  }, [isSelected]);

  useEffect(() => {
    if (editing) {
      const el = textareaRef.current;
      el?.focus();
      el?.select();
    }
  }, [editing]);

  const stroke = element.strokeColor ?? defaultStrokeColor(element);
  const textColor = element.textColor ?? defaultTextColor(element);
  const fontPx = CELL_FONT_PX[element.textSize ?? 'md'] ?? 13;
  const cellPad = PADDING_PX[element.padding ?? 'sm'];
  const headerFill = element.headerFill ?? `${stroke}22`;
  const headerTextColor = element.headerTextColor ?? textColor;
  const alignX = element.textAlignX ?? 'center';
  const alignY = element.textAlignY ?? 'middle';
  const justify = alignX === 'left' ? 'flex-start' : alignX === 'right' ? 'flex-end' : 'center';
  const alignItems = alignY === 'top' ? 'flex-start' : alignY === 'bottom' ? 'flex-end' : 'center';

  // Explicit px for overridden columns, 1fr for the rest (they share the
  // remaining width).
  const widths = resizeWidths ?? element.colWidths;
  const colTemplate = Array.from({ length: cols }, (_, c) => {
    const w = widths?.[c];
    return w != null ? `${w}px` : 'minmax(0, 1fr)';
  }).join(' ');

  const beginEdit = (r: number, c: number) => {
    if (readOnly || element.locked) return;
    setDraft(element.cells[r]?.[c] ?? '');
    setEditing({ r, c });
  };

  const commitCell = (r: number, c: number, text: string) => {
    onCommitCells(element.id, setTableCell(element, r, c, text).cells);
  };

  const apply = (next: { cells: string[][] }) => {
    onCommitCells(element.id, next.cells);
    setMenu(null);
  };
  const showControls = isSelected && !readOnly && !element.locked;
  const toggle = (axis: 'col' | 'row', index: number) =>
    setMenu((m) => (m && m.axis === axis && m.index === index ? null : { axis, index }));

  // Drag the right divider of column c to pin its width; other columns
  // stay auto and reflow. Reads the live track sizes + the rendered-to-
  // element scale (zoom) off the grid so it works at any zoom.
  const startColResize = (c: number) => (e: React.PointerEvent) => {
    if (!showControls) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const scale = element.width > 0 ? rect.width / element.width : 1;
    const tracks = getComputedStyle(grid)
      .gridTemplateColumns.split(' ')
      .map((t) => parseFloat(t));
    const base: (number | null)[] = Array.from(
      { length: cols },
      (_, i) => element.colWidths?.[i] ?? null,
    );
    const startWidthElem = (tracks[c] ?? rect.width / cols) / scale;
    const startX = e.clientX;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const next = [...base];
      next[c] = Math.max(MIN_COL_PX, Math.round(startWidthElem + dx));
      dragRef.current = next;
      setResizeWidths(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (dragRef.current) onCommitColWidths(element.id, dragRef.current);
      dragRef.current = null;
      setResizeWidths(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <>
      <div
        ref={gridRef}
        className="absolute inset-0 grid overflow-hidden"
        style={{
          gridTemplateColumns: colTemplate,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          border: `1px solid ${stroke}`,
          color: textColor,
        }}
      >
        {element.cells.flatMap((row, r) =>
          row.map((cell, c) => {
            const isHeader = (element.headerRow && r === 0) || (element.headerColumn && c === 0);
            const isEditingCell = editing?.r === r && editing?.c === c;
            return (
              <div
                key={`${r}-${c}`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  beginEdit(r, c);
                }}
                className="min-w-0 overflow-hidden"
                style={{
                  padding: cellPad,
                  borderRight: c < cols - 1 ? `1px solid ${stroke}` : undefined,
                  borderBottom: r < rows - 1 ? `1px solid ${stroke}` : undefined,
                  backgroundColor: isHeader ? headerFill : (element.fillColor ?? 'transparent'),
                  display: 'flex',
                  justifyContent: justify,
                  alignItems,
                  color: isHeader ? headerTextColor : undefined,
                  fontSize: fontPx,
                  fontWeight: isHeader ? 700 : element.textBold ? 600 : 400,
                  fontStyle: element.textItalic ? 'italic' : undefined,
                  textDecoration:
                    [
                      element.textUnderline && 'underline',
                      element.textStrikethrough && 'line-through',
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined,
                  lineHeight: 1.2,
                }}
              >
                {isEditingCell ? (
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={() => {
                      commitCell(r, c, draft);
                      setEditing(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditing(null);
                      } else if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        commitCell(r, c, draft);
                        setEditing(null);
                      } else if (e.key === 'Tab') {
                        e.preventDefault();
                        commitCell(r, c, draft);
                        const flat = r * cols + c + (e.shiftKey ? -1 : 1);
                        if (flat >= 0 && flat < rows * cols) {
                          const nr = Math.floor(flat / cols);
                          const nc = flat % cols;
                          setDraft(element.cells[nr]?.[nc] ?? '');
                          setEditing({ r: nr, c: nc });
                        } else {
                          setEditing(null);
                        }
                      }
                    }}
                    className="h-full w-full resize-none border-0 bg-transparent p-0 outline-none"
                    style={{
                      fontSize: fontPx,
                      color: isHeader ? headerTextColor : textColor,
                      textAlign: alignX,
                      fontWeight: isHeader ? 700 : element.textBold ? 600 : 400,
                    }}
                  />
                ) : (
                  <span className="whitespace-pre-wrap break-words">{cell}</span>
                )}
              </div>
            );
          }),
        )}
      </div>

      {/* Control layer: a non-clipped sibling so menus can spill past the
          box. Triggers live inside the top / left edge; column-resize
          dividers ride a grid that mirrors the table's column template so
          they sit exactly on each column boundary. */}
      {showControls ? (
        <div className="pointer-events-none absolute inset-0">
          {/* Column-resize dividers (between columns). */}
          <div
            className="pointer-events-none absolute inset-0 grid"
            style={{ gridTemplateColumns: colTemplate }}
          >
            {Array.from({ length: cols }, (_, c) => (
              <div key={`rz-${c}`} className="relative">
                {c < cols - 1 ? (
                  <div
                    onPointerDown={startColResize(c)}
                    onDoubleClick={(e) => e.stopPropagation()}
                    title="Drag to set column width"
                    className="group pointer-events-auto absolute -right-1 bottom-0 top-0 z-20 w-2 cursor-col-resize"
                  >
                    <div className="mx-auto h-full w-0.5 bg-brand-400/0 transition group-hover:bg-brand-400" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Column triggers along the top edge of the grid. */}
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={`col-${c}`}
              className="absolute top-0.5 -translate-x-1/2"
              style={{ left: `${((c + 0.5) / cols) * 100}%` }}
            >
              <Trigger
                open={menu?.axis === 'col' && menu.index === c}
                onClick={() => toggle('col', c)}
              />
              {menu?.axis === 'col' && menu.index === c ? (
                <div className="pointer-events-auto absolute left-1/2 top-7 z-30 w-36 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <MenuButton label="Insert left" onClick={() => apply(addTableColumn(element, c))}>
                    <ArrowIcon dir="left" />
                  </MenuButton>
                  <MenuButton
                    label="Insert right"
                    onClick={() => apply(addTableColumn(element, c + 1))}
                  >
                    <ArrowIcon dir="right" />
                  </MenuButton>
                  <MenuButton
                    label="Delete column"
                    danger
                    disabled={cols <= 1}
                    onClick={() => apply(removeTableColumn(element, c))}
                  >
                    <TrashIcon />
                  </MenuButton>
                </div>
              ) : null}
            </div>
          ))}

          {/* Row triggers along the left edge of the grid. */}
          {Array.from({ length: rows }, (_, r) => (
            <div
              key={`row-${r}`}
              className="absolute left-0.5 -translate-y-1/2"
              style={{ top: `${((r + 0.5) / rows) * 100}%` }}
            >
              <Trigger
                vertical
                open={menu?.axis === 'row' && menu.index === r}
                onClick={() => toggle('row', r)}
              />
              {menu?.axis === 'row' && menu.index === r ? (
                <div className="pointer-events-auto absolute left-7 top-1/2 z-30 w-36 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <MenuButton label="Insert above" onClick={() => apply(addTableRow(element, r))}>
                    <ArrowIcon dir="up" />
                  </MenuButton>
                  <MenuButton
                    label="Insert below"
                    onClick={() => apply(addTableRow(element, r + 1))}
                  >
                    <ArrowIcon dir="down" />
                  </MenuButton>
                  <MenuButton
                    label="Delete row"
                    danger
                    disabled={rows <= 1}
                    onClick={() => apply(removeTableRow(element, r))}
                  >
                    <TrashIcon />
                  </MenuButton>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
