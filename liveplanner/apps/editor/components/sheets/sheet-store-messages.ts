// What the sheet store says when a change to a sheet is refused (docs/specs/029-sheets/sheet-store.md "Changing a
// sheet"): the api's refusal codes in words, and a validation rule's refusal naming its cell.
import { formatA1, layoutIndex, splitCellKey, type SheetLayout } from '@liveplanner/sheets';

const REFUSALS: Partial<Record<string, string>> = {
  sheet_full: 'This sheet holds the most cells it can',
  sheets_full: 'This plan holds the most sheets it can',
  sheet_too_large: 'A sheet holds up to 10,000 rows and 200 columns',
  sheet_title_taken: 'Another sheet on this tab is called that',
  input_too_long: 'A cell holds up to 10,000 characters',
  sheet_not_found: 'This sheet is no longer in this plan',
  rules_full: 'This sheet holds the most rules it can',
};

// What a refused write says: a value a validation rule refuses names its cell and what the rule allows.
export function writeRefusalMessage(
  check: { error: string; at?: string; line?: string },
  layout?: SheetLayout,
): string {
  if (check.error === 'value_invalid' && check.line) {
    const ix = layout && check.at ? layoutIndex(layout) : null;
    const { r, c } = check.at ? splitCellKey(check.at) : { r: '', c: '' };
    const row = ix?.rowPos.get(r);
    const col = ix?.colPos.get(c);
    return row !== undefined && col !== undefined
      ? `${formatA1(row, col)}: ${check.line}`
      : check.line;
  }
  return sheetRefusalMessage(check.error);
}

export function sheetRefusalMessage(code: string | null): string {
  return (code && REFUSALS[code]) ?? "Couldn't save that change";
}
