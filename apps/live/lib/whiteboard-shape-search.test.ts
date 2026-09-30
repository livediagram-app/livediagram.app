import { describe, expect, it } from 'vitest';
import { gridStep, searchWhiteboardShapes } from './whiteboard-shape-search';
import { WHITEBOARD_SHAPE_CATALOGUE, WHITEBOARD_SHAPE_GROUPS } from './whiteboard-shape-catalogue';

describe('searchWhiteboardShapes', () => {
  it('shows every shape, grouped as in the palette, for an empty field', () => {
    const view = searchWhiteboardShapes('  ');
    expect(view.searching).toBe(false);
    expect(view.groups.map((g) => g.label)).toEqual(WHITEBOARD_SHAPE_GROUPS.map((g) => g.label));
    expect(view.groups.flatMap((g) => g.entries)).toHaveLength(WHITEBOARD_SHAPE_CATALOGUE.length);
  });

  it('puts the named shape first, then prefixes, then keyword matches', () => {
    const view = searchWhiteboardShapes('hex');
    expect(view.searching).toBe(true);
    expect(view.groups).toHaveLength(1);
    expect(view.groups[0]!.entries[0]!.key).toBe('hexagon');
  });

  it('finds a shape by keyword', () => {
    const keys = searchWhiteboardShapes('database').groups[0]!.entries.map((e) => e.key);
    expect(keys[0]).toBe('cylinder');
  });

  it('finds a flowchart shape by what it means in a flowchart', () => {
    const keys = searchWhiteboardShapes('decision').groups[0]!.entries.map((e) => e.key);
    expect(keys).toContain('diamond');
  });

  it('is case-insensitive', () => {
    expect(searchWhiteboardShapes('RECT').groups[0]!.entries[0]!.key).toBe('rectangle');
  });

  it('matches nothing for nonsense', () => {
    expect(searchWhiteboardShapes('zzqx').groups).toEqual([]);
  });
});

describe('gridStep', () => {
  // Two groups on a 3-wide grid: [0 1 2][3 4] then [5 6 7][8].
  const sizes = [5, 4];

  it('moves left and right through the flat order, across groups, clamped', () => {
    expect(gridStep(sizes, 3, 4, 'right')).toBe(5);
    expect(gridStep(sizes, 3, 5, 'left')).toBe(4);
    expect(gridStep(sizes, 3, 0, 'left')).toBe(0);
    expect(gridStep(sizes, 3, 8, 'right')).toBe(8);
  });

  it('moves up and down by visual row, keeping the column where it can', () => {
    expect(gridStep(sizes, 3, 1, 'down')).toBe(4);
    expect(gridStep(sizes, 3, 2, 'down')).toBe(4);
    expect(gridStep(sizes, 3, 4, 'down')).toBe(6);
    expect(gridStep(sizes, 3, 7, 'down')).toBe(8);
    expect(gridStep(sizes, 3, 8, 'up')).toBe(5);
    expect(gridStep(sizes, 3, 6, 'up')).toBe(4);
    expect(gridStep(sizes, 3, 1, 'up')).toBe(1);
    expect(gridStep(sizes, 3, 8, 'down')).toBe(8);
  });

  it('stays put in an empty grid', () => {
    expect(gridStep([], 3, 0, 'down')).toBe(0);
  });
});
