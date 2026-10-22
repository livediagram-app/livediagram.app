// A page's title-bar room (docs/specs/007-editor/pages-mode.md "Beside the cog": named while
// there is room).
import { describe, expect, it } from 'vitest';
import { LABEL_MIN, titleBarFixedRoom, titleBarNamed } from './page-title-bar-room';

const infographic = {
  edit: true,
  locked: false,
  deck: false,
  notes: false,
  logo: false,
  page: true,
  tidy: true,
};

describe('the title bar', () => {
  it('names its buttons while the page on screen holds them and the label', () => {
    const named = titleBarFixedRoom(infographic, true);
    expect(titleBarNamed(named + LABEL_MIN, infographic, false)).toBe(true);
    // Zoomed out a step further: icons.
    expect(titleBarNamed(named + LABEL_MIN - 1, infographic, false)).toBe(false);
  });

  it('keeps a phone on icons however wide the page', () => {
    expect(titleBarNamed(10_000, infographic, true)).toBe(false);
  });

  it('takes less room as icons than named', () => {
    expect(titleBarFixedRoom(infographic, false)).toBeLessThan(
      titleBarFixedRoom(infographic, true),
    );
    expect(titleBarFixedRoom({ ...infographic, edit: false, page: false, tidy: false }, true)).toBe(
      0,
    );
  });

  it("makes room for a slide's named deck and notes buttons", () => {
    const slide = { ...infographic, deck: true, notes: true };
    expect(titleBarFixedRoom(slide, true)).toBeGreaterThan(titleBarFixedRoom(infographic, true));
    expect(titleBarFixedRoom(slide, true) - titleBarFixedRoom(slide, false)).toBeGreaterThan(
      titleBarFixedRoom(infographic, true) - titleBarFixedRoom(infographic, false),
    );
  });
});
