// What the evaluator and the functions see while working out one formula (blueprint sheets-engine.md "Workbook
// and recalculation"). The workbook provides it; functions never reach the workbook itself.
import type { CardSource } from '../cards';
import type { SheetsCtx } from '../formula/stored';
import type { Value } from '../formula/values';

// A rectangle of one sheet, by positions, inclusive.
export type RangeRef = { sheetId: string; r1: number; c1: number; r2: number; c2: number };

// What evaluating a node gives: a value, or a reference a function may want as a reference (ROW, INDEX, OFFSET).
export type RefValue = { ref: RangeRef };
export type EvalValue = Value | RefValue;

export function isRef(v: EvalValue): v is RefValue {
  return typeof v === 'object' && v !== null && 'ref' in v;
}

export type Frame = {
  // The formula's own cell.
  sheetId: string;
  row: number;
  col: number;
  ctx: SheetsCtx;
  locale: string;
  // A cell's value (worked out on demand). `inRange` when read as part of a noted range, so it is not noted on
  // its own as well.
  cell(sheetId: string, r: number, c: number, inRange?: boolean): Value;
  // How far a sheet is filled (rows and columns, positions + 1), for whole-column and open references.
  extent(sheetId: string): { rows: number; cols: number };
  // Whether a cell holds a formula (ISFORMULA).
  isFormula(sheetId: string, r: number, c: number): boolean;
  // The grid size of a sheet.
  grid(sheetId: string): { rows: number; cols: number } | undefined;
  // The rectangle a spilling formula fills, for `B2#`; null when it does not spill.
  spillOf(sheetId: string, r: number, c: number): RangeRef | null;
  // Note a read of a whole range, for dependencies (cells read one by one note themselves).
  noteRange(range: RangeRef): void;
  // Count reads against the recalculation budget; false once it is spent.
  spend(reads: number): boolean;
  // Today and now in the viewer's local time, as serials.
  now(): number;
  rand(): number;
  cards: CardSource | null;
  // Mark the formula volatile (it recalculates on every change) or a card reader.
  volatile(): void;
  readsCards(): void;
};
