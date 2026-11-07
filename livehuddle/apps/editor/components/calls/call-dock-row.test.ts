// The cluster row with the Call dock in it (docs/specs/008-canvas/avatar-mode.md "The Call dock", "Where").
import { describe, expect, it } from 'vitest';
import { clusterRowLayout } from './call-dock-row';

describe('clusterRowLayout', () => {
  it('lays a phone row out in three columns, the dock in the middle and the buttons unwrapped on the right', () => {
    const { row, buttons } = clusterRowLayout(true);
    for (const cls of ['left-4', 'grid', 'grid-cols-[1fr_auto_1fr]', 'items-end'])
      expect(row.split(' ')).toContain(cls);
    expect(buttons.split(' ')).toEqual(
      expect.arrayContaining(['col-start-3', 'row-start-1', 'flex', 'justify-end']),
    );
    // Wrapping would let the right column shrink under the dock's share and stack Fit under Collaborate.
    expect(buttons).not.toContain('flex-wrap');
  });

  it('keeps the cluster as it was without the dock in the row', () => {
    const { row, buttons } = clusterRowLayout(false);
    expect(row).toBe(
      'flex items-center gap-2 phone:left-4 phone:flex-wrap phone:justify-end phone:gap-1.5',
    );
    expect(buttons).toBe('contents');
  });
});
