// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  clampSidebarWidth,
  readSidebarWidth,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  sidebarDefaultWidth,
  writeSidebarWidth,
} from './sidebar-width';

// liveworkspace/docs/specs/011-workbench/sidebar-width.md "The default" and "Resizing".
const KEY = 'test:sidebar-width';
afterEach(() => localStorage.clear());

describe('sidebarDefaultWidth: the base up to 1,439 px, then 272, 296 and 320', () => {
  it.each([
    [1024, 236, 264],
    [1279, 236, 264],
    [1280, 236, 264],
    [1439, 236, 264],
    [1440, 272, 272],
    [1519, 272, 272],
    [1520, 296, 296],
    [1599, 296, 296],
    [1600, 320, 320],
    [1920, 320, 320],
    [2560, 320, 320],
  ])('at a %i px window: Contents %i, the page tree %i', (window, contents, tree) => {
    expect(sidebarDefaultWidth(236, window)).toBe(contents);
    expect(sidebarDefaultWidth(264, window)).toBe(tree);
  });

  it('keeps a base wider than every step', () => {
    expect(sidebarDefaultWidth(360, 2560)).toBe(360);
  });
});

describe('clampSidebarWidth', () => {
  it('holds the width between the bounds, in whole px', () => {
    expect(clampSidebarWidth(10)).toBe(SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth(9999)).toBe(SIDEBAR_MAX_WIDTH);
    expect(clampSidebarWidth(300.4)).toBe(300);
  });
});

describe('the width kept in this browser', () => {
  it('reads none until one is kept, then the kept width, then none once forgotten', () => {
    expect(readSidebarWidth(KEY)).toBeNull();
    writeSidebarWidth(KEY, 333.6);
    expect(localStorage.getItem(KEY)).toBe('334');
    expect(readSidebarWidth(KEY)).toBe(334);
    writeSidebarWidth(KEY, null);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(readSidebarWidth(KEY)).toBeNull();
  });

  it('reads junk and an empty value as none, and clamps a width out of bounds', () => {
    localStorage.setItem(KEY, 'wide');
    expect(readSidebarWidth(KEY)).toBeNull();
    localStorage.setItem(KEY, ' ');
    expect(readSidebarWidth(KEY)).toBeNull();
    localStorage.setItem(KEY, '5000');
    expect(readSidebarWidth(KEY)).toBe(SIDEBAR_MAX_WIDTH);
  });
});
