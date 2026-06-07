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
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 2.5v7M2.5 6h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 3.5h7M5 3.5V2.5h2v1M3.5 3.5l.4 6h4.2l.4-6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Small floating control button. stopPropagation on pointer-down so
// clicking a control never starts a table drag or clears the selection.
function CtrlButton({
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 ${
        danger
          ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950'
          : 'text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

// Renders a TableElement as an editable grid filling the element box.
// Double-click a cell to edit its text; Enter / blur commits, Escape
// cancels, Tab / Shift+Tab moves to the next / previous cell. When the
// table is selected, hovering a column's top gutter / a row's left
// gutter reveals floating add-left/right (or above/below) + delete
// controls. Editing + control state is local; committed grids persist
// via onCommitCells (the whole grid, mirroring how labels commit).
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
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Drop out of edit mode if the grid shrinks under the active cell
  // (e.g. a row/column was removed while editing).
  useEffect(() => {
    if (editing && (editing.r >= rows || editing.c >= cols)) setEditing(null);
  }, [editing, rows, cols]);

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

  // Structural edits reuse the pure helpers; each commits the whole grid.
  const apply = (next: { cells: string[][] }) => onCommitCells(element.id, next.cells);
  const showControls = isSelected && !readOnly && !element.locked;

  return (
    <>
      <div
        className="absolute inset-0 grid overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          // Outer frame; inner cell borders draw the grid.
          border: `1px solid ${stroke}`,
          color: textColor,
        }}
      >
        {element.cells.flatMap((row, r) =>
          row.map((cell, c) => {
            const isHeader = element.headerRow && r === 0;
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

      {/* Control layer: a non-clipped sibling so the gutter toolbars can
          float outside the grid box. Container ignores pointer events;
          the gutters + buttons re-enable them. */}
      {showControls ? (
        <div className="pointer-events-none absolute inset-0">
          {/* Column gutter (above the grid). Hover a column to reveal
              its add-left / delete / add-right toolbar. */}
          <div
            className="absolute inset-x-0 -top-3 grid h-3"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: cols }, (_, c) => (
              <div
                key={c}
                className="pointer-events-auto relative"
                onMouseEnter={() => setHoverCol(c)}
                onMouseLeave={() => setHoverCol((v) => (v === c ? null : v))}
              >
                <div className="mx-auto h-1 w-5 rounded-full bg-brand-300/70" />
                {hoverCol === c ? (
                  <div className="absolute bottom-full left-1/2 mb-0.5 flex -translate-x-1/2 gap-0.5">
                    <CtrlButton
                      title="Add column to the left"
                      onClick={() => apply(addTableColumn(element, c))}
                    >
                      <PlusIcon />
                    </CtrlButton>
                    <CtrlButton
                      title="Delete column"
                      danger
                      disabled={cols <= 1}
                      onClick={() => apply(removeTableColumn(element, c))}
                    >
                      <TrashIcon />
                    </CtrlButton>
                    <CtrlButton
                      title="Add column to the right"
                      onClick={() => apply(addTableColumn(element, c + 1))}
                    >
                      <PlusIcon />
                    </CtrlButton>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Row gutter (left of the grid). Hover a row to reveal its
              add-above / delete / add-below toolbar. */}
          <div
            className="absolute inset-y-0 -left-3 grid w-3"
            style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}
          >
            {Array.from({ length: rows }, (_, r) => (
              <div
                key={r}
                className="pointer-events-auto relative flex items-center"
                onMouseEnter={() => setHoverRow(r)}
                onMouseLeave={() => setHoverRow((v) => (v === r ? null : v))}
              >
                <div className="my-auto h-5 w-1 rounded-full bg-brand-300/70" />
                {hoverRow === r ? (
                  <div className="absolute right-full top-1/2 mr-0.5 flex -translate-y-1/2 flex-col gap-0.5">
                    <CtrlButton
                      title="Add row above"
                      onClick={() => apply(addTableRow(element, r))}
                    >
                      <PlusIcon />
                    </CtrlButton>
                    <CtrlButton
                      title="Delete row"
                      danger
                      disabled={rows <= 1}
                      onClick={() => apply(removeTableRow(element, r))}
                    >
                      <TrashIcon />
                    </CtrlButton>
                    <CtrlButton
                      title="Add row below"
                      onClick={() => apply(addTableRow(element, r + 1))}
                    >
                      <PlusIcon />
                    </CtrlButton>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
