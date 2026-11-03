// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  CONTENTS_SIDEBAR_WIDTH,
  contentsClusterBounds,
  contentsSidebarClearancePx,
  readContentsSide,
  restingRect,
  sideInsetsOf,
  translateOf,
} from './contents-sidebar';

// docs/specs/007-editor/pages-mode.md "Contents": the sidebar's width is kept clear on its side.
const canvas = { left: 0, right: 1200, top: 60, bottom: 860 };

describe('sideInsetsOf', () => {
  it('covers the left up to a left sidebar, the right from a right one', () => {
    expect(sideInsetsOf(canvas, { left: 0, right: 236, top: 130, bottom: 860 })).toEqual({
      left: 236,
      right: 0,
    });
    expect(sideInsetsOf(canvas, { left: 964, right: 1200, top: 130, bottom: 860 })).toEqual({
      left: 0,
      right: 236,
    });
  });

  it('is nothing for a panel outside the canvas, or too short to be in the way', () => {
    expect(sideInsetsOf(canvas, { left: 1300, right: 1500, top: 130, bottom: 860 })).toEqual({
      left: 0,
      right: 0,
    });
    expect(sideInsetsOf(canvas, { left: 0, right: 236, top: 130, bottom: 200 })).toEqual({
      left: 0,
      right: 0,
    });
  });

  it('never covers more than half the canvas', () => {
    expect(sideInsetsOf(canvas, { left: 0, right: 900, top: 60, bottom: 860 }).left).toBe(600);
  });
});

describe('restingRect: the sidebar measured where it comes to rest', () => {
  const rect = (left: number, right: number) =>
    ({ left, right, top: 130, bottom: 860, width: right - left, height: 730 }) as DOMRect;

  it('reads a computed translate in px, none as nothing', () => {
    expect(translateOf('none')).toEqual([0, 0]);
    expect(translateOf(undefined)).toEqual([0, 0]);
    expect(translateOf('640px')).toEqual([640, 0]);
    expect(translateOf('-12px 4px')).toEqual([-12, 4]);
    expect(translateOf('50% 0px')).toEqual([0, 0]);
  });

  it('leaves out the slide home after a drop on the other side', () => {
    const panel = document.createElement('aside');
    panel.style.translate = '640px';
    // Pinned right, still carried 640 px further by the drag's translate as it slides home.
    panel.getBoundingClientRect = () => rect(1604, 1840);
    expect(restingRect(panel)).toEqual({ left: 964, right: 1200, top: 130, bottom: 860 });
  });
});

describe('contentsSidebarClearancePx', () => {
  it('starts the corners on its side past the sidebar, its width at the panel scale', () => {
    // Flush against the edge: the sidebar's width, then the usual 16 px inset.
    expect(contentsSidebarClearancePx(1)).toBe(236 + 16);
    expect(contentsSidebarClearancePx(1.2)).toBeCloseTo(236 * 1.2 + 16, 6);
  });
});

describe('readContentsSide', () => {
  it('is the left until the person moves it right; anything else reads as the left', () => {
    expect(readContentsSide(null)).toBe('left');
    expect(readContentsSide('right')).toBe('right');
    expect(readContentsSide('top')).toBe('left');
  });
});

describe('contentsClusterBounds: the bottom-right cluster beside a docked sidebar', () => {
  it('is unbounded with no sidebar docked', () => {
    expect(contentsClusterBounds(false, 'left', 1)).toEqual({ right: 0, left: null });
    expect(contentsClusterBounds(false, 'right', 1)).toEqual({ right: 0, left: null });
  });

  it('moves past a sidebar pinned right', () => {
    expect(contentsClusterBounds(true, 'right', 1.25)).toEqual({
      right: CONTENTS_SIDEBAR_WIDTH * 1.25,
      left: null,
    });
  });

  it('stops short of a sidebar pinned left, so it never covers Add Page', () => {
    expect(contentsClusterBounds(true, 'left', 1)).toEqual({
      right: 0,
      left: contentsSidebarClearancePx(1),
    });
  });
});
