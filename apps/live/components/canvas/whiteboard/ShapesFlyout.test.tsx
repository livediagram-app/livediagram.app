// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dockModel as model, renderDock } from './dock-test-utils';
import { WhiteboardDock } from './WhiteboardDock';

const flyout = () => screen.queryByRole('group', { name: 'Shapes' });
const field = () => screen.getByRole('combobox', { name: 'Search shapes' });
const options = () => screen.queryAllByRole('option');
const labels = () => options().map((o) => o.getAttribute('aria-label'));
const active = () => options().find((o) => o.getAttribute('aria-selected') === 'true');

function openByPress() {
  const opener = screen.getByRole('button', { name: 'Shapes' });
  fireEvent.click(opener);
  return opener;
}

describe('the Shapes flyout', () => {
  it('shows S on the Shapes button', () => {
    renderDock();
    const button = screen.getByRole('button', { name: 'Shapes' });
    expect(button.getAttribute('aria-keyshortcuts')).toBe('S');
    expect(button.textContent).toBe('S');
  });

  it('opens on S (a request from the model) with its field focused, and only Escape closes it', () => {
    const m = model();
    const { view } = renderDock(m);
    const again = (n: number) =>
      view.rerender(
        <WhiteboardDock
          model={{ ...m, shapesRequest: n }}
          ink="#1c1917"
          canUndo
          canRedo={false}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
        />,
      );
    again(1);
    expect(flyout()).toBeTruthy();
    expect(document.activeElement).toBe(field());
    // A second S types into the field (the editor's keys stand down while it has the focus).
    fireEvent.change(field(), { target: { value: 's' } });
    expect(flyout()).toBeTruthy();
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(flyout()).toBeNull();
    // Opened by a key, like a hover: the focus goes back to the board.
    expect(document.activeElement).toBe(document.body);
  });

  it('opens on a press with its search field focused', () => {
    renderDock();
    const opener = openByPress();
    expect(document.activeElement).toBe(field());
    expect(opener.getAttribute('aria-expanded')).toBe('true');
  });

  it('opens on hover too, and then its field takes the focus', () => {
    renderDock();
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Shapes' }), {
      pointerType: 'mouse',
    });
    expect(flyout()).toBeTruthy();
    expect(document.activeElement).toBe(field());
  });

  it('does not open for a finger passing over it', () => {
    renderDock();
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Shapes' }), {
      pointerType: 'touch',
    });
    expect(flyout()).toBeNull();
  });

  it('shows the six slots in two unlabelled rows, Recent over Most used, keys where they have one', () => {
    renderDock();
    openByPress();
    const listbox = screen.getByRole('listbox', { name: 'Shapes' });
    // Named for screen readers, with nothing written on screen.
    const rows = within(listbox).getAllByRole('group');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Recent shapes',
      'Most used shapes',
    ]);
    expect(listbox.textContent).not.toMatch(/Recent|Most used/);
    expect(listbox.querySelector('[data-flyout-heading]')).toBeNull();
    expect(
      options().map((o) => [o.getAttribute('aria-label'), o.getAttribute('aria-keyshortcuts')]),
    ).toEqual([
      ['Parallelogram', null],
      ['Hexagon', null],
      ['Document', null],
      ['Diamond', 'D'],
      ['Cylinder', 'C'],
      ['Line', 'L'],
    ]);
  });

  it('picks a slot with a press, plainly, and closes', () => {
    const { m } = renderDock();
    openByPress();
    fireEvent.click(screen.getByRole('option', { name: 'Cylinder' }));
    expect(m.pickShape).toHaveBeenCalledWith('cylinder');
    expect(m.pickSearchedShape).not.toHaveBeenCalled();
    expect(flyout()).toBeNull();
  });

  it('keeps its slots while open, whatever the ranking does meanwhile', () => {
    const m = model();
    const { view } = renderDock(m);
    openByPress();
    view.rerender(
      <WhiteboardDock
        model={{
          ...m,
          slotShapes: { mostUsed: ['star', 'cloud', 'hexagon'], recent: m.slotShapes.recent },
        }}
        ink="#1c1917"
        canUndo
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
      />,
    );
    expect(labels().slice(3)).toEqual(['Diamond', 'Cylinder', 'Line']);
  });

  it('pins a slot from its menu (right-click), inside the flyout', () => {
    const { m } = renderDock(model('select', { pinnedShapes: ['arrow'] }));
    openByPress();
    fireEvent.contextMenu(screen.getByRole('option', { name: 'Line' }));
    expect(flyout()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pin to dock' }));
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'pin', pinned: ['arrow', 'line'] });
  });

  it('pins the reached entry from the keyboard (Shift+F10 in the field), Escape backs out', () => {
    const { m } = renderDock(model('select', { pinnedShapes: [] }));
    openByPress();
    fireEvent.keyDown(field(), { key: 'ArrowRight' });
    fireEvent.keyDown(field(), { key: 'F10', shiftKey: true });
    const pin = screen.getByRole('button', { name: 'Pin to dock' });
    expect(document.activeElement).toBe(pin);
    fireEvent.keyDown(pin, { key: 'Escape' });
    expect(flyout()).toBeTruthy();
    expect(document.activeElement).toBe(field());
    fireEvent.keyDown(field(), { key: 'ContextMenu' });
    fireEvent.click(screen.getByRole('button', { name: 'Pin to dock' }));
    expect(m.applySlotOutcome).toHaveBeenCalledWith({ type: 'pin', pinned: ['hexagon'] });
  });

  it('replaces the slots with at most six results as you type, the named shape first', () => {
    renderDock();
    openByPress();
    fireEvent.change(field(), { target: { value: 'a' } });
    expect(options()).toHaveLength(6);
    fireEvent.change(field(), { target: { value: 'trap' } });
    expect(labels()[0]).toBe('Trapezoid');
    expect(field().getAttribute('aria-activedescendant')).toBe(active()!.id);
  });

  it('moves with the arrow keys and picks a result with Enter, reported as a search pick', () => {
    const { m } = renderDock();
    openByPress();
    fireEvent.keyDown(field(), { key: 'ArrowRight' });
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    expect(active()!.getAttribute('aria-label')).toBe('Cylinder');
    fireEvent.change(field(), { target: { value: 'database' } });
    expect(active()!.getAttribute('aria-label')).toBe('Cylinder');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(m.pickSearchedShape).toHaveBeenCalledWith('cylinder');
    expect(flyout()).toBeNull();
  });

  it('says so when nothing matches, and Enter picks nothing', () => {
    const { m } = renderDock();
    openByPress();
    fireEvent.change(field(), { target: { value: 'zzqx' } });
    expect(screen.getByText('No shapes match')).toBeTruthy();
    expect(options()).toHaveLength(0);
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(m.pickSearchedShape).not.toHaveBeenCalled();
  });

  it('closes a pressed-open flyout on Escape, back to its button', () => {
    const { m } = renderDock(model('select'));
    const opener = openByPress();
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(flyout()).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(m.pickShape).not.toHaveBeenCalled();
  });

  it('gives the focus back to the board when a hover-opened flyout closes on Escape', () => {
    renderDock();
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Shapes' }), {
      pointerType: 'mouse',
    });
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(flyout()).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('closes a moment after the pointer leaves, focus and all, and back to the board', () => {
    vi.useFakeTimers();
    try {
      renderDock();
      const shapes = screen.getByRole('button', { name: 'Shapes' });
      fireEvent.pointerEnter(shapes, { pointerType: 'mouse' });
      fireEvent.pointerLeave(shapes, { pointerType: 'mouse' });
      // Crossing the gap into the flyout keeps it open.
      fireEvent.pointerEnter(flyout()!, { pointerType: 'mouse' });
      act(() => vi.advanceTimersByTime(1000));
      expect(flyout()).toBeTruthy();
      fireEvent.pointerLeave(flyout()!, { pointerType: 'mouse' });
      act(() => vi.advanceTimersByTime(1000));
      expect(flyout()).toBeNull();
      expect(document.activeElement).toBe(document.body);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays open for someone typing, whatever the pointer does', () => {
    vi.useFakeTimers();
    try {
      renderDock();
      const shapes = screen.getByRole('button', { name: 'Shapes' });
      fireEvent.pointerEnter(shapes, { pointerType: 'mouse' });
      fireEvent.keyDown(field(), { key: 'h' });
      fireEvent.change(field(), { target: { value: 'h' } });
      fireEvent.pointerLeave(shapes, { pointerType: 'mouse' });
      act(() => vi.advanceTimersByTime(1000));
      expect(flyout()).toBeTruthy();
      expect(document.activeElement).toBe(field());
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes no name under the shapes: the name is the accessible name and the tooltip', () => {
    renderDock();
    openByPress();
    expect(document.querySelector('[data-shape-search-name]')).toBeNull();
    const option = screen.getByRole('option', { name: 'Hexagon' });
    expect(option.textContent).toBe('');
  });

  it('draws the previews in the board ink', () => {
    renderDock();
    openByPress();
    const preview = document.querySelector<HTMLElement>(
      '[data-shape-search] [data-shape-preview="cylinder"]',
    )!;
    expect(preview.style.color).toBe('rgb(28, 25, 23)');
  });
});
