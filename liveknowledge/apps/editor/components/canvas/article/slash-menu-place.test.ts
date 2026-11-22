import { describe, expect, it } from 'vitest';
import {
  placeSlashMenu,
  SLASH_LIST_WIDTH,
  SLASH_MAX_HEIGHT,
  SLASH_PREVIEW_WIDTH,
} from './slash-menu-place';

// docs/specs/030-knowledgebase/page-surface.md "The slash menu", "Where it sits".
const WIN = { width: 1440, height: 900 };
const at = (left: number, top: number) => ({ left, top, bottom: top + 20 });

describe('where the slash menu sits', () => {
  it('opens under the `/`, its left edge at it, the preview beside the list', () => {
    expect(placeSlashMenu(at(400, 200), 380, WIN, true)).toEqual({
      left: 400,
      top: 226,
      above: false,
      preview: true,
      width: SLASH_LIST_WIDTH + SLASH_PREVIEW_WIDTH,
      maxHeight: SLASH_MAX_HEIGHT,
    });
  });

  it('opens above the `/` where it would run past the window’s foot', () => {
    const p = placeSlashMenu(at(400, 760), 380, WIN, true);
    expect(p.above).toBe(true);
    expect(p.top).toBe(760 - 6 - 380);
  });

  it('stays below on a short window with more room there, its list scrolling', () => {
    const p = placeSlashMenu(at(400, 100), 380, { width: 1440, height: 400 }, true);
    expect(p.above).toBe(false);
    expect(p.maxHeight).toBe(400 - 126 - 8);
  });

  it('never runs past the window’s sides', () => {
    expect(placeSlashMenu(at(1400, 200), 300, WIN, true).left).toBe(
      1440 - 8 - SLASH_LIST_WIDTH - SLASH_PREVIEW_WIDTH,
    );
    expect(placeSlashMenu(at(-20, 200), 300, WIN, true).left).toBe(8);
  });

  it('drops the preview where the window has no room for both, or none is wanted', () => {
    const narrow = placeSlashMenu(at(10, 100), 300, { width: 500, height: 800 }, true);
    expect(narrow.preview).toBe(false);
    expect(narrow.width).toBe(SLASH_LIST_WIDTH);
    expect(placeSlashMenu(at(10, 100), 300, WIN, false).preview).toBe(false);
    expect(placeSlashMenu(at(10, 100), 300, { width: 300, height: 800 }, false).width).toBe(284);
  });
});
