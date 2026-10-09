// The Spreadsheet category's tile (docs/specs/029-sheets/sheet.md "Placing a sheet"): one Sheet, placing a
// 'plan-sheet' element with a new, empty sheet. Spread into PALETTE_TILES via PLAN_TILES.
import { SheetArt } from '@/components/sheets/sheet-art';
import type { PaletteTileDef } from './palette-tile-defs';

export const PLAN_SHEET_TILES: PaletteTileDef[] = [
  {
    id: 'plan:sheet',
    section: 'plan-sheets',
    label: 'Add Sheet',
    caption: 'Sheet',
    description: 'A spreadsheet tab: cells, formulas, formatting, sort and filter.',
    noTint: true,
    action: { type: 'shape', kind: 'plan-sheet' },
    icon: <SheetArt size={18} />,
  },
];
