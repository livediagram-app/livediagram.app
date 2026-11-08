'use client';

// Pointing while a formula is written (docs/specs/029-sheets/sheet.md "Formulas"): a click on a cell, or a drag over a
// range, writes its reference into the formula at the caret, and a drag grows the reference it made into a range.
// Shared by a placed Sheet (PlanSheetView) and the Plan tour's practice sheet.
import { useCallback, useRef } from 'react';
import { formatA1, formatRange, normaliseRange, quoteSheet } from '@liveplanner/sheets';
import { insertReference, referenceSlot } from './formula-assist';
import type { SheetController } from './sheet-controller';
import type { FormulaInput } from './useFormulaInput';
import type { PointRef } from './useSheetPointer';

export function useFormulaPointRef(c: SheetController, input: FormulaInput): PointRef {
  // Where the last pointed reference sits in the draft, so a drag grows it into a range.
  const pointed = useRef<{ start: number; end: number } | null>(null);
  return useCallback<PointRef>(
    (from, to, sheet) => {
      const e = c.editing;
      if (!e || !e.draft.startsWith('=')) return false;
      const slot =
        from.r === to.r && from.c === to.c ? referenceSlot(e.draft, input.caret) : pointed.current;
      if (!slot) return false;
      const cells =
        from.r === to.r && from.c === to.c
          ? formatA1(to.r, to.c)
          : formatRange(normaliseRange(from, to));
      const text = sheet ? `${quoteSheet(sheet)}!${cells}` : cells;
      const next = insertReference(e.draft, slot, text);
      pointed.current = next.slot;
      c.setEditing({ ...e, draft: next.draft });
      input.setCaret(next.caret);
      return true;
    },
    [c, input],
  );
}
