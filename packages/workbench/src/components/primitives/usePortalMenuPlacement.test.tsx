// @vitest-environment jsdom
// A PortalMenu closes on a press outside itself and its anchor, but not on a press inside a panel it opened
// that is portalled elsewhere: a flyout, an anchored popover, or a ConfirmPopover.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePortalMenuPlacement } from './usePortalMenuPlacement';
import { VIEWPORT_EDGE_MARGIN } from '../../lib/clamp-to-viewport';

afterEach(() => {
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
