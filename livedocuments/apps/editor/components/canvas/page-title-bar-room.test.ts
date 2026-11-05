// A page's title-bar room (docs/specs/007-editor/pages-mode.md "Beside the cog": named while
// there is room).
import { describe, expect, it } from 'vitest';
import {
  appearanceNamed,
  LABEL_MIN,
  titleBarFixedRoom,
  titleBarNamed,
} from './page-title-bar-room';

const infographic = {
  edit: true,
  locked: false,
  notes: false,
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

  it("makes room for a slide's named notes button", () => {
    const slide = { ...infographic, notes: true };
    expect(titleBarFixedRoom(slide, true)).toBeGreaterThan(titleBarFixedRoom(infographic, true));
    expect(titleBarFixedRoom(slide, true) - titleBarFixedRoom(slide, false)).toBeGreaterThan(
      titleBarFixedRoom(infographic, true) - titleBarFixedRoom(infographic, false),
    );
  });

  it("makes room for Tab Style's Style, named and as an icon", () => {
    const styled = { ...infographic, style: true };
    // Its own width (28 px as an icon, 67 px named, measured) plus one gap.
    expect(titleBarFixedRoom(styled, false) - titleBarFixedRoom(infographic, false)).toBe(30);
    expect(titleBarFixedRoom(styled, true) - titleBarFixedRoom(infographic, true)).toBe(69);
  });
});

describe("a phone's title bar", () => {
  it('takes Appearance, Notes and the cog only: no Tidy, no lock', () => {
    const phone = titleBarFixedRoom(infographic, false, true);
    expect(phone).toBeLessThan(titleBarFixedRoom(infographic, false));
    // Tidy and the lock add nothing on a phone.
    expect(titleBarFixedRoom({ ...infographic, tidy: false, locked: true }, false, true)).toBe(
      phone,
    );
    expect(titleBarFixedRoom({ ...infographic, notes: true }, false, true)).toBeGreaterThan(phone);
    // No looks to gather: no Appearance.
    expect(titleBarFixedRoom({ ...infographic, page: false }, false, true)).toBeLessThan(phone);
  });
});

describe("a phone's Appearance name", () => {
  it('shows while the page on screen holds the named bar, never otherwise', () => {
    const named = titleBarFixedRoom(infographic, true, true);
    expect(named).toBeGreaterThan(titleBarFixedRoom(infographic, false, true));
    expect(appearanceNamed(named, infographic)).toBe(true);
    expect(appearanceNamed(60, infographic)).toBe(false);
  });
});
