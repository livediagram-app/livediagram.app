'use client';

// Asked before a merge that would drop values (docs/specs/029-sheets/sheet.md "Merge"): the toolbar's Merge menu and
// the cell menu ask the same thing, naming the range.
import { Button } from '@livediagram/ui';
import { formatRange, type GridRange } from '@livediagram/sheets';

export function SheetMergeConfirm({
  range,
  onCancel,
  onMerge,
}: {
  range: GridRange;
  onCancel: () => void;
  onMerge: () => void;
}) {
  return (
    <div className="w-64 px-3 py-2 text-[13px]" role="alertdialog" aria-label="Merge Cells">
      <p>Merging keeps only the top-left value. Merge {formatRange(range)}?</p>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="xs" onClick={onMerge}>
          Merge
        </Button>
      </div>
    </div>
  );
}
