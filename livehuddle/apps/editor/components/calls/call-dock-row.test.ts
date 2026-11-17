// The cluster row with the Call dock in it (docs/specs/008-canvas/avatar-mode.md "The Call dock", "Where").
import { describe, expect, it } from 'vitest';
import { callDockRowFit, clusterRowLayout } from './call-dock-row';

describe('clusterRowLayout', () => {
  it('lays the walking row out in three columns, the dock in the middle and the buttons unwrapped on the right', () => {
    const { row, buttons } = clusterRowLayout(true);
    for (const cls of [
      'left-4',
      'grid',
      'grid-cols-[minmax(var(--call-dock-clear,0px),1fr)_auto_1fr]',
      'items-end',
    ])
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
  // A 700 px window: the row runs 16 to 684, the Map 16 to 272 (w-64), a 191 px dock and 150 px of buttons.
  const at700 = {
    rowLeft: 16,
    rowWidth: 668,
    panelsRight: 272,
    dockWidth: 191,
    buttonsWidth: 150,
    scale: 1,
  };

  it('keeps nothing clear with no panels beside the row', () => {
    expect(callDockRowFit({ ...at700, panelsRight: null })).toEqual({ clear: 0, lifted: false });
  });

  it('clears the panels and a gap, so the dock starts past the Map', () => {
    // 272 + 8 - 16 = 264; 264 + 191 + 150 + 12 = 617 fits in 668.
    expect(callDockRowFit(at700)).toEqual({ clear: 264, lifted: false });
  });

  it('lifts the dock above the buttons when the panels, the dock and the buttons cannot share the line', () => {
    // A 640 px window: 264 + 191 + 150 + 12 = 617 > 608.
    expect(callDockRowFit({ ...at700, rowWidth: 608 })).toEqual({ clear: 264, lifted: true });
  });

  it('measures in the row px at a UI scale', () => {
    // At 1.25 every screen width is 1.25 row px: (272 + 8 - 16) / 1.25 = 211.2, rounded up.
    expect(callDockRowFit({ ...at700, scale: 1.25 })).toEqual({ clear: 212, lifted: false });
  });

  it('never clears a negative width for panels left of the row', () => {
    expect(callDockRowFit({ ...at700, panelsRight: 0 }).clear).toBe(0);
  });
});
