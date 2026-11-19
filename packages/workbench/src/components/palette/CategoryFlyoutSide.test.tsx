// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryFlyoutSide, SIDE_PX, sidePlacement } from './CategoryFlyoutSide';
import { CARD, testKit, type TestTile } from './category-flyout-test-kit';

// Where a tile's side panel hangs (each editor's docs/specs/007-editor/toolbar-layout.md "A tile's side panel"):
// beside the tile's own column, as offsets into the strip's root, and risen so its foot stays no lower than the
// flyout's.

const def = { id: 'components:card' };

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
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

describe('a side panel’s rise', () => {
  const handlers = {
    onPointerEnter: vi.fn(),
    onPointerLeave: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
  };

  // The panel at `top` in a strip whose flyout's foot is at `flyoutBottom` (none: no flyout), `height` tall once laid
  // out though its box measures `boxHeight` mid-animation.
  function panel({
    top,
    height,
    boxHeight = height,
    flyoutBottom,
  }: {
    top: number;
    height: number;
    boxHeight?: number;
    flyoutBottom?: number;
  }) {
    vi.stubGlobal('innerHeight', 800);
    const root = document.createElement('div');
    root.setAttribute('data-toolbar-palette', '');
    if (flyoutBottom !== undefined) {
      const fly = document.createElement('div');
      fly.setAttribute('data-category-flyout', '');
      fly.getBoundingClientRect = () => new DOMRect(0, 0, 400, flyoutBottom);
      root.append(fly);
    }
    document.body.append(root);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.hasAttribute('data-category-flyout-side')
        ? new DOMRect(0, top, SIDE_PX, boxHeight)
        : new DOMRect();
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
    render(
      <CategoryFlyoutSide<TestTile, { hasImage: boolean; used: string[] }, string | null>
        side={{ def: CARD, top, right: 0 }}
        kit={testKit()}
        onBack={vi.fn()}
        isMobile={false}
        scale={1}
        actions={{ hasImage: false, used: [] }}
        pendingDraw={null}
        hoverHandlers={handlers}
      />,
      { container: root.appendChild(document.createElement('div')) },
    );
    return document.querySelector<HTMLElement>('[data-category-flyout-side]')!;
  }

  it('stays lined up with its tile when it fits', () => {
    expect(panel({ top: 100, height: 200, flyoutBottom: 600 }).style.top).toBe('100px');
  });

  it('rises so its foot stays no lower than the flyout’s, at its laid-out height', () => {
    // Mid-animation its box is short; its laid-out height still lifts it.
    expect(panel({ top: 300, height: 400, boxHeight: 100, flyoutBottom: 600 }).style.top).toBe(
      '200px',
    );
  });

  it('rises inside the window without a flyout, never above the strip’s top', () => {
    expect(panel({ top: 500, height: 400 }).style.top).toBe('392px');
    cleanup();
    document.body.innerHTML = '';
    expect(panel({ top: 100, height: 900 }).style.top).toBe('0px');
  });

  it('takes the window’s floor for a flyout not yet laid out', () => {
    expect(panel({ top: 500, height: 400, flyoutBottom: 0 }).style.top).toBe('392px');
  });
});
