import { useEffect, useRef, useState } from 'react';
import {
  addTableColumn,
  addTableRow,
  defaultStrokeColor,
  defaultTextColor,
  removeTableColumn,
  removeTableRow,
  setTableCell,
  type TableElement,
} from '@livediagram/diagram';

// Cell font size per preset (element-space px; the canvas zoom scales
// it like everything else). 'scale' has no per-element basis on a grid,
// so it reads as the medium size.
const CELL_FONT_PX: Record<string, number> = { sm: 11, md: 13, lg: 16, scale: 13 };

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
// Double-click a cell to edit its text; Enter / blur commits, Escape
// cancels, Tab / Shift+Tab moves to the next / previous cell. When the
// table is selected, a "⋯" trigger sits inside the top of each column /
// the left of each row; tapping it opens a large add-before / add-after
// / delete menu that drops INTO the table (away from the canvas's own
// top-left resize / anchor controls). Editing + menu state is local;
// committed grids persist via onCommitCells (the whole grid).
export function TableView({
  element,
  isSelected,
  readOnly,
  onCommitCells,
}: {
  element: TableElement;
  isSelected: boolean;
  readOnly: boolean;
  onCommitCells: (id: string, cells: string[][]) => void;
}) {
  const rows = element.cells.length;
  const cols = element.cells[0]?.length ?? 0;
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<{ axis: 'col' | 'row'; index: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Drop out of edit mode if the grid shrinks under the active cell.
  useEffect(() => {
    if (editing && (editing.r >= rows || editing.c >= cols)) setEditing(null);
  }, [editing, rows, cols]);

  // Close the structural menu whenever the table is deselected.
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
  const alignX = element.textAlignX ?? 'center';
  const alignY = element.textAlignY ?? 'middle';
  const justify = alignX === 'left' ? 'flex-start' : alignX === 'right' ? 'flex-end' : 'center';
  const alignItems = alignY === 'top' ? 'flex-start' : alignY === 'bottom' ? 'flex-end' : 'center';

  const beginEdit = (r: number, c: number) => {
    if (readOnly || element.locked) return;
    setDraft(element.cells[r]?.[c] ?? '');
    setEditing({ r, c });
  };

  const commitCell = (r: number, c: number, text: string) => {
    onCommitCells(element.id, setTableCell(element, r, c, text).cells);
  };

  // Structural edits reuse the pure helpers; each commits the whole grid
  // and closes the menu.
  const apply = (next: { cells: string[][] }) => {
    onCommitCells(element.id, next.cells);
    setMenu(null);
  };
  const showControls = isSelected && !readOnly && !element.locked;
  const toggle = (axis: 'col' | 'row', index: number) =>
    setMenu((m) => (m && m.axis === axis && m.index === index ? null : { axis, index }));

  return (
    <>
      <div
        className="absolute inset-0 grid overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
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
                className="min-w-0 overflow-hidden px-1.5 py-1"
                style={{
                  borderRight: c < cols - 1 ? `1px solid ${stroke}` : undefined,
                  borderBottom: r < rows - 1 ? `1px solid ${stroke}` : undefined,
                  backgroundColor: isHeader ? `${stroke}22` : (element.fillColor ?? 'transparent'),
                  display: 'flex',
                  justifyContent: justify,
                  alignItems,
                  fontSize: fontPx,
                  fontWeight: isHeader || element.textBold ? 600 : 400,
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
                    className="h-full w-full resize-none border-0 bg-white/90 p-0 text-center outline-none dark:bg-slate-900/90"
                    style={{
                      fontSize: fontPx,
                      color: textColor,
                      textAlign: alignX,
                      fontWeight: isHeader || element.textBold ? 600 : 400,
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

      {/* Control layer: a non-clipped sibling so an open menu can spill
          a little past the box. Triggers live INSIDE the top / left
          edge of the grid; menus drop down / right into the table,
          away from the canvas's own top-left resize + anchor controls. */}
      {showControls ? (
        <div className="pointer-events-none absolute inset-0">
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
                <div className="pointer-events-auto absolute left-1/2 top-7 z-10 w-36 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <MenuButton label="Insert left" onClick={() => apply(addTableColumn(element, c))}>
                    <PlusIcon />
                  </MenuButton>
                  <MenuButton
                    label="Insert right"
                    onClick={() => apply(addTableColumn(element, c + 1))}
                  >
                    <PlusIcon />
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
                <div className="pointer-events-auto absolute left-7 top-1/2 z-10 w-36 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <MenuButton label="Insert above" onClick={() => apply(addTableRow(element, r))}>
                    <PlusIcon />
                  </MenuButton>
                  <MenuButton
                    label="Insert below"
                    onClick={() => apply(addTableRow(element, r + 1))}
                  >
                    <PlusIcon />
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
