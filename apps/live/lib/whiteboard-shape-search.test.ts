import { describe, expect, it } from 'vitest';
import { gridStep, SHAPE_SEARCH_LIMIT, searchWhiteboardShapes } from './whiteboard-shape-search';

describe('searchWhiteboardShapes', () => {
  it('finds nothing for an empty field: the flyout shows its slots instead, never the full list', () => {
    expect(searchWhiteboardShapes('  ')).toEqual([]);
  });

  it('shows at most six results, the named shape first', () => {
    expect(SHAPE_SEARCH_LIMIT).toBe(6);
    expect(searchWhiteboardShapes('a')).toHaveLength(6);
    expect(searchWhiteboardShapes('hex')[0]!.key).toBe('hexagon');
  });

  it('finds a shape by keyword', () => {
    expect(searchWhiteboardShapes('database')[0]!.key).toBe('cylinder');
  });

  it('finds a flowchart shape by what it means in a flowchart', () => {
    const keys = searchWhiteboardShapes('decision').map((e) => e.key);
    expect(keys).toContain('diamond');
  });

  it('is case-insensitive', () => {
    expect(searchWhiteboardShapes('RECT')[0]!.key).toBe('rectangle');
  });

  it('matches nothing for nonsense', () => {
    expect(searchWhiteboardShapes('zzqx')).toEqual([]);
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
