// @vitest-environment jsdom
// A PortalMenu closes on a press outside itself and its anchor, but not on a press inside a panel it opened
// that is portalled elsewhere: a flyout, an anchored popover, or a ConfirmPopover.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePortalMenuPlacement } from './usePortalMenuPlacement';

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
