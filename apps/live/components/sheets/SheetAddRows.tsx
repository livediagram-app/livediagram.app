'use client';

// Below the last row (docs/specs/029-sheets/sheet.md "The grid"): **Add 100 Rows**, with a field to change the
// number, growing the grid up to its limit. Only for someone who may edit, and gone at the limit.
import { useState } from 'react';
import { SHEET_ROWS_MAX } from '@livediagram/sheets';
import { useSheetController } from './sheet-controller';

export const ADD_ROWS_PX = 44;
const ADD_ROWS_DEFAULT = 100;

export function SheetAddRows({ top, onAdd }: { top: number; onAdd: (count: number) => void }) {
  const c = useSheetController();
  const [count, setCount] = useState(String(ADD_ROWS_DEFAULT));
  const room = SHEET_ROWS_MAX - c.sheet.layout.rows.length;
  if (!c.canEdit || room <= 0) return null;
  const n = Math.max(1, Math.min(room, Math.floor(Number(count)) || ADD_ROWS_DEFAULT));
  const add = () => {
    onAdd(n);
    c.focusGrid();
  };
  return (
    <div
      className="absolute flex items-center gap-2 px-2 text-[12px]"
      style={{
        left: c.geometry.headW,
        top: c.geometry.headH + top,
        height: ADD_ROWS_PX,
        color: c.palette.muted,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="cursor-pointer rounded-md border px-2 py-1"
        style={{
          borderColor: c.palette.border,
          color: c.palette.text,
          backgroundColor: c.palette.surface,
        }}
        onClick={add}
      >
        Add
      </button>
      <input
        aria-label="Rows to add"
        inputMode="numeric"
        className="h-7 w-16 rounded-md border bg-transparent px-2 text-right tabular-nums outline-none"
        style={{ borderColor: c.palette.border, color: c.palette.text }}
        value={count}
        onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') add();
        }}
      />
      <span>more rows at the bottom</span>
    </div>
  );
}
