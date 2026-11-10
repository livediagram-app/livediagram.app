// A page's title-bar room (docs/specs/007-editor/pages-mode.md "Beside the cog": named while
// there is room).
import { describe, expect, it } from 'vitest';
import { LABEL_MIN, titleBarFixedRoom, titleBarNamed } from './page-title-bar-room';

const wireframe = {
  edit: true,
  locked: false,
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

  // docs/specs/008-canvas/quick-style-panel.md "On a phone, in Appearance": any page gains Appearance for a selection.
  it("counts a phone's Appearance on any page while something on it is styled", () => {
    const logo = { edit: true, locked: false, logo: true, page: false };
    expect(titleBarFixedRoom({ ...logo, selected: true }, false, true)).toBeGreaterThan(
      titleBarFixedRoom(logo, false, true),
    );
    // A wireframe page has it anyway.
    expect(titleBarFixedRoom({ ...wireframe, selected: true }, false, true)).toBe(
      titleBarFixedRoom(wireframe, false, true),
    );
  });
});
