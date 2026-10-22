'use client';

// A `.csv` (or `.tsv`) file dropped on the canvas in Plan mode places a Sheet filled from it, titled by the file's
// name (docs/specs/029-sheets/sheet.md "Placing a sheet"); any other file, or any file in another mode, goes on to
// the canvas's own file drop. The file is read here; the Sheet makes the sheet when it first draws.
import { createShape } from '@livediagram/document';
import type { BoxedElement } from '@livediagram/document';
import { placeNewSheet } from '@/lib/sheet-seeds';
import { track } from '@/lib/telemetry';

// Big enough for any CSV a sheet can hold (10,000 rows by 200 columns of short values); larger is refused.
export const SHEET_CSV_DROP_BYTES_MAX = 8 * 1024 * 1024;

export function isSheetCsvFile(file: Pick<File, 'name' | 'type'>): boolean {
  return (
    /\.(csv|tsv)$/i.test(file.name) ||
    file.type === 'text/csv' ||
    file.type === 'text/tab-separated-values'
  );
}

export function csvFileTitle(name: string): string {
  return name.replace(/\.(csv|tsv|txt)$/i, '');
}

type AddBoxedAt = <T extends BoxedElement>(
  x: number,
  y: number,
  make: (x: number, y: number) => T,
) => void;

export function useSheetCsvDrop({
  planMode,
  blocked,
  addBoxedAt,
  dropOther,
  toast,
}: {
  planMode: boolean;
  blocked: boolean;
  addBoxedAt: AddBoxedAt;
  dropOther: (file: File, at: { x: number; y: number }) => void;
  toast: (message: string) => void;
}): (file: File, at: { x: number; y: number }) => void {
  return (file, at) => {
    if (!planMode || !isSheetCsvFile(file)) return dropOther(file, at);
    if (blocked) return;
    if (file.size > SHEET_CSV_DROP_BYTES_MAX) return toast('That file is too large for a sheet');
    void file.text().then((csv) => {
      const planSheet = placeNewSheet({ title: csvFileTitle(file.name), csv });
      addBoxedAt(at.x, at.y, (x, y) => ({ ...createShape('plan-sheet', x, y), planSheet }));
      track('Element', 'Added', 'PlanSheet');
      track('Sheet', 'Imported', 'Csv');
    });
  };
}
