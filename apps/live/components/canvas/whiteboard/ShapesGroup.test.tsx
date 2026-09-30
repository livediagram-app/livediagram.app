// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ShapePenIcon } from '@/components/palette/palette-icons';
import { tileById } from '@/components/palette/palette-tile-defs';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { DOCK_ICON_PX } from './whiteboard-icons';
import { WhiteboardDock } from './WhiteboardDock';
import { dockModel as model, renderDock } from './dock-test-utils';
import { PINS_FULL_HINT } from './ShapesGroup';

const shapesBar = () => screen.getByRole('toolbar', { name: 'Shapes' });

afterEach(() => vi.restoreAllMocks());

describe('the Shapes flyout', () => {
  it('picks a shape and closes', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Diamond' }));
    expect(m.pickShape).toHaveBeenCalledWith('diamond');
    expect(screen.queryByRole('group', { name: 'Shapes' })).toBeNull();
  });

  it('offers rectangle, ellipse, diamond, cylinder, line and arrow with their keys', () => {
    renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    const group = screen.getByRole('group', { name: 'Shapes' });
    const options = [...group.querySelectorAll('button')].map((b) => [
      b.getAttribute('aria-label'),
      b.getAttribute('aria-keyshortcuts'),
    ]);
    expect(options).toEqual([
      ['Rectangle', 'R'],
      ['Ellipse', 'O'],
      ['Diamond', 'D'],
      ['Cylinder', 'C'],
      ['Line', 'L'],
      ['Arrow', 'A'],
    ]);
  });

  it('opens on hover and closes a moment after the pointer leaves', () => {
    vi.useFakeTimers();
    try {
      renderDock();
      const shapes = screen.getByRole('button', { name: 'Shapes' });
      fireEvent.pointerEnter(shapes, { pointerType: 'mouse' });
      const flyout = screen.getByRole('group', { name: 'Shapes' });
      // Hovering never takes the keyboard focus away from the board.
      expect(flyout.contains(document.activeElement)).toBe(false);
      fireEvent.pointerLeave(shapes, { pointerType: 'mouse' });
      // Crossing the gap into the flyout keeps it open.
      fireEvent.pointerEnter(flyout, { pointerType: 'mouse' });
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByRole('group', { name: 'Shapes' })).toBeTruthy();
      fireEvent.pointerLeave(screen.getByRole('group', { name: 'Shapes' }), {
        pointerType: 'mouse',
      });
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.queryByRole('group', { name: 'Shapes' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not open for a finger passing over it', () => {
    renderDock();
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Shapes' }), {
      pointerType: 'touch',
    });
    expect(screen.queryByRole('group', { name: 'Shapes' })).toBeNull();
  });
});

