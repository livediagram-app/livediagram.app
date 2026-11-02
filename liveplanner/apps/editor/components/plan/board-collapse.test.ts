import { describe, expect, it } from 'vitest';
import {
  BOARD_COLLAPSED_MAX,
  NOTHING_COLLAPSED,
  boardCollapsedKey,
  parseBoardCollapsed,
  serialiseBoardCollapsed,
  toggleMember,
} from './board-collapse';

// docs/specs/026-plan/plan-board.md "Collapse Column": each person's own, remembered per board on this browser.
describe('board-collapse', () => {
  it('keys each board on its own', () => {
    expect(boardCollapsedKey('b1')).toBe('liveplanner:v2:board-collapsed:b1');
  });

  it('round-trips columns and lanes, and stores nothing when nothing is collapsed', () => {
    const state = { columns: new Set(['c1']), lanes: new Set(['', 'sam']) };
    const back = parseBoardCollapsed(serialiseBoardCollapsed(state));
    expect([...back.columns]).toEqual(['c1']);
    expect([...back.lanes]).toEqual(['', 'sam']);
    expect(serialiseBoardCollapsed(NOTHING_COLLAPSED)).toBeNull();
  });

  it('reads anything else as nothing collapsed, field by field', () => {
    expect(parseBoardCollapsed(null)).toBe(NOTHING_COLLAPSED);
    expect(parseBoardCollapsed('not json')).toBe(NOTHING_COLLAPSED);
    expect(parseBoardCollapsed('42')).toBe(NOTHING_COLLAPSED);
    const mixed = parseBoardCollapsed(JSON.stringify({ columns: ['a', 3, null, 'b'], lanes: 'x' }));
    expect([...mixed.columns]).toEqual(['a', 'b']);
    expect(mixed.lanes.size).toBe(0);
  });

  it('cuts a long stored list', () => {
    const many = Array.from({ length: BOARD_COLLAPSED_MAX + 50 }, (_, i) => `c${i}`);
    expect(parseBoardCollapsed(JSON.stringify({ columns: many })).columns.size).toBe(
      BOARD_COLLAPSED_MAX,
    );
  });

  it('flips a member, dropping any no longer on the board', () => {
    expect([...toggleMember(new Set(['a']), 'b')]).toEqual(['a', 'b']);
    expect([...toggleMember(new Set(['a', 'b']), 'b')]).toEqual(['a']);
    expect([...toggleMember(new Set(['gone', 'a']), 'b', new Set(['a', 'b']))]).toEqual(['a', 'b']);
  });
});
