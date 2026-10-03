// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ShapePenIcon } from '@/components/palette/palette-icons';
import { tileById } from '@/components/palette/palette-tile-defs';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import type { WhiteboardShapeKey } from '@/lib/whiteboard-shape-catalogue';
import { DOCK_ICON_PX } from './whiteboard-icons';
import { WhiteboardDock } from './WhiteboardDock';
import { dockModel as model, renderDock } from './dock-test-utils';
import { PINS_FULL_HINT } from './ShapesGroup';

const shapesBar = () => screen.getByRole('toolbar', { name: 'Shapes' });

// Seven pinned: the limit.
const FULL: WhiteboardShapeKey[] = [
  'star',
  'cloud',
  'hexagon',
  'triangle',
  'document',
  'stadium',
  'trapezoid',
];

afterEach(() => vi.restoreAllMocks());

describe('the Path tool in the drawing tools', () => {
  it('follows the sticky note and presses while in hand', () => {
    const { m } = renderDock(model('path'));
    const content = screen.getByRole('toolbar', { name: 'Drawing tools' });
    const button = within(content).getByRole('button', { name: 'Path tool' });
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

describe('the pinned side', () => {
  it('holds the pinned shapes, a separator and Shapes, and nothing else', () => {
    renderDock(model('select', { pinnedShapes: ['arrow', 'rectangle', 'ellipse'] }));
    const items = [
      ...shapesBar().querySelectorAll<HTMLElement>('[data-dock-item], [data-pinned-separator]'),
    ].map((el) => el.dataset.dockItem ?? '|');
    expect(items).toEqual(['pinned:arrow', 'pinned:rectangle', 'pinned:ellipse', '|', 'shapes']);
  });

  it('shows the key of every pinned shape that has one, like every dock tool', () => {
    renderDock(model('select', { pinnedShapes: ['arrow', 'rectangle', 'star', 'line', 'sticky'] }));
    const keys = [...shapesBar().querySelectorAll<HTMLElement>('[data-pinned-slot]')].map((b) => [
      b.getAttribute('aria-label'),
      b.getAttribute('aria-keyshortcuts'),
      b.textContent,
    ]);
    expect(keys).toEqual([
      ['Arrow', 'A', 'A'],
      ['Rectangle', 'R', 'R'],
      ['Star', null, ''],
      ['Line', 'L', 'L'],
      ['Sticky note', 'N', 'N'],
    ]);
  });

  it('presses a pinned sticky note while one is in hand', () => {
    renderDock(model('sticky', { pinnedShapes: ['sticky'], armedShape: 'sticky' }));
    expect(
      within(shapesBar()).getByRole('button', { name: 'Sticky note' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('presses Shapes for a sticky note in hand that is not pinned', () => {
    renderDock(model('sticky', { pinnedShapes: [], armedShape: 'sticky' }));
    expect(
      within(shapesBar()).getByRole('button', { name: 'Shapes' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('arms a pinned kind with a press', () => {
    const { m } = renderDock(model('select', { pinnedShapes: ['star'] }));
    fireEvent.click(within(shapesBar()).getByRole('button', { name: 'Star' }));
    expect(m.pickShape).toHaveBeenCalledWith('star');
  });

  it('presses the pinned kind in hand, and Shapes for any other board shape', () => {
    const { view } = renderDock(
      model('shape', { pinnedShapes: ['rectangle'], armedShape: 'rectangle' }),
    );
    const pressed = (name: string) =>
      within(shapesBar()).getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed('Rectangle')).toBe('true');
    expect(pressed('Shapes')).toBe('false');
    view.rerender(dock(model('shape', { pinnedShapes: ['rectangle'], armedShape: 'hexagon' })));
    expect(pressed('Shapes')).toBe('true');
  });

  it('unpins from its menu (Shift+F10)', () => {
    const { m } = renderDock(model('select', { pinnedShapes: ['star'] }));
    const star = within(shapesBar()).getByRole('button', { name: 'Star' });
    fireEvent.keyDown(star, { key: 'F10', shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Unpin' }));
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'unpin', pinned: [] });
  });

  it('unpins from its menu (right-click)', () => {
    const { m } = renderDock(model('select', { pinnedShapes: ['star', 'cloud'] }));
    fireEvent.contextMenu(within(shapesBar()).getByRole('button', { name: 'Cloud' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unpin' }));
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'unpin', pinned: ['star'] });
  });
});

describe('dragging onto and off the pinned side', () => {
  // Pinned slots 44 wide from x 0, 46 apart; the separator at x 400; the bar 0..500, 0..44 high.
  function layOut() {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const el = this as HTMLElement;
      if (el.dataset.pinnedSeparator !== undefined) return rect(400, 1);
      if (el.dataset.dockGroup === 'shapes') return rect(0, 500);
      if (el.dataset.pinnedSlot !== undefined) {
        const i = [...document.querySelectorAll('[data-pinned-slot]')].indexOf(el);
        return rect(i * 46, 44);
      }
      return rect(0, 0);
    });
  }

  const openFlyout = () => fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
  const option = (name: string) => screen.getByRole('option', { name });

  it('pins a flyout slot dropped on the pinned side, then closes the flyout', () => {
    layOut();
    const { m } = renderDock(model('select', { pinnedShapes: ['star'] }));
    openFlyout();
    const diamond = option('Diamond');
    fireEvent.pointerDown(diamond, { button: 0, clientX: 450, clientY: -80 });
    move(440, -70);
    move(300, 20);
    expect(document.querySelector('[data-slot-ghost="diamond"]')).toBeTruthy();
    expect(document.querySelector('[data-slot-drop-indicator="ok"]')).toBeTruthy();
    // The flyout stays open for the drag.
    expect(screen.getByRole('group', { name: 'Shapes' })).toBeTruthy();
    up(300, 20);
    fireEvent.click(diamond);
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'pin', pinned: ['star', 'diamond'] });
    expect(m.pickShape).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Shapes' })).toBeNull();
  });

  it('pins a search result the same way', () => {
    layOut();
    const { m } = renderDock(model('select', { pinnedShapes: [] }));
    openFlyout();
    fireEvent.change(screen.getByRole('combobox', { name: 'Search shapes' }), {
      target: { value: 'cloud' },
    });
    fireEvent.pointerDown(option('Cloud'), { button: 0, clientX: 450, clientY: -80 });
    move(300, -60);
    move(-20, 20);
    up(-20, 20);
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'pin', pinned: ['cloud'] });
  });

  it('still picks on a press that travels less than the threshold', () => {
    layOut();
    const { m } = renderDock(model('select'));
    openFlyout();
    const diamond = option('Diamond');
    fireEvent.pointerDown(diamond, { button: 0, clientX: 450, clientY: -80 });
    move(454, -80);
    up(454, -80);
    fireEvent.click(diamond);
    expect(m.applySlotOutcome).not.toHaveBeenCalled();
    expect(m.pickShape).toHaveBeenCalledWith('diamond');
  });

  it('leaves the flyout open when a shape is dropped off the bar', () => {
    layOut();
    const { m } = renderDock(model('select'));
    openFlyout();
    fireEvent.pointerDown(option('Diamond'), { button: 0, clientX: 450, clientY: -80 });
    move(460, -200);
    up(460, -200);
    expect(m.applySlotOutcome).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Shapes' })).toBeTruthy();
  });

  it('unpins a pinned kind dragged past the separator, or off the bar', () => {
    layOut();
    const { m, view } = renderDock(model('select', { pinnedShapes: ['star', 'cloud'] }));
    const star = within(shapesBar()).getByRole('button', { name: 'Star' });
    fireEvent.pointerDown(star, { button: 0, clientX: 20, clientY: 10 });
    move(460, 20);
    expect(document.querySelector('[data-slot-drop-indicator="ok"]')).toBeTruthy();
    up(460, 20);
    expect(m.applySlotOutcome).toHaveBeenLastCalledWith({ type: 'unpin', pinned: ['cloud'] });
    view.rerender(dock({ ...m, pinnedShapes: ['cloud'] }));
    const cloud = within(shapesBar()).getByRole('button', { name: 'Cloud' });
    fireEvent.pointerDown(cloud, { button: 0, clientX: 20, clientY: 10 });
    move(20, 300);
    up(20, 300);
    expect(m.applySlotOutcome).toHaveBeenLastCalledWith({ type: 'unpin', pinned: [] });
  });

  it('reorders within the pinned side', () => {
    layOut();
    const { m } = renderDock(model('select', { pinnedShapes: ['star', 'cloud'] }));
    const cloud = within(shapesBar()).getByRole('button', { name: 'Cloud' });
    fireEvent.pointerDown(cloud, { button: 0, clientX: 60, clientY: 10 });
    move(30, 20);
    move(10, 20);
    up(10, 20);
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'pin', pinned: ['cloud', 'star'] });
  });

  it('refuses an eighth pin dropped beside the pinned shapes, and says why', () => {
    layOut();
    const { m } = renderDock(model('select', { pinnedShapes: FULL }));
    openFlyout();
    fireEvent.pointerDown(option('Diamond'), { button: 0, clientX: 450, clientY: -80 });
    move(360, 20);
    expect(document.querySelector('[data-slot-drop-indicator="refused"]')).toBeTruthy();
    up(360, 20);
    expect(m.applySlotOutcome).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe(PINS_FULL_HINT);
  });

  it('replaces a pinned kind it is dropped onto when seven are pinned', () => {
    layOut();
    const { m } = renderDock(model('select', { pinnedShapes: FULL }));
    openFlyout();
    fireEvent.pointerDown(option('Diamond'), { button: 0, clientX: 450, clientY: -80 });
    move(60, 20);
    expect(within(shapesBar()).getByRole('button', { name: 'Cloud' }).className).toContain(
      'ring-2',
    );
    up(60, 20);
    expect(m.applySlotOutcome).toHaveBeenCalledWith({
      type: 'pin',
      pinned: ['star', 'diamond', 'hexagon', 'triangle', 'document', 'stadium', 'trapezoid'],
    });
  });

  it('drops nothing when Escape cancels the drag', () => {
    layOut();
    const { m } = renderDock(model('select'));
    openFlyout();
    fireEvent.pointerDown(option('Diamond'), { button: 0, clientX: 450, clientY: -80 });
    move(300, 20);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    up(300, 20);
    expect(m.applySlotOutcome).not.toHaveBeenCalled();
  });
});

function dock(m: WhiteboardDockModel) {
  return <WhiteboardDock model={m} ink="#1c1917" />;
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

function move(clientX: number, clientY: number) {
  act(() => {
    window.dispatchEvent(pointer('pointermove', clientX, clientY));
  });
}

function up(clientX: number, clientY: number) {
  act(() => {
    window.dispatchEvent(pointer('pointerup', clientX, clientY));
  });
}

function pointer(type: string, clientX: number, clientY: number): Event {
  return new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
}
