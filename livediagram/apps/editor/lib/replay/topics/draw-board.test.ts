import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { BOARD, board, CHAPTERS, DOTS, ERASE, GRID } from './draw-board';

// Erase and Board (docs/specs/023-draw-mode/draw-mode.md "Eraser", "Board background"). What every topic holds is in
// topics.test.ts.

const env = {
  centre: { x: 400, y: 300 },
  size: { width: 1440, height: 820 },
  tab: { id: 't', elements: [] } as unknown as Tab,
};
const layout = board.layout(env);

describe('Erase and Board', () => {
  it('plays Erase, Board', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['board-erase', 'board-background']);
  });

  it('picks the Eraser and rubs one stroke out whole, under the held cursor', () => {
    expect(board.frame(0, 0, layout).elements).toHaveLength(3);
    expect(board.frame(0, ERASE.pick, layout).dock).toEqual({ tool: 'eraser' });
    expect(board.frame(0, ERASE.rub[0] + 100, layout).hold).not.toBeNull();
    const after = board.frame(0, ERASE.gone, layout);
    expect(after.elements.map((e) => e.id)).not.toContain(layout.erasedId);
    expect(after.elements).toHaveLength(2);
    expect(board.frame(0, ERASE.rub[1], layout).hold).toBeNull();
  });

  it('opens Settings and shows Dots, then Grid, on the board, never storing either', () => {
    expect(DOTS.pattern).toBe('grid');
    expect(GRID.pattern).toBe('graph');
    expect(board.frame(1, BOARD.dots - 1, layout).prefs).toBeUndefined();
    expect(board.frame(1, BOARD.dots, layout).prefs).toEqual({ drawPattern: 'grid' });
    expect(board.frame(1, BOARD.grid, layout).prefs).toEqual({ drawPattern: 'graph' });
    expect(board.frame(1, BOARD.cog, layout).open).toEqual(['dock-settings']);
    expect(board.frame(1, BOARD.close, layout).open).toEqual([]);
    expect(board.frame(1, 0, layout).elements).toHaveLength(2);
    const labels = board
      .plan(1, layout)
      .flatMap((w) => (w.to.kind === 'find' ? [w.to.selector] : []));
    expect(labels).toContain('#whiteboard-flyout-settings button[aria-label="Dots"]');
    expect(labels).toContain('#whiteboard-flyout-settings button[aria-label="Grid"]');
  });
});
