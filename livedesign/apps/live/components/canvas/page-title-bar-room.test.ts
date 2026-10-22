// A page's title-bar room (docs/specs/007-editor/pages-mode.md "Beside the cog": named while
// there is room).
import { describe, expect, it } from 'vitest';
import { LABEL_MIN, titleBarFixedRoom, titleBarNamed } from './page-title-bar-room';

const wireframe = {
  edit: true,
  locked: false,
  deck: false,
  notes: false,
  logo: false,
  page: true,
};

describe('the title bar', () => {
  it('names its buttons while the page on screen holds them and the label', () => {
    const named = titleBarFixedRoom(wireframe, true);
    expect(titleBarNamed(named + LABEL_MIN, wireframe, false)).toBe(true);
    // Zoomed out a step further: icons.
    expect(titleBarNamed(named + LABEL_MIN - 1, wireframe, false)).toBe(false);
  });

  it('keeps a phone on icons however wide the page', () => {
    expect(titleBarNamed(10_000, wireframe, true)).toBe(false);
  });

  it('takes less room as icons than named', () => {
    expect(titleBarFixedRoom(wireframe, false)).toBeLessThan(titleBarFixedRoom(wireframe, true));
    expect(titleBarFixedRoom({ ...wireframe, edit: false, page: false }, true)).toBe(0);
  });

  it("makes room for a slide's named deck and notes buttons", () => {
    const slide = { ...wireframe, deck: true, notes: true };
    expect(titleBarFixedRoom(slide, true)).toBeGreaterThan(titleBarFixedRoom(wireframe, true));
    expect(titleBarFixedRoom(slide, true) - titleBarFixedRoom(slide, false)).toBeGreaterThan(
      titleBarFixedRoom(wireframe, true) - titleBarFixedRoom(wireframe, false),
    );
  });
});
