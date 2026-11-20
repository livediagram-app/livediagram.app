// read_sheet's cells as the MCP answers them (docs/specs/015-api/mcp-server.md "read_sheet"): a cell says its value and
// what it shows only where they differ from what was typed. Most cells of a sheet are typed text and numbers, whose
// input, value and display were the same thing three times.
import type { ReadCell } from '@liveplanner/agent-verbs';

export type LeanCell = Pick<ReadCell, 'at' | 'input' | 'invalid'> &
  Partial<Pick<ReadCell, 'value' | 'display'>>;

// Text and numbers read back as typed; a boolean or an empty value never does (TRUE is typed, true worked out).
const asTyped = (value: ReadCell['value']): string | null =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : null;

export function leanCell(cell: ReadCell): LeanCell {
  const shown = asTyped(cell.value);
  const sameValue = shown !== null && shown === cell.input;
  // What it shows is left out when it reads as the value does (or as the input, when the value is left out too).
  const sameDisplay = cell.display === (shown ?? cell.input);
  return {
    at: cell.at,
    input: cell.input,
    ...(sameValue ? {} : { value: cell.value }),
    ...(sameDisplay ? {} : { display: cell.display }),
    ...(cell.invalid === undefined ? {} : { invalid: cell.invalid }),
  };
}
