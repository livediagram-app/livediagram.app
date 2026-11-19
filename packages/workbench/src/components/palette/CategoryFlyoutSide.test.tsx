// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CategoryFlyoutSide,
  SIDE_PX,
  animationScale,
  sideLift,
  sidePlacement,
} from './CategoryFlyoutSide';
import { CARD, testKit, type TestTile } from './category-flyout-testing';

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
    // The flyout's own place, which a phone's panel covers when the kit says so.
    expect(placed.flyoutTop).toBe(70 - 12);
    expect(placed.flyoutHeight).toBe(50);
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

describe('sideLift', () => {
  it('rises just enough to fit, never past the strip top, and not at all when it fits', () => {
    expect(sideLift(900, 800, 500)).toBe(100);
    expect(sideLift(900, 800, 60)).toBe(60);
    expect(sideLift(700, 800, 500)).toBe(0);
    expect(sideLift(900, 800, -5)).toBe(0);
  });
});

describe('animationScale', () => {
  it('reads a matrix scale, else 1', () => {
    expect(animationScale('matrix(0.86, 0, 0, 0.86, 0, 0)')).toBe(0.86);
    expect(animationScale('none')).toBe(1);
    expect(animationScale('')).toBe(1);
    expect(animationScale('matrix(0, 0, 0, 0, 0, 0)')).toBe(1);
  });
});

// livehuddle's side panel (its docs/specs/007-editor/toolbar-layout.md "The category bar"): it keeps clear of the tab
// bar, measured at its settled size, covers the whole flyout on a phone, and hides at once while a tile is dragged out.
describe('a kit’s own side panel rules', () => {
  const props = {
    onBack: vi.fn(),
    scale: 1,
    actions: { hasImage: false, used: [] },
    pendingDraw: null,
    hoverHandlers: {
      onPointerEnter: vi.fn(),
      onPointerLeave: vi.fn(),
      onDragStart: vi.fn(),
      onDragEnd: vi.fn(),
    },
  };
  const rect = (top: number, height: number) => new DOMRect(0, top, SIDE_PX, height);
  const sidePanel = () => document.querySelector<HTMLElement>('[data-category-flyout-side]')!;

  it('rises above the kit’s floor by its settled height, re-measured when its opening animation ends', () => {
    // The panel hangs from 300 and is 600 tall settled: mid-animation it reads 0.86 of that.
    let scale = 0.86;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (!this.hasAttribute('data-category-flyout-side')) return rect(0, 0);
      return rect(Number.parseFloat(this.style.top || '300'), 600 * scale);
    });
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) =>
      (el as HTMLElement).hasAttribute?.('data-category-flyout-side')
        ? ({ transform: `matrix(${scale}, 0, 0, ${scale}, 0, 0)` } as CSSStyleDeclaration)
        : real(el),
    );
    render(
      <CategoryFlyoutSide
        side={{ def: CARD, top: 300, right: 0 }}
        kit={testKit({ sideFloor: () => 838 })}
        isMobile={false}
        {...props}
      />,
    );
    // 300 + 600 = 900 settled bottom, against the 838 floor: 62 up, even measured mid-animation.
    expect(sidePanel().style.top).toBe('238px');
    scale = 1;
    act(() => {
      fireEvent.animationEnd(sidePanel());
    });
    expect(sidePanel().style.top).toBe('238px');
    // A window resize measures again, and the settled panel holds its place.
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(sidePanel().style.top).toBe('238px');
  });

  it('watches its own size where the browser can, and stops when it closes', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let changed = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          changed = cb;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    let height = 100;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.hasAttribute('data-category-flyout-side')
        ? rect(Number.parseFloat(this.style.top || '300'), height)
        : rect(0, 0);
    });
    const { unmount } = render(
      <CategoryFlyoutSide
        side={{ def: CARD, top: 300, right: 0 }}
        kit={testKit({ sideFloor: () => 800 })}
        isMobile={false}
        {...props}
      />,
    );
    expect(observe).toHaveBeenCalledWith(sidePanel());
    expect(sidePanel().style.top).toBe('300px');
    // Its presets grew it past the floor: it rises to fit.
    height = 600;
    act(() => changed());
    expect(sidePanel().style.top).toBe('200px');
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('on a phone covers the whole flyout, top to bottom, and hides at once while a tile is dragged out', () => {
    const kit = testKit({ sideCoversFlyoutOnPhone: true, sideHidesOnDrag: true });
    const { rerender } = render(
      <CategoryFlyoutSide
        side={{ def: CARD, top: 300, right: 0, flyoutTop: 60, flyoutHeight: 520 }}
        kit={kit}
        isMobile
        {...props}
      />,
    );
    const panel = sidePanel();
    expect(panel.style.top).toBe('60px');
    // At least as tall as the flyout (Work Tracker 628): a short panel never leaves its bottom rows showing below.
    expect(panel.style.minHeight).toBe('520px');
    // A column whose body grows, so the footer pins to the bottom of the stretched panel, no empty band under it.
    expect(panel.className).toContain('flex-col');
    expect(panel.children[1]!.className).toBe('grow');
    expect(panel.className).toContain('transition-opacity');
    rerender(
      <CategoryFlyoutSide
        side={{ def: CARD, top: 300, right: 0 }}
        kit={kit}
        isMobile
        {...props}
        seeThrough
      />,
    );
    // Without the flyout's place it hangs from its tile.
    expect(panel.style.top).toBe('300px');
    expect(panel.className).toContain('opacity-0');
    expect(panel.className).not.toContain('transition-opacity');
    expect(panel.hasAttribute('data-drop-through')).toBe(true);
  });

  it('on a phone otherwise hangs from its tile, at its own height', () => {
    render(
      <CategoryFlyoutSide
        side={{ def: CARD, top: 300, right: 0, flyoutTop: 60, flyoutHeight: 520 }}
        kit={testKit()}
        isMobile
        {...props}
      />,
    );
    expect(sidePanel().style.top).toBe('300px');
    expect(sidePanel().style.minHeight).toBe('');
    expect(sidePanel().className).not.toContain('flex-col');
  });
});
