// Each column's own colour on a multi-colour theme (docs/specs/026-plan/plan-board.md "Columns in the theme's colours"):
// the theme's branch colours in order, one per column, cycling. A column's top bar takes the colour, and its face (head
// and cells) a light tint of it, as long as the board's text still reads on it at 4.5:1. A colour set on the column
// itself wins. Pure.
import { contrastRatio, type ThemePaletteEntry } from '@liveplanner/project';

// `t` of `toward` mixed into `base`, channel by channel (#rrggbb in and out).
function lean(base: string, toward: string, t: number): string {
  const ch = (hex: string, k: number) => parseInt(hex.slice(1 + k * 2, 3 + k * 2), 16);
  if (!/^#[0-9a-f]{6}$/i.test(base) || !/^#[0-9a-f]{6}$/i.test(toward)) return base;
  return (
    '#' +
    [0, 1, 2]
      .map((k) =>
        Math.round(ch(base, k) + (ch(toward, k) - ch(base, k)) * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
import type { PlanColumn } from '@liveplanner/items';
import type { PlanPalette } from './plan-palette';

export type ColumnTone = { palette: PlanPalette; bar: string };

// How far a column's face leans toward its colour: enough to tell neighbours apart, never enough to compete with cards.
const TINT = 0.1;
const TEXT_FLOOR = 4.5;

export function columnTones(
  columns: readonly Pick<PlanColumn, 'id' | 'color'>[],
  branches: readonly ThemePaletteEntry[] | undefined,
  palette: PlanPalette,
): Map<string, ColumnTone> {
  const tones = new Map<string, ColumnTone>();
  if (!branches || branches.length < 2) return tones;
  columns.forEach((column, i) => {
    const bar = column.color ?? branches[i % branches.length]!.stroke;
    // The lightest lean that still keeps the text at AA, or none.
    let face = palette.column;
    for (const t of [TINT, TINT / 2]) {
      const mixed = lean(palette.column, bar, t);
      if (contrastRatio(palette.text, mixed) >= TEXT_FLOOR) {
        face = mixed;
        break;
      }
    }
    tones.set(column.id, { palette: { ...palette, column: face }, bar });
  });
  return tones;
}