describe('the Path tool in the Shapes group', () => {
  it('follows the sticky note and presses while in hand', () => {
    const { m } = renderDock(model('path'));
    const button = within(shapesBar()).getByRole('button', { name: 'Path tool' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(m.pickPath).toHaveBeenCalled();
  });

  it('is the Shape Pen palette tile’s own icon component, at the dock’s size', () => {
    const tile = tileById('tools:shape-pen')!;
    expect((tile.icon as ReactElement).type).toBe(ShapePenIcon);
    renderDock(model('select'));
    const svg = screen.getByRole('button', { name: 'Path tool' }).querySelector('svg')!;
    const { container } = render(<ShapePenIcon size={DOCK_ICON_PX} />);
    expect(svg.outerHTML).toBe(container.querySelector('svg')!.outerHTML);
  });
});

describe('shape slots', () => {
  it('fills the frequent slots with their kinds, each arming its kind', () => {
    const { m } = renderDock(model('select', { frequentShapes: ['star', 'hexagon'] }));
    fireEvent.click(within(shapesBar()).getByRole('button', { name: 'Star' }));
    expect(m.pickShape).toHaveBeenCalledWith('star');
  });

  it('presses the slot of the kind in hand, and neither Shapes nor More shapes', () => {
    renderDock(model('shape', { armedShape: 'rectangle' }));
    const bar = shapesBar();
    expect(
      within(bar).getByRole('button', { name: 'Rectangle' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(within(bar).getByRole('button', { name: 'Shapes' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('presses Shapes for a flyout kind off the bar, More shapes for any other kind', () => {
    const { view } = renderDock(model('shape', { armedShape: 'diamond' }));
    const pressed = (name: string) =>
      within(shapesBar()).getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed('Shapes')).toBe('true');
    expect(pressed('More shapes')).toBe('false');
    view.rerender(dock(model('shape', { armedShape: 'hexagon' })));
    expect(pressed('Shapes')).toBe('false');
    expect(pressed('More shapes')).toBe('true');
  });

  it('holds the frequent slots still while a flyout is open, then catches up', () => {
    const m = model('select');
    const { view } = renderDock(m);
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    view.rerender(dock({ ...m, frequentShapes: ['star', 'rectangle'] }));
    expect(slotKeys()).toEqual(['rectangle', 'ellipse']);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(slotKeys()).toEqual(['star', 'rectangle']);
  });

  it('pins a frequent kind from its menu (right-click)', () => {
    const { m } = renderDock(model('select'));
    fireEvent.contextMenu(within(shapesBar()).getByRole('button', { name: 'Ellipse' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin to dock' }));
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'pin', pinned: ['ellipse'] });
  });

  it('unpins a pinned kind from its menu (Shift+F10)', () => {
    const { m } = renderDock(model('select', { pinnedShapes: ['star'] }));
    const star = within(shapesBar()).getByRole('button', { name: 'Star' });
    fireEvent.keyDown(star, { key: 'F10', shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Unpin' }));
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'unpin', pinned: [] });
  });

  it('refuses a third pin from the menu, with the hint', () => {
    const { m } = renderDock(model('select', { pinnedShapes: ['star', 'cloud'] }));
    fireEvent.keyDown(within(shapesBar()).getByRole('button', { name: 'Rectangle' }), {
      key: 'ContextMenu',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pin to dock' }));
    expect(m.applySlotOutcome).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe(PINS_FULL_HINT);
  });
});

describe('dragging a slot', () => {
  // The separator at x 100; pinned slots 44 wide from x 0.
  function layOut() {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const el = this as HTMLElement;
      if (el.dataset.slotSeparator !== undefined) return rect(100, 1);
      if (el.dataset.pinnedSlot !== undefined) {
        const i = [...document.querySelectorAll('[data-pinned-slot]')].indexOf(el);
        return rect(i * 46, 44);
      }
      return rect(0, 0);
    });
  }

  it('pins a frequent kind dragged left of the separator', () => {
    layOut();
    const { m } = renderDock(model('select'));
    const ellipse = within(shapesBar()).getByRole('button', { name: 'Ellipse' });
    fireEvent.pointerDown(ellipse, { button: 0, clientX: 150, clientY: 10 });
    move(140);
    move(50);
    expect(document.querySelector('[data-slot-ghost="ellipse"]')).toBeTruthy();
    expect(document.querySelector('[data-slot-drop-indicator="ok"]')).toBeTruthy();
    up(50);
    fireEvent.click(ellipse);
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'pin', pinned: ['ellipse'] });
    // The release is the end of the drag, not a pick.
    expect(m.pickShape).not.toHaveBeenCalled();
    expect(document.querySelector('[data-slot-ghost]')).toBeNull();
  });

  it('still picks on a press that travels less than the threshold', () => {
    layOut();
    const { m } = renderDock(model('select'));
    const ellipse = within(shapesBar()).getByRole('button', { name: 'Ellipse' });
    fireEvent.pointerDown(ellipse, { button: 0, clientX: 150, clientY: 10 });
    move(154);
    up(154);
    fireEvent.click(ellipse);
    expect(m.applySlotOutcome).not.toHaveBeenCalled();
    expect(m.pickShape).toHaveBeenCalledWith('ellipse');
  });

  it('unpins a pinned kind dragged right of the separator', () => {
    layOut();
    const { m } = renderDock(model('select', { pinnedShapes: ['star'] }));
    const star = within(shapesBar()).getByRole('button', { name: 'Star' });
    fireEvent.pointerDown(star, { button: 0, clientX: 20, clientY: 10 });
    move(160);
    up(160);
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'unpin', pinned: [] });
  });

  it('refuses a third pin dropped between the pinned slots, and says why', () => {
    layOut();
    const { m } = renderDock(model('select', { pinnedShapes: ['star', 'cloud'] }));
    const ellipse = within(shapesBar()).getByRole('button', { name: 'Ellipse' });
    fireEvent.pointerDown(ellipse, { button: 0, clientX: 200, clientY: 10 });
    move(95);
    expect(document.querySelector('[data-slot-drop-indicator="refused"]')).toBeTruthy();
    up(95);
    expect(m.applySlotOutcome).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe(PINS_FULL_HINT);
  });

  it('replaces a pinned kind it is dropped onto', () => {
    layOut();
    const { m } = renderDock(model('select', { pinnedShapes: ['star', 'cloud'] }));
    const ellipse = within(shapesBar()).getByRole('button', { name: 'Ellipse' });
    fireEvent.pointerDown(ellipse, { button: 0, clientX: 200, clientY: 10 });
    move(60);
    up(60);
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'pin', pinned: ['star', 'ellipse'] });
  });

  it('drops nothing when Escape cancels the drag', () => {
    layOut();
    const { m } = renderDock(model('select'));
    const ellipse = within(shapesBar()).getByRole('button', { name: 'Ellipse' });
    fireEvent.pointerDown(ellipse, { button: 0, clientX: 150, clientY: 10 });
    move(50);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    up(50);
    expect(m.applySlotOutcome).not.toHaveBeenCalled();
  });
});

function dock(m: WhiteboardDockModel) {
  return (
    <WhiteboardDock
      model={m}
      ink="#1c1917"
      canUndo
      canRedo={false}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
    />
  );
}

function slotKeys() {
  return [...document.querySelectorAll<HTMLElement>('[data-frequent-slot]')].map(
    (el) => el.dataset.slotKey,
  );
}

function rect(left: number, width: number): DOMRect {
  return {
    left,
    right: left + width,
    width,
    top: 0,
    bottom: 44,
    height: 44,
    x: left,
    y: 0,
    toJSON: () => ({}),
  };
}

function move(clientX: number) {
  act(() => {
    window.dispatchEvent(pointer('pointermove', clientX));
  });
}

function up(clientX: number) {
  act(() => {
    window.dispatchEvent(pointer('pointerup', clientX));
  });
}

function pointer(type: string, clientX: number): Event {
  const ev = new MouseEvent(type, { clientX, clientY: 10, bubbles: true, cancelable: true });
  return ev;
}
