// The grid's keys (docs/specs/029-sheets/sheet.md "Keyboard"; blueprint sheet-element.md "Keyboard and focus"): a key on
// the focused grid, read by sheet-keys.ts and done. SheetGrid.tsx's onKeyDown, a plain function it calls.
import type { KeyboardEvent } from 'react';
import {
  cycleInRange,
  homeEnd,
  pageSelection,
  selectAll,
  selectCols,
  selectRows,
  selectsSeveral,
} from '@liveplanner/sheets';
import { restorePlanElement } from '@/hooks/plan/maximised-plan';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { focusOpenEdit } from './focus-open-edit';
import type { SheetController } from './sheet-controller';
import { cellBox, pageRows } from './sheet-geometry';
import { sheetKey } from './sheet-keys';
import type { SheetActions } from './useSheetActions';
import type { useSheetClipboard } from './useSheetClipboard';
import type { useSheetPointer } from './useSheetPointer';

export type SheetGridKeys = {
  c: SheetController;
  actions: SheetActions;
  pointer: ReturnType<typeof useSheetPointer>;
  clipboard: ReturnType<typeof useSheetClipboard>;
  bridge: SheetsBridge | null;
  elementId: string;
};

export function sheetGridKeyDown(
  e: KeyboardEvent<HTMLDivElement>,
  { c, actions, pointer, clipboard, bridge, elementId }: SheetGridKeys,
) {
  if (e.target !== e.currentTarget) return;
  // The grid holds focus while an edit stays open (a toolbar button pressed mid-way through a formula it could not
  // save): the key is the edit's, never lost. Escape gives it up; any other key goes on in it.
  if (c.editing) {
    if (e.key === 'Escape') {
      e.preventDefault();
      actions.cancelEdit();
    } else focusOpenEdit(c.sheet.id);
    return;
  }
  // A bare Space is held for Space-drag panning; it types a space on release when no pan used it.
  if (pointer.pan.onKeyDown(e)) return;
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
    e.preventDefault();
    void clipboard.pasteSpecial('values');
    return;
  }
  const cmd = sheetKey(e);
  if (!cmd) return;
  // Copy, cut and paste arrive as clipboard events; undo and redo reach the canvas.
  e.preventDefault();
  e.stopPropagation();
  const sel = c.selectionNow();
  const range = sel.ranges[sel.ranges.length - 1]!;
  // A clicked merge is one cell, not a range to cycle through.
  const multi = selectsSeveral(sel, c.grid);
  switch (cmd.kind) {
    case 'move':
      return actions.move(cmd.dir, cmd.jump, cmd.extend);
    case 'tab':
      return multi
        ? c.setSelection(cycleInRange(sel, cmd.back ? 'prev-col' : 'next-col', c.grid))
        : actions.move(cmd.back ? 'left' : 'right');
    case 'enter':
      if (multi)
        return c.setSelection(cycleInRange(sel, cmd.back ? 'prev-row' : 'next-row', c.grid));
      return cmd.back ? actions.move('up') : actions.startEdit('cell');
    case 'edit':
      return actions.startEdit('cell');
    case 'type':
      return actions.startEdit('type', cmd.text);
    case 'home':
    case 'end': {
      const ext = c.workbook.extent(c.sheet.id);
      return c.setSelection(
        homeEnd(sel, cmd.kind, cmd.toSheet, c.grid, {
          r: Math.max(0, ext.rows - 1),
          c: Math.max(0, ext.cols - 1),
        }),
      );
    }
    case 'page':
      return c.setSelection(
        pageSelection(
          sel,
          (cmd.up ? -1 : 1) * pageRows(c.geometry, c.view.height - c.geometry.headH),
          c.grid,
        ),
      );
    case 'selectAll':
      return c.setSelection(selectAll(sel, c.grid));
    case 'selectRow':
      return c.setSelection(selectRows(range.r1, range.r2, c.grid));
    case 'selectCol':
      return c.setSelection(selectCols(range.c1, range.c2, c.grid));
    case 'clear':
      return c.canEdit ? actions.clear('inputs') : undefined;
    case 'toggle':
      return c.canEdit ? actions.toggle(cmd.flag) : undefined;
    case 'now':
      return c.canEdit ? actions.typeNow(cmd.what) : undefined;
    case 'fill':
      return c.canEdit ? actions.fillEdge(cmd.dir) : undefined;
    case 'numberFormat':
      return c.canEdit ? actions.numberFormat(cmd.nf) : undefined;
    case 'find':
      return c.setFindOpen(cmd.replace && c.canEdit ? 'replace' : 'find');
    case 'menu': {
      const rect = c.gridEl?.getBoundingClientRect();
      const box = cellBox(c.geometry, sel.active.r, sel.active.c, c.scroll);
      if (rect)
        c.setMenu({
          kind: 'cell',
          x: rect.left + c.geometry.headW + box.x,
          y: rect.top + c.geometry.headH + box.y + box.h,
        });
      return;
    }
    case 'dropdown':
      actions.openDropdown();
      return;
    case 'escape':
      // Paint Format lets go first (sheet.md "Paint Format").
      if (c.rules.paint) return actions.paintStop();
      if (c.marquee) return c.setMarquee(null);
      if (c.findOpen) return c.setFindOpen(null);
      if (c.maximised) return restorePlanElement();
      // Out of the grid: the Sheet element is selected on the canvas, and the canvas has the keys again.
      c.gridEl?.blur();
      bridge?.selectElement(elementId);
      return;
  }
}
