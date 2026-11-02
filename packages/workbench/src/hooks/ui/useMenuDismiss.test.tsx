// @vitest-environment jsdom
// How a floating menu closes (docs/specs/008-canvas/canvas-and-palette.md, Tab menu "Closing"): a primary press
// outside it, the canvas included even though the canvas stops its own events; a wheel outside it; the window
// losing focus. Presses inside it, on its trigger or on the surfaces it opened never close it.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { MENU_DISMISS_TOUCH_GRACE_MS, useMenuDismiss } from './useMenuDismiss';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function Menu({
  onClose,
  anchor,
  shown = true,
}: {
  onClose: () => void;
  anchor?: Element | null;
  shown?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useMenuDismiss(ref, onClose, anchor);
  return shown ? (
    <div ref={ref} data-testid="menu">
      <button type="button">Rename</button>
    </div>
  ) : null;
}

// A press the way a browser sends one. jsdom has no PointerEvent, so a MouseEvent carries the fields.
function press(target: Element, init: { button?: number; pointerType?: string } = {}) {
  const e = new MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
  });
  Object.defineProperty(e, 'pointerType', { value: init.pointerType ?? 'mouse' });
  act(() => {
    target.dispatchEvent(e);
  });
}

// A canvas that stops every pointerdown it gets, as the editor's canvas does.
function canvas() {
  const el = document.createElement('div');
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.appendChild(el);
  return el;
}

function setup(over: { anchor?: Element | null; shown?: boolean } = {}) {
  const onClose = vi.fn();
  const view = render(<Menu onClose={onClose} {...over} />);
  return { onClose, view };
}

describe('useMenuDismiss', () => {
  it('closes on a press on the canvas, which stops its own pointer events', () => {
    const { onClose } = setup();
    press(canvas());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open for a press inside it', () => {
    const { onClose, view } = setup();
    press(view.getByRole('button', { name: 'Rename' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stays open for a press on the control that opened it, which toggles it itself', () => {
    const anchor = document.createElement('button');
    anchor.appendChild(document.createElement('svg'));
    document.body.appendChild(anchor);
    const { onClose } = setup({ anchor });
    press(anchor.firstChild as Element);
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    'data-menu-flyout',
    'data-confirm-popover',
    'data-tour-popover',
    'data-context-menu-trigger',
  ])('stays open for a press on a surface it opened (%s)', (attr) => {
    const surface = document.createElement('div');
    surface.setAttribute(attr, '');
    const inner = document.createElement('span');
    surface.appendChild(inner);
    document.body.appendChild(surface);
    const { onClose } = setup();
    press(inner);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores a right press, whose release re-opens the menu', () => {
    const { onClose } = setup();
    press(canvas(), { button: 2 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores the lift of the long press that opened it, then closes on a later tap', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const { onClose } = setup();
    const surface = canvas();
    now.mockReturnValue(1000 + MENU_DISMISS_TOUCH_GRACE_MS - 1);
    press(surface, { pointerType: 'touch' });
    expect(onClose).not.toHaveBeenCalled();
    now.mockReturnValue(1000 + MENU_DISMISS_TOUCH_GRACE_MS);
    press(surface, { pointerType: 'touch' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives a mouse no grace', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const { onClose } = setup();
    press(canvas());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a wheel outside it, not on one inside it', () => {
    const { onClose, view } = setup();
    act(() => {
      view.getByTestId('menu').dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      canvas().dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the window loses focus', () => {
    const { onClose } = setup();
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the menu box is gone (a modal it swapped for owns dismissal)', () => {
    const { onClose } = setup({ shown: false });
    press(canvas());
    act(() => {
      window.dispatchEvent(new Event('blur'));
      document.body.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stops listening once the menu unmounts', () => {
    const { onClose, view } = setup();
    view.unmount();
    press(canvas());
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
