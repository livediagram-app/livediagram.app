// @vitest-environment jsdom
// A PortalMenu closes on a press outside itself and its anchor, but not on a press inside a panel it opened
// that is portalled elsewhere: a flyout, an anchored popover, or a ConfirmPopover.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flipSide, sideRoom, usePortalMenuPlacement } from './usePortalMenuPlacement';
import { VIEWPORT_EDGE_MARGIN } from '../../lib/clamp-to-viewport';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const el = (attr?: string) => {
  const node = document.createElement('div');
  if (attr) node.setAttribute(attr, '');
  const inner = document.createElement('button');
  node.append(inner);
  document.body.append(node);
  return inner;
};

const press = (target: Element) =>
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

describe('usePortalMenuPlacement outside press', () => {
  it('keeps the menu open for presses inside its own portalled panels', () => {
    const anchor = el();
    const menu = el();
    const onClose = vi.fn();
    renderHook(() => usePortalMenuPlacement(anchor, 'below', menu, onClose));
    press(el('data-menu-flyout'));
    press(el('data-anchored-popover'));
    press(el('data-confirm-popover'));
    press(menu);
    press(anchor);
    expect(onClose).not.toHaveBeenCalled();
    press(el());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('usePortalMenuPlacement on a short screen', () => {
  const menuOf = (height: number) => {
    const node = el();
    Object.defineProperty(node, 'scrollHeight', { configurable: true, value: height });
    return node;
  };

  it('holds a menu taller than the screen to its height, less the margins, so it scrolls', () => {
    const anchor = el();
    const menu = menuOf(window.innerHeight + 400);
    const onClose = vi.fn();
    const { result } = renderHook(() => usePortalMenuPlacement(anchor, 'below', menu, onClose));
    expect(result.current?.maxHeight).toBe(window.innerHeight - 2 * VIEWPORT_EDGE_MARGIN);
  });

  it('leaves a menu that fits at its own height', () => {
    const anchor = el();
    const menu = menuOf(200);
    const onClose = vi.fn();
    const { result } = renderHook(() => usePortalMenuPlacement(anchor, 'below', menu, onClose));
    expect(result.current).not.toBeNull();
    expect(result.current?.maxHeight).toBeUndefined();
  });
});

// docs/specs/004-interface-design/menus.md "Opening on the side with room" (Work Tracker 972): a menu that does not fit
// on its side opens on the other when that has more room, rather than being nudged over its anchor.
describe('flipSide', () => {
  const at = (top: number, bottom = top + 28) => ({ top, bottom });
  it('keeps the side asked for while the menu fits there', () => {
    expect(flipSide('below-start', at(100), 400, 900, 8)).toBe('below-start');
    expect(flipSide('above', at(600), 400, 900, 8)).toBe('above');
  });
  it('flips to the side with more room when it does not fit', () => {
    expect(flipSide('below-start', at(800), 400, 900, 8)).toBe('above-start');
    expect(flipSide('below', at(800), 400, 900, 8)).toBe('above');
    expect(flipSide('above-start', at(40), 400, 900, 8)).toBe('below-start');
  });
  it('stays put when the other side has no more room', () => {
    expect(flipSide('below', at(430), 884, 900, 8)).toBe('below');
  });
});

describe('usePortalMenuPlacement near the bottom of the screen', () => {
  it('opens above an anchor low on the screen when the menu does not fit below it', () => {
    const anchor = el();
    anchor.getBoundingClientRect = () =>
      ({ top: 700, bottom: 728, left: 40, right: 240 }) as DOMRect;
    const menu = el();
    Object.defineProperty(menu, 'scrollHeight', { configurable: true, value: 400 });
    const { result } = renderHook(() =>
      usePortalMenuPlacement(anchor, 'below-start', menu, vi.fn()),
    );
    expect(result.current?.placement).toBe('above-start');
    // Hung from the anchor's top (jsdom's zero-size menu is then nudged by the edge clamp).
    expect(result.current!.top - 700).toBeLessThanOrEqual(8);
    expect(result.current?.maxHeight).toBeUndefined();
  });

  it('holds a menu taller than the room above a low anchor to that room, so it never covers the anchor', () => {
    const anchor = el();
    anchor.getBoundingClientRect = () =>
      ({ top: 600, bottom: 628, left: 40, right: 240 }) as DOMRect;
    const menu = el();
    // 35 rows of a type with ten templates and the rest (Work Tracker 972), on a 900px screen.
    Object.defineProperty(menu, 'scrollHeight', { configurable: true, value: 1840 });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
    const { result } = renderHook(() =>
      usePortalMenuPlacement(anchor, 'below-start', menu, vi.fn()),
    );
    expect(result.current?.placement).toBe('above-start');
    expect(result.current?.maxHeight).toBe(600 - 4 - VIEWPORT_EDGE_MARGIN);
  });

  it('holds a menu taller than the room below a high anchor to that room, opening below', () => {
    const anchor = el();
    anchor.getBoundingClientRect = () =>
      ({ top: 200, bottom: 228, left: 40, right: 240 }) as DOMRect;
    const menu = el();
    Object.defineProperty(menu, 'scrollHeight', { configurable: true, value: 1840 });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
    const { result } = renderHook(() =>
      usePortalMenuPlacement(anchor, 'below-start', menu, vi.fn()),
    );
    expect(result.current?.placement).toBe('below-start');
    expect(result.current?.maxHeight).toBe(900 - 228 - 4 - VIEWPORT_EDGE_MARGIN);
  });
});

// docs/specs/004-interface-design/menus.md "Opening at the pointer": a right-click's menu opens at the point, not at
// its anchor, and still flips when there is no room below the point.
describe('usePortalMenuPlacement at a point', () => {
  const lowAnchor = () => {
    const anchor = el();
    anchor.getBoundingClientRect = () =>
      ({ top: 500, bottom: 524, left: 500, right: 524 }) as DOMRect;
    return anchor;
  };
  const menuOf = (height: number) => {
    const node = el();
    Object.defineProperty(node, 'scrollHeight', { configurable: true, value: height });
    // Inside the screen, so the edge clamp leaves it where it was put.
    node.getBoundingClientRect = () =>
      ({ top: 300, bottom: 300 + height, left: 300, right: 524 }) as DOMRect;
    return node;
  };

  it('puts the menu’s corner at the point, whatever the anchor’s box', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
    const point = { x: 120, y: 200 };
    const anchor = lowAnchor();
    const menu = menuOf(200);
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      usePortalMenuPlacement(anchor, 'below-start', menu, onClose, null, point),
    );
    expect(result.current).toMatchObject({ left: 120, top: 200, placement: 'below-start' });
  });

  it('opens upwards from a point low on the screen', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
    const point = { x: 40, y: 880 };
    const anchor = lowAnchor();
    const menu = menuOf(300);
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      usePortalMenuPlacement(anchor, 'below-start', menu, onClose, null, point),
    );
    expect(result.current?.placement).toBe('above-start');
    expect(result.current?.left).toBe(40);
  });
});

describe('sideRoom', () => {
  it('is the height between the anchor and the screen edge, less the gap and margin', () => {
    expect(sideRoom('below', { top: 100, bottom: 128 }, 900, 8)).toBe(760);
    expect(sideRoom('above-start', { top: 100, bottom: 128 }, 900, 8)).toBe(88);
  });
});
