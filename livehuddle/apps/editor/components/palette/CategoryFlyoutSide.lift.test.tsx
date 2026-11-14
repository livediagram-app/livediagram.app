// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryFlyoutSide, animationScale, sideFloor, sideLift } from './CategoryFlyoutSide';
import type { PaletteTileDef } from './palette-tile-defs';

// The side panel keeps clear of the tab bar (docs/specs/007-editor/toolbar-layout.md "The category bar"): it rises to
// fit above the canvas region's bottom, measured at its settled size, not mid-way through its opening animation.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const rect = (top: number, height: number) => new DOMRect(0, top, 304, height);

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

describe('sideFloor', () => {
  it('is the canvas region bottom, 8px clear, else the window bottom', () => {
    vi.stubGlobal('innerHeight', 900);
    const panel = document.createElement('div');
    document.body.append(panel);
    expect(sideFloor(panel)).toBe(892);
    const region = document.createElement('div');
    region.setAttribute('data-canvas-root', '');
    document.body.append(region);
    vi.spyOn(region, 'getBoundingClientRect').mockReturnValue(rect(76, 770));
    expect(sideFloor(panel)).toBe(838);
  });
});

describe('CategoryFlyoutSide', () => {
  it('lifts by its settled height above the canvas region, re-measured when its opening animation ends', () => {
    vi.stubGlobal('innerHeight', 900);
    const region = document.createElement('div');
    region.setAttribute('data-canvas-root', '');
    document.body.append(region);
    vi.spyOn(region, 'getBoundingClientRect').mockReturnValue(rect(76, 770)); // floor 838
    // The panel hangs from 300 and is 600 tall settled: mid-animation it reads 0.86 of that.
    let scale = 0.86;
    let lift = 0;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (!this.hasAttribute('data-category-flyout-side')) return rect(0, 0);
      lift = 300 - Number.parseFloat(this.style.top || '300');
      return rect(300 - lift, 600 * scale);
    });
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) =>
      (el as HTMLElement).hasAttribute?.('data-category-flyout-side')
        ? ({ transform: `matrix(${scale}, 0, 0, ${scale}, 0, 0)` } as CSSStyleDeclaration)
        : real(el),
    );
    const def = {
      id: 'tools:rug',
      label: 'Add Rug',
      caption: 'Rug',
      action: { type: 'shape', kind: 'rug' },
    } as unknown as PaletteTileDef;
    const { container } = render(
      <CategoryFlyoutSide
        side={{ def, top: 300, right: 0 }}
        isMobile
        scale={1}
        actions={{} as never}
        pendingDraw={null}
        hoverHandlers={{
          onPointerEnter: () => {},
          onPointerLeave: () => {},
          onDragStart: () => {},
          onDragEnd: () => {},
        }}
      />,
    );
    const panel = container.querySelector<HTMLElement>('[data-category-flyout-side]')!;
    // 300 + 600 = 900 settled bottom, against the 838 floor: 62 up, even measured mid-animation.
    expect(panel.style.top).toBe('238px');
    scale = 1;
    act(() => {
      fireEvent.animationEnd(panel);
    });
    expect(panel.style.top).toBe('238px');
  });

  it('on a phone covers the whole flyout, top to bottom, and hides at once while a tile is dragged out', () => {
    const def = {
      id: 'tools:rug',
      label: 'Add Rug',
      caption: 'Rug',
      action: { type: 'shape', kind: 'rug' },
    } as unknown as PaletteTileDef;
    const props = {
      isMobile: true,
      scale: 1,
      actions: {} as never,
      pendingDraw: null,
      hoverHandlers: {
        onPointerEnter: () => {},
        onPointerLeave: () => {},
        onDragStart: () => {},
        onDragEnd: () => {},
      },
    };
    const { container, rerender } = render(
      <CategoryFlyoutSide
        side={{ def, top: 300, right: 0, flyoutTop: 60, flyoutHeight: 520 }}
        {...props}
      />,
    );
    const panel = container.querySelector<HTMLElement>('[data-category-flyout-side]')!;
    expect(panel.style.top).toBe('60px');
    // At least as tall as the flyout (Work Tracker 628): a short panel never leaves its bottom rows showing below.
    expect(panel.style.minHeight).toBe('520px');
    expect(panel.className).not.toContain('opacity-0');
    rerender(
      <CategoryFlyoutSide
        side={{ def, top: 300, right: 0, flyoutTop: 60 }}
        {...props}
        seeThrough
      />,
    );
    expect(panel.className).toContain('opacity-0');
    expect(panel.className).not.toContain('transition-opacity');
    expect(panel.hasAttribute('data-drop-through')).toBe(true);
  });
});
