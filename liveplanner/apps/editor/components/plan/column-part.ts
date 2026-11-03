// A board column's painted parts, its head and cells (globals.css .plan-col; docs/specs/026-plan/plan-board.md "Column
// hover"): its colour, and the ink its hover leans toward.
import type { CSSProperties } from 'react';

export const columnPartStyle = (palette: { column: string; text: string }): CSSProperties =>
  ({ '--plan-col-bg': palette.column, '--plan-col-ink': palette.text }) as CSSProperties;
