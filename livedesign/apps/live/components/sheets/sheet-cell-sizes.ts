// The cell sizes a sheet can take (docs/specs/029-sheets/sheet.md "Setup Sheet" and "Sheet Settings"): one labelled
// list, read by Setup Sheet's Style step and Sheet Settings' Cells section, over the engine's SHEET_CELL_SIZES (whose
// cellSizeDefaults and cellSizeOf turn a size into a sheet's defaults and back).
import type { SheetCellSize } from '@livedesign/sheets';

export const CELL_SIZE_OPTIONS: readonly { id: SheetCellSize; label: string; hint: string }[] = [
  { id: 'compact', label: 'Compact', hint: '100 by 24, to see more at once' },
  { id: 'default', label: 'Default', hint: '120 by 28' },
  { id: 'roomy', label: 'Roomy', hint: '160 by 36, easier to read and tap' },
];
