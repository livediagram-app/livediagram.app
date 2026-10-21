import { describe, expect, it } from 'vitest';
import { boardRowTemplate } from './plan-board-rows';

describe('boardRowTemplate', () => {
  it('gives the cells the spare height on a board without swimlanes', () => {
    expect(boardRowTemplate([''], false, new Set())).toBe('auto 1fr');
  });

  it('gives it to the last swimlane’s cells', () => {
    expect(boardRowTemplate(['a', 'b'], true, new Set())).toBe('auto auto auto auto 1fr');
  });

  it('skips a shut last swimlane, which draws its label only', () => {
    expect(boardRowTemplate(['a', 'b'], true, new Set(['b']))).toBe('auto auto 1fr auto');
  });

  it('gives the spare height to an empty row when every swimlane is shut', () => {
    expect(boardRowTemplate(['a'], true, new Set(['a']))).toBe('auto auto 1fr');
  });
});
