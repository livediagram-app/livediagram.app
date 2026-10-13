import { describe, expect, it } from 'vitest';
import { dashboardTabKind } from './dashboard-tabs';

// What a Dashboard can show of a tab (docs/specs/026-plan/plan-agents.md "Making a dashboard").
describe('dashboardTabKind', () => {
  it('reads a Board or Sheet tab, and nothing else', () => {
    expect(dashboardTabKind({ kind: 'board' })).toBe('board');
    expect(dashboardTabKind({ kind: 'sheet' })).toBe('sheet');
    expect(dashboardTabKind({ kind: 'dashboard' })).toBeNull();
    expect(dashboardTabKind({})).toBeNull();
    // A Blank Plan tab given a board by add_board.
    const board = { type: 'shape', shape: 'plan-board' } as never;
    const sheet = { type: 'shape', shape: 'plan-sheet' } as never;
    expect(dashboardTabKind({ kind: 'diagram', elements: [board] })).toBe('board');
    expect(dashboardTabKind({ elements: [sheet] })).toBe('sheet');
  });
});
