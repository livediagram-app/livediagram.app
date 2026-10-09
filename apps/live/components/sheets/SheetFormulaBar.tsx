'use client';

// The formula bar (docs/specs/029-sheets/sheet.md "Formula bar"): the name box (the selection; a reference or range
// typed there and Enter selects it) and fx with the active cell's input as typed, edited there as in the cell. A
// spilled cell shows its formula greyed. Read-only for someone who may not edit.
import { useEffect, useRef, useState } from 'react';
import {
  findRangeName,
  formatRange,
  idRangeOf,
  parseRangeText,
  posRangeOf,
  rangeNameProblem,
  type GridRange,
  type SheetLayout,
} from '@livediagram/sheets';
import { useSheetController } from './sheet-controller';
import { ColouredDraft, FunctionAssist } from './SheetCellEditor';
import { inputTextAt, type SheetActions } from './useSheetActions';
import type { FormulaInput } from './useFormulaInput';

// The named range that is exactly `range`, if one is.
function nameOfRange(layout: SheetLayout, range: GridRange): string | null {
  for (const x of layout.names ?? []) {
    const at = posRangeOf(layout, x);
    if (at && at.r1 === range.r1 && at.c1 === range.c1 && at.r2 === range.r2 && at.c2 === range.c2)
      return x.name;
  }
  return null;
}

// The name box's Enter (sheet.md "Formula bar"): a reference or range selects it; a name this sheet has selects its
// range; a new name names the selection, or says why it cannot.
export function enterNameBox(
  c: ReturnType<typeof useSheetController>,
  actions: SheetActions,
  text: string,
): void {
  if (!text) return;
  const target = parseRangeText(text);
  if (target) {
    if (target.r2 < c.grid.rows && target.c2 < c.grid.cols) actions.goTo(target);
    else c.toast(`There is no ${text.toUpperCase()} on this sheet`);
    return;
  }
  const layout = c.sheet.layout;
  const named = findRangeName(layout, text);
  const at = named && posRangeOf(layout, named);
  if (at) return actions.goTo(at);
  if (!c.canEdit) return;
  const problem = rangeNameProblem(text, layout);
  if (problem) return c.toast(problem);
  const sel = c.selection.ranges[c.selection.ranges.length - 1]!;
  const ids = idRangeOf(layout, sel.r1, sel.c1, sel.r2, sel.c2);
  if (ids) c.write({ kind: 'layout', changes: [{ k: 'name', name: text, range: ids }] }, 'Name');
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function SheetFormulaBar({
  actions,
  input,
}: {
  actions: SheetActions;
  input: FormulaInput;
}) {
  const c = useSheetController();
  const range = c.selection.ranges[c.selection.ranges.length - 1]!;
  // The selection, or its name when it is exactly a named range (sheet.md "Named ranges").
  const name = nameOfRange(c.sheet.layout, range) ?? formatRange(range);
  const [box, setBox] = useState<string | null>(null);
  const barRef = useRef<HTMLTextAreaElement | null>(null);
  const editing = c.editing;
  const { r, c: col } = c.selection.active;
  // A spilled cell: its owner's formula, greyed.
  const owner = c.workbook.spillOwnerAt(c.sheet.id, r, col);
  const shown = editing
    ? editing.draft
    : owner
      ? inputTextAt(c, owner.r, owner.c)
      : inputTextAt(c, r, col);
  const lines = Math.min(3, shown.split('\n').length);
  useEffect(() => {
    if (editing?.origin === 'bar') barRef.current?.focus();
  }, [editing?.origin]);
  return (
    <div
      data-keeps-escape
      className="relative flex shrink-0 items-start border-b text-[12px]"
      style={{ minHeight: 28, borderColor: c.palette.cardBorder, color: c.palette.text }}
      onPointerDown={stop}
      onDoubleClick={stop}
    >
      <input
        aria-label="Name box"
        // A small rounded field, as the name box reads in a modern spreadsheet.
        className="my-[3px] ml-1.5 h-[22px] w-20 shrink-0 rounded-md border px-2 text-center font-mono text-[11.5px] outline-none transition focus:ring-2"
        style={
          {
            borderColor: c.palette.cardBorder,
            backgroundColor: c.palette.column,
            '--tw-ring-color': `color-mix(in srgb, ${c.palette.focus} 35%, transparent)`,
          } as React.CSSProperties
        }
        value={box ?? name}
        onFocus={() => setBox(name)}
        onBlur={() => setBox(null)}
        onChange={(e) => setBox(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            enterNameBox(c, actions, (box ?? '').trim());
            setBox(null);
            c.focusGrid();
          } else if (e.key === 'Escape') {
            setBox(null);
            c.focusGrid();
          }
        }}
      />
      <span
        className="ml-1.5 flex h-7 w-8 shrink-0 items-center justify-center border-l font-serif text-[13px] italic"
        style={{ color: c.palette.muted, borderColor: c.palette.cardBorder }}
        aria-hidden
      >
        fx
      </span>
      <div className="relative min-w-0 flex-1">
        {editing?.origin === 'bar' ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-1 py-1.5 font-mono"
            >
              <ColouredDraft draft={editing.draft} />
            </div>
            <textarea
              ref={barRef}
              data-sheet-editor={c.sheet.id}
              aria-label="Formula bar"
              value={editing.draft}
              spellCheck={false}
              rows={lines}
              onChange={input.onChange}
              onKeyDown={input.onKeyDown}
              onSelect={(e) => input.setCaret(e.currentTarget.selectionStart ?? 0)}
              className="relative block w-full resize-none bg-transparent px-1 py-1.5 font-mono outline-none"
              style={{ color: 'transparent', caretColor: c.palette.text }}
            />
            <FunctionAssist
              input={input}
              draft={editing.draft}
              onPick={(n) => input.accept(n, barRef.current)}
            />
            {input.error ? (
              <div
                role="alert"
                className="absolute left-0 top-full z-20 mt-1 rounded-md bg-red-600 px-2 py-1 text-[12px] text-white shadow"
              >
                {input.error.message}
              </div>
            ) : null}
          </>
        ) : (
          <textarea
            aria-label="Formula bar"
            readOnly={!c.canEdit || !!owner}
            value={shown}
            rows={lines}
            spellCheck={false}
            className="block w-full resize-none bg-transparent px-1 py-1.5 font-mono outline-none"
            style={{ color: owner ? c.palette.muted : undefined }}
            onFocus={() => {
              if (c.canEdit && !owner && !editing) actions.startEdit('bar');
            }}
            onChange={() => {}}
          />
        )}
      </div>
    </div>
  );
}
