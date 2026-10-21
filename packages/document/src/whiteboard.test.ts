import { describe, expect, it } from 'vitest';
import { DARK_CANVAS_BACKGROUND_COLOR, DEFAULT_BACKGROUND_COLOR } from './canvas-colors';
import { contrastRatio } from './colors';
import {
  WHITEBOARD_BACKGROUNDS,
  WHITEBOARD_BOARD,
  WHITEBOARD_DEFAULT_PATTERN,
  WHITEBOARD_INK,
  WHITEBOARD_UNSET_PATTERN,
  nearestBorderStroke,
  whiteboardBackgroundOf,
} from './whiteboard';

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

describe('whiteboard backgrounds', () => {
  it('maps Plain, Dots and Grid onto the canvas patterns', () => {
    expect(WHITEBOARD_BACKGROUNDS.map((b) => [b.id, b.pattern])).toEqual([
      ['plain', 'blank'],
      ['dots', 'grid'],
      ['grid', 'graph'],
    ]);
  });

  it('reads a stored pattern back, defaulting to Plain', () => {
    expect(whiteboardBackgroundOf('graph')).toBe('grid');
    expect(whiteboardBackgroundOf('grid')).toBe('dots');
    expect(whiteboardBackgroundOf(undefined)).toBe('plain');
    expect(whiteboardBackgroundOf('waves')).toBe('plain');
  });

  it('starts a new whiteboard on Grid, and reads a board stored without one as Plain', () => {
    expect(whiteboardBackgroundOf(WHITEBOARD_DEFAULT_PATTERN)).toBe('grid');
    expect(whiteboardBackgroundOf(WHITEBOARD_UNSET_PATTERN)).toBe('plain');
  });
});

describe('nearestBorderStroke', () => {
  it('maps pen widths onto the nearest border preset, ties to the thicker', () => {
    expect(nearestBorderStroke(1)).toBe('thin');
    expect(nearestBorderStroke(2)).toBe('medium');
    expect(nearestBorderStroke(3)).toBe('thick');
    expect(nearestBorderStroke(4)).toBe('thick');
    expect(nearestBorderStroke(8)).toBe('extra-thick');
  });
});
