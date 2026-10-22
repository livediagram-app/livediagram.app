'use client';

// The Custom Number Format popover (docs/specs/029-sheets/sheet.md "Formatting"): a Format Code field, a live Preview
// of the active cell's value in it, the codes people use most, then Cancel and Apply (one change, one undo step).
import { useState } from 'react';
import { Button, TextInput } from '@livedesign/ui';
import {
  FORMAT_CODE_MAX,
  cellKey,
  displayValue,
  formatCodeReads,
  isArray,
  isError,
  scalarOf,
} from '@livedesign/sheets';
import { OptionRows } from '@/components/plan/OptionRows';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { useSheetController } from '../sheet-controller';
import type { SheetActions } from '../useSheetActions';

const WIDTH_PX = 300;
// What a new code starts as, and what the preview shows without a number in the cell.
const CUSTOM_FORMAT_DEFAULT = '#,##0.00';
const PREVIEW_SAMPLE = 1234.5;
const CUSTOM_FORMAT_CODES = [
  '0.00',
  '#,##0',
  '0%',
  '0.00%',
  '£#,##0.00',
  '$#,##0.00',
  '0.00E+00',
  'dd/mm/yyyy',
  'd mmm yyyy',
  'mmm yyyy',
  'dddd',
  'hh:mm',
  '[h]:mm:ss',
  '@',
] as const;

export function SheetCustomFormat({
  actions,
  anchor,
  onClose,
}: {
  actions: SheetActions;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const c = useSheetController();
  const { r, c: col } = c.selection.active;
  const rowId = c.sheet.layout.rows[r]!;
  const colId = c.sheet.layout.cols[col]!;
  const own = c.sheet.cells.get(cellKey(rowId, colId))?.format;
  const [code, setCode] = useState(own?.nf === 'custom' && own.nc ? own.nc : CUSTOM_FORMAT_DEFAULT);
  const value = c.workbook.value(c.sheet.id, r, col);
  const v = isArray(value) ? scalarOf(value) : value;
  const sample = typeof v === 'number' || (typeof v === 'string' && v !== '') ? v : PREVIEW_SAMPLE;
  const reads = formatCodeReads(code);
  const preview =
    reads && !isError(sample)
      ? displayValue(sample, { nf: 'custom', nc: code }, c.locale).text
      : '';
  const apply = () => {
    if (!reads) return;
    actions.customFormat(code);
    onClose();
  };
  return (
    <AnchoredPopover anchor={anchor} name="Custom Number Format" width={WIDTH_PX} onClose={onClose}>
      <div
        className="flex max-h-[28rem] flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-[13px] text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">Custom Number Format</h2>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Format Code
          </span>
          <TextInput
            value={code}
            maxLength={FORMAT_CODE_MAX}
            spellCheck={false}
            invalid={!reads}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') apply();
            }}
          />
        </label>
        <p className="text-[12px]" aria-live="polite">
          {reads ? (
            <>
              <span className="text-slate-500 dark:text-slate-400">Preview: </span>
              <span className="font-medium">{preview}</span>
            </>
          ) : (
            <span className="text-red-600 dark:text-red-400">
              That format code can&apos;t be read
            </span>
          )}
        </p>
        <div className="min-h-0 overflow-y-auto">
          <OptionRows
            kind="single"
            label="Format Codes"
            selected={(CUSTOM_FORMAT_CODES as readonly string[]).includes(code) ? code : null}
            rows={CUSTOM_FORMAT_CODES.map((x) => ({
              id: x,
              label: x,
              trailing: (
                <span className="text-[12px] text-slate-500 dark:text-slate-400">
                  {isError(sample)
                    ? ''
                    : displayValue(sample, { nf: 'custom', nc: x }, c.locale).text}
                </span>
              ),
            }))}
            onPick={setCode}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
          <Button variant="secondary" size="xs" onClick={onClose}>
            Cancel
          </Button>
          <Button size="xs" disabled={!reads} onClick={apply}>
            Apply
          </Button>
        </div>
      </div>
    </AnchoredPopover>
  );
}
