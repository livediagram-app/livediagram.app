import { describe, expect, it } from 'vitest';
import { DARK_CANVAS_BACKGROUND_COLOR, DEFAULT_BACKGROUND_COLOR } from './canvas-colors';
import { contrastRatio } from './colors';
import { WHITEBOARD_BOARD, WHITEBOARD_INK } from './whiteboard';

describe('whiteboard tokens', () => {
  it.each(['light', 'dark'] as const)('ink on board meets WCAG AA text contrast (%s)', (a) => {
    expect(contrastRatio(WHITEBOARD_INK[a], WHITEBOARD_BOARD[a])).toBeGreaterThanOrEqual(4.5);
  });

  it("is the Default theme's off-white canvas in light and the editor's own dark canvas in dark", () => {
    expect(WHITEBOARD_BOARD.light).toBe(DEFAULT_BACKGROUND_COLOR);
    expect(contrastRatio(WHITEBOARD_BOARD.light, '#ffffff')).toBeLessThan(1.1);
    expect(WHITEBOARD_BOARD.dark).toBe(DARK_CANVAS_BACKGROUND_COLOR);
  });
});
