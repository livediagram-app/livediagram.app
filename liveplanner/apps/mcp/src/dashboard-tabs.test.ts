import { describe, expect, it } from 'vitest';
import { dashboardLeftOffNote, dashboardRowsLeftOff, dashboardTabKind } from './dashboard-tabs';

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

// Rows past a Dashboard's 12 were left off with a plain success: the answer now says how many (plan-agents.md
// "Making a dashboard").
describe('a Dashboard past its 12 rows', () => {
  it('counts the rows left off and says so', () => {
    const notes = Array.from({ length: 40 }, (_, i) => ({ title: `N${i}`, text: 'x' }));
    expect(dashboardRowsLeftOff({ notes })).toBe(2);
    expect(dashboardRowsLeftOff({ notes: notes.slice(0, 3) })).toBe(0);
    expect(dashboardLeftOffNote([{ name: 'Overview', dropped: 0 }])).toEqual({});
    expect(dashboardLeftOffNote([{ name: 'Overview', dropped: 1 }]).note).toMatch(
      /^Dashboard "Overview" holds 12 rows: 1 more row was left off\./,
    );
    expect(
      dashboardLeftOffNote([
        { name: 'A', dropped: 2 },
        { name: 'B', dropped: 0 },
      ]).note,
    ).toMatch(/^Dashboard "A" holds 12 rows: 2 more rows were left off\. Ask/);
  });
});
