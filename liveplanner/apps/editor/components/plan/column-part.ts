// A board column's painted parts, its head and cells (globals.css .plan-col; docs/specs/026-plan/plan-board.md "Column
// hover"): its colour, and the ink its hover leans toward.
import type { CSSProperties } from 'react';

export const columnPartStyle = (palette: { column: string; text: string }): CSSProperties =>
  ({ '--plan-col-bg': palette.column, '--plan-col-ink': palette.text }) as CSSProperties;

// A column's head (plan-board.md "Column heads stick flush"): its colour laid on the board's solid paper rather than
// over whatever is behind it, so a head stuck over the cards hides them in every theme (.plan-col mixes into
// --plan-col-under, transparent on a cell).
export const columnHeadStyle = (palette: {
  column: string;
  text: string;
  surface: string;
}): CSSProperties =>
  ({ ...columnPartStyle(palette), '--plan-col-under': palette.surface }) as CSSProperties;
