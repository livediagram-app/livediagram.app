import { describe, expect, it } from 'vitest';
import { pageInView } from './page-contents';

// docs/specs/007-editor/pages-mode.md "Contents": the page in view, as every editor with pages reads
// it. Each editor's own rows are tested beside its contentsRows.
describe('pageInView', () => {
  // Three 100 x 100 pages in a row, 50 apart.
  const pages = ['a', 'b', 'c'].map((id, i) => ({
    id,
    rect: { x: i * 150, y: 0, width: 100, height: 100 },
  }));
  const screen = { width: 1000, height: 800 };
  // The centred transform (lib/viewport.ts): the screen's middle shows canvas (cx, cy).
  const at = (cx: number, cy: number, zoom = 1) => ({
    zoom,
    offset: { x: screen.width / 2 - cx, y: screen.height / 2 - cy },
  });

  it('is the page holding the middle of the screen, else the nearest', () => {
    expect(pageInView(pages, at(200, 50), screen)).toBe('b');
    expect(pageInView(pages, at(390, 400), screen)).toBe('c');
    expect(pageInView([], at(0, 0), screen)).toBeUndefined();
  });

  it('reads the middle of what shows beside a docked sidebar', () => {
    // A 600 px sidebar on the left moves the middle 300 px right on screen: 300 canvas px at zoom 1.
    expect(pageInView(pages, at(0, 50), screen, { left: 600, right: 0 })).toBe('c');
    expect(pageInView(pages, at(300, 50), screen, { left: 0, right: 600 })).toBe('a');
  });
});
