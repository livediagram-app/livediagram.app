// A sheet form's columns as the builder keeps them (docs/specs/030-forms/forms.md "Columns before any response",
// "Linked by column, not by heading"): the sheet's header row read from the sheet store's copy, and the write that
// gives it the headers it lacks, planned by @liveplanner/forms. Pure: useFormSheetColumns runs it.
import {
  sheetHeaders,
  sheetHeadersWrite,
  type FormDefinition,
  type FormSheetDestination,
} from '@liveplanner/forms';
import { cellKey, type Sheet, type SheetWrite } from '@liveplanner/sheets';

// How long after the form last changed its sheet is brought up to date, so typing a question's wording writes one
// header, not one per letter. Safe range 400..2000 ms.
export const FORM_COLUMNS_SYNC_MS = 800;

// The first row's text by column id.
export function headerRowOf(sheet: Pick<Sheet, 'layout' | 'cells'>): Map<string, string> {
  const out = new Map<string, string>();
  const row = sheet.layout.rows[0];
  if (!row) return out;
  for (const c of sheet.layout.cols) {
    const input = sheet.cells.get(cellKey(row, c))?.input;
    if (input && 's' in input) out.set(c, input.s);
  }
  return out;
}

// Each key's header as the form words it now (what `renamed` is the next time).
export function headersByKey(form: Pick<FormDefinition, 'sections'>): Map<string, string> {
  return new Map(sheetHeaders(form).map((h) => [h.key, h.header]));
}

// What the sheet needs: its header write (null when every header is there) and the columns the form should remember.
export function formColumnsSync(
  form: Pick<FormDefinition, 'sections'> & { sheet: FormSheetDestination },
  sheet: Pick<Sheet, 'layout' | 'cells'>,
  renamed?: ReadonlyMap<string, string>,
): { write: SheetWrite | null; columns: Record<string, string> } {
  return sheetHeadersWrite({
    form,
    layout: sheet.layout,
    header: headerRowOf(sheet),
    columns: form.sheet.columns,
    renamed,
  });
}

// A sync's identity: the sheet, each header's key and wording, and the columns remembered. The same identity, nothing
// to do again.
export function formColumnsKey(form: FormDefinition | null): string | null {
  if (!form?.sheet) return null;
  return JSON.stringify([
    form.sheet.tabId,
    form.sheet.sheetId,
    sheetHeaders(form).map((h) => [h.key, h.header]),
    form.sheet.columns ?? null,
  ]);
}
