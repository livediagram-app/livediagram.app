'use client';

// Cells a tour marks on a Sheet (docs/specs/026-plan/plan-tour.md "Sheets: Five Small Wins"): the current challenge's
// cells glow in the brand colour, and turn green once it is done. Keyed by A1. Absent (every real Sheet), SheetCells
// draws no marks and looks nothing up.
import { createContext, useContext } from 'react';

export type CellMark = 'glow' | 'ok';

export const SheetCellMarksContext = createContext<ReadonlyMap<string, CellMark> | null>(null);

export const useSheetCellMarks = () => useContext(SheetCellMarksContext);
