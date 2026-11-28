// The cluster row with the Call dock in it (docs/specs/008-canvas/avatar-mode.md "The Call dock", "Where").
import { describe, expect, it } from 'vitest';
import { callDockRowFit, clusterRowLayout } from './call-dock-row';

describe('clusterRowLayout', () => {
  it('lays the walking row out in three columns, the dock in the middle and the buttons unwrapped on the right', () => {
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

describe('clusterRowLayout lifted', () => {
  it('puts the buttons on a second line under the dock', () => {
    expect(clusterRowLayout(true, true).buttons.split(' ')).toEqual(
      expect.arrayContaining(['col-start-3', 'row-start-2']),
    );
    expect(clusterRowLayout(true, false).buttons).toContain('row-start-1');
  });
});

describe('callDockRowFit', () => {
  // A 700 px window: the row runs 16 to 684, a 191 px dock and 150 px of buttons. Nothing stands in the bottom-left
  // (the Map left livehuddle, docs/specs/002-project-scope/not-in-livehuddle.md "The Map"), so nothing is kept clear.
  const at700 = { rowWidth: 668, dockWidth: 191, buttonsWidth: 150, scale: 1 };

  it('keeps the dock on the line while the dock and the buttons fit', () => {
    // 191 + 150 + 12 = 353 fits in 668.
    expect(callDockRowFit(at700)).toEqual({ lifted: false });
  });

  it('lifts the dock above the buttons when the line is too short for both', () => {
    // A narrow phone row: 353 > 340.
    expect(callDockRowFit({ ...at700, rowWidth: 340 })).toEqual({ lifted: true });
  });

  it('measures in the row px at a UI scale', () => {
    // At 1.25 every screen width is 1.25 row px: 341 / 1.25 + 12 = 284.8 fits in 360 / 1.25 = 288.
    expect(callDockRowFit({ ...at700, rowWidth: 360, scale: 1.25 })).toEqual({ lifted: false });
    expect(callDockRowFit({ ...at700, rowWidth: 350, scale: 1.25 })).toEqual({ lifted: true });
  });
});
