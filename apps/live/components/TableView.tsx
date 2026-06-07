import { useEffect, useRef, useState } from 'react';
import {
  defaultStrokeColor,
  defaultTextColor,
  setTableCell,
  type TableElement,
} from '@livediagram/diagram';

// Cell font size per preset (element-space px; the canvas zoom scales
// it like everything else). 'scale' has no per-element basis on a grid,
// so it reads as the medium size.
const CELL_FONT_PX: Record<string, number> = { sm: 11, md: 13, lg: 16, scale: 13 };

// Renders a TableElement as an editable grid filling the element box.
// Double-click a cell to edit its text; Enter / blur commits, Escape
// cancels, Tab / Shift+Tab moves to the next / previous cell. Editing
// state is local; committed text is persisted via onCommitCells (the
// whole grid, mirroring how labels commit).
export function TableView({
  element,
  readOnly,
  onCommitCells,
}: {
  element: TableElement;
  readOnly: boolean;
  onCommitCells: (id: string, cells: string[][]) => void;
}) {
  const rows = element.cells.length;
  const cols = element.cells[0]?.length ?? 0;
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [draft, setDraft] = useState('');
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

  const commit = (r: number, c: number, text: string) => {
    const next = setTableCell(element, r, c, text).cells;
    onCommitCells(element.id, next);
  };

  return (
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
                    commit(r, c, draft);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditing(null);
                    } else if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      commit(r, c, draft);
                      setEditing(null);
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      commit(r, c, draft);
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
  );
}
