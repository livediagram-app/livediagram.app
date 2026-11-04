import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@liveplanner/project';
import { columnTones } from './column-tones';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/plan-board.md "Columns in the theme's colours".
const palette = planPalette('light', {});
const branches = [
  { fill: '#fde68a', stroke: '#d97706', text: '#1f2937' },
  { fill: '#bfdbfe', stroke: '#2563eb', text: '#1f2937' },
];
const cols = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd', color: '#16a34a' }];

describe('columnTones', () => {
  it('gives nothing on a single-colour theme', () => {
    expect(columnTones(cols, undefined, palette).size).toBe(0);
    expect(columnTones(cols, branches.slice(0, 1), palette).size).toBe(0);
  });

  it("cycles the theme's colours, and a column's own colour wins", () => {
    const t = columnTones(cols, branches, palette);
    expect(t.get('a')!.bar).toBe('#d97706');
    expect(t.get('b')!.bar).toBe('#2563eb');
    expect(t.get('c')!.bar).toBe('#d97706');
    expect(t.get('d')!.bar).toBe('#16a34a');
  });

  it('tints each face lightly, never below AA for the text', () => {
    const t = columnTones(cols, branches, palette);
    for (const tone of t.values()) {
      expect(tone.palette.column).not.toBe(palette.column);
      expect(contrastRatio(palette.text, tone.palette.column)).toBeGreaterThanOrEqual(4.5);
    }
    expect(t.get('a')!.palette.column).not.toBe(t.get('b')!.palette.column);
    // A light lean: the face stays close to the column colour (#f1f5f9).
    expect(t.get('a')!.palette.column).toBe('#efe8e1');
  });
});
