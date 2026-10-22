// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIDE_PX, sidePlacement } from './CategoryFlyoutSide';
import type { PaletteTileDef } from './palette-tile-defs';

// Where a tile's side panel hangs (docs/specs/007-editor/toolbar-layout.md "The category bar"): beside the tile's own
// column, as offsets into the strip's root.

const def = { id: 'components:card' } as PaletteTileDef;

// The strip's root spanning the window, a flyout in it, and a tile in the flyout, at known places.
function layout({
  flyout,
  tile,
  windowWidth = 1440,
}: {
  flyout: [number, number];
  tile: [number, number];
  windowWidth?: number;
}) {
  vi.stubGlobal('innerWidth', windowWidth);
  const root = document.createElement('div');
  root.setAttribute('data-toolbar-palette', '');
  const fly = document.createElement('div');
  fly.setAttribute('data-category-flyout', '');
  const el = document.createElement('button');
  fly.append(el);
  root.append(fly);
  document.body.append(root);
  const rect = (left: number, right: number, top: number) =>
    new DOMRect(left, top, right - left, 50);
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect(0, windowWidth, 12));
  vi.spyOn(fly, 'getBoundingClientRect').mockReturnValue(rect(flyout[0], flyout[1], 70));
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(tile[0], tile[1], 300));
  return el;
}

// The panel's left edge, from the `right` offset it is given.
const leftOf = (right: number, windowWidth = 1440) => windowWidth - right - SIDE_PX;

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('a side panel’s place', () => {
  it('opens a right-column tile to the flyout’s right, lined up with the tile', () => {
    const placed = sidePlacement(layout({ flyout: [400, 976], tile: [690, 970] }), def)!;
    expect(leftOf(placed.right)).toBe(976 + 8);
    expect(placed.top).toBe(300 - 12 - 4);
  });

  it('opens a left-column tile to the flyout’s left', () => {
    const placed = sidePlacement(layout({ flyout: [400, 976], tile: [406, 686] }), def)!;
    expect(leftOf(placed.right)).toBe(400 - 8 - SIDE_PX);
  });

  it('opens against the tile itself where the window has no room on its side', () => {
    const left = sidePlacement(layout({ flyout: [100, 676], tile: [106, 386] }), def)!;
    expect(leftOf(left.right)).toBe(386 + 8);
    document.body.innerHTML = '';
    const right = sidePlacement(layout({ flyout: [800, 1376], tile: [1090, 1370] }), def)!;
    expect(leftOf(right.right)).toBe(1090 - 8 - SIDE_PX);
  });

  it('has no place outside a flyout', () => {
    expect(sidePlacement(document.createElement('button'), def)).toBeNull();
  });
});
