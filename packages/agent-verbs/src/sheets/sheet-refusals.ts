// The sheet store's refusals in words (docs/specs/029-sheets/sheet-store.md "Limits"; docs/specs/026-plan/plan-agents.md
// "Errors that teach"): one line per code the api names, read by apiRefusalOf for the CLI and the MCP alike.
import type { SheetError } from '@livediagram/api-schema';

export const SHEET_REFUSAL_WORDS: Readonly<Record<SheetError, string>> = {
  sheet_not_found: 'no such sheet (it may have been deleted). list_sheets lists them.',
  sheet_exists: 'a sheet with that id is already there.',
  sheet_busy: 'the sheet is busy with other writes: try again.',
  sheet_title_taken: 'another sheet on that tab has that title: pick another.',
  sheet_full: 'this sheet holds the most cells it can (50,000 cells or 4 MB).',
  sheets_full: 'the document holds the most sheets or cells it can (200 sheets, 200,000 cells).',
  sheet_too_large: 'a sheet has up to 10,000 rows and 200 columns (A to GR).',
  input_too_long: 'an input is up to 10,000 characters, a formula up to 8,000.',
  formula_invalid: 'a formula cannot be read.',
  format_invalid: 'a format value is not one a cell takes.',
  axis_id_invalid: 'a row or column is not valid.',
  title_invalid: 'a sheet title is 1 to 60 characters.',
  merge_invalid: 'that merge is not valid.',
  filter_invalid: 'that filter is not valid.',
  write_too_large: 'a write changes up to 5,000 cells.',
  write_invalid: 'the change is not one a sheet takes.',
  tab_not_found: 'no such tab in this document.',
};
