// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardWidgetId } from '@liveplanner/items';
import { planPalette } from '../plan-palette';
import { BoardWidgetZone } from './BoardWidgetZone';

// Work Tracker 880 (docs/specs/026-plan/board-widgets.md "The header"): a zone too full for its widgets stays one row
// that never scrolls; the widgets that do not fit go into More at its end, the Filter holding the zone's start, and a
// press inside More shows on More. With room again every widget is back in its own order.
afterEach(cleanup);

// The widths jsdom has no layout for: the zone's room, each widget 100 px (the Filter 200), the + and Edit Widgets
// 28 px each, More 70 px.
let room = 1000;
let observers: (() => void)[] = [];
beforeEach(() => {
  room = 1000;
  observers = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        observers.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hasAttribute('data-widget-zone') ? room : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.dataset['widget']) return this.dataset['widget'] === 'filter' ? 200 : 100;
    if (this.hasAttribute('data-widget-control')) return 28;
    if (this.hasAttribute('data-widget-more-ghost')) return 70;
    return 0;
  });
  return () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  };
});
const resize = (next: number) => {
  room = next;
  act(() => observers.forEach((o) => o()));
};

const WIDGETS: BoardWidgetId[] = ['count', 'progress', 'filter', 'mine', 'people', 'due'];

function show(
  widgets: BoardWidgetId[] = WIDGETS,
  canEdit = true,
  pressed: Partial<Record<BoardWidgetId, string>> = {},
) {
  const onChange = vi.fn();
  const props = {
    canEdit,
    palette: planPalette('light', {}),
    onChange,
    labelOf: (id: BoardWidgetId) => (id === 'filter' ? 'Filter' : id),
    render: (kind: BoardWidgetId) => (
      <button type="button" data-widget-pressed={pressed[kind]}>
        {kind}
      </button>
    ),
  };
  const view = render(<BoardWidgetZone widgets={widgets} {...props} />);
  return {
    onChange,
    rerender: (next: BoardWidgetId[]) =>
      view.rerender(<BoardWidgetZone widgets={next} {...props} />),
  };
}
const row = () =>
  within(screen.getByRole('list', { name: 'Board widgets' }))
    .queryAllByRole('listitem')
    .map((el) => el.dataset['widget']);
const more = () => screen.queryByRole('button', { name: /^More widgets/ });
const openMore = () => fireEvent.click(more()!);
const panel = () => screen.getByRole('dialog', { name: 'More Widgets' });
const inPanel = () =>
  within(panel())
    .getAllByRole('listitem')
    .map((el) => el.dataset['widget']);

describe('a widget zone too full for its widgets', () => {
  it('keeps every widget in its own order while they fit, with no More', () => {
    room = 2000;
    show();
    expect(more()).toBeNull();
    expect(screen.queryByRole('group', { name: 'Filter widget' })).toBeNull();
    expect(row()).toEqual(WIDGETS);
    expect(document.querySelector<HTMLElement>('[data-widget-zone]')!.style.width).toBe('798px');
  });

  it('pins the Filter, keeps the widgets that fit in order and puts the rest in More', () => {
    // 1000: Filter 200 + More 70 + two buttons 56 + 4 gaps 24 leaves 650: 5 widgets of 100 and their gaps fit 5.
    room = 600;
    show();
    expect(
      screen.getByRole('group', { name: 'Filter widget' }).getAttribute('aria-keyshortcuts'),
    ).toBe('Delete');
    expect(row()).toEqual(['count', 'progress']);
    expect(more()!.getAttribute('aria-label')).toBe('More widgets, 3 more');
    expect(more()!.textContent).toContain('More');
    openMore();
    expect(inPanel()).toEqual(['mine', 'people', 'due']);
    // The measuring layer is never read or reached.
    const layer = document.querySelector<HTMLElement>('[data-widget-measure]')!;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.hasAttribute('inert')).toBe(true);
  });

  it('brings every widget back, and closes More, once they fit again', () => {
    room = 600;
    show();
    openMore();
    resize(2000);
    expect(more()).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'More Widgets' })).toBeNull();
    expect(row()).toEqual(WIDGETS);
  });

  it('names a press inside More on More, and reserves room for it', () => {
    room = 600;
    show(WIDGETS, true, { people: 'Ana', progress: 'Only Mine' });
    // The reserve for the name takes one more widget into More.
    expect(row()).toEqual(['count']);
    expect(more()!.textContent).toContain('Only Mine +1');
    expect(more()!.getAttribute('aria-label')).toBe('More widgets, 4 more, pressed: Only Mine +1');
  });

  it('names nothing while the pressed widget is in the row', () => {
    room = 600;
    show(WIDGETS, true, { count: 'Overdue' });
    expect(more()!.getAttribute('aria-label')).toBe('More widgets, 3 more');
  });

  it('lets a Viewer open More and read its widgets, with nothing to move or remove', () => {
    room = 600;
    show(WIDGETS, false, { due: 'Overdue' });
    expect(more()!.getAttribute('aria-label')).toBe('More widgets, 4 more, pressed: Overdue');
    openMore();
    expect(inPanel()).toEqual(['progress', 'mine', 'people', 'due']);
    const pinned = screen.getByRole('group', { name: 'Filter widget' });
    expect(pinned.hasAttribute('tabindex')).toBe(false);
    expect(within(panel()).queryByRole('button', { name: /^Remove / })).toBeNull();
  });

  it('shows the × in More in edit mode, and a press in More keeps edit mode', () => {
    room = 600;
    const { onChange } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Widgets' }));
    openMore();
    fireEvent.pointerDown(within(panel()).getByText('people'));
    expect(screen.getByRole('button', { name: 'Done Editing Widgets' })).toBeTruthy();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Remove people' }));
    expect(onChange).toHaveBeenCalledWith(['count', 'progress', 'filter', 'mine', 'due']);
  });

  it('takes a widget in More off with Delete, and moves it with Alt+arrows', () => {
    room = 600;
    const { onChange } = show();
    openMore();
    const people = within(panel()).getByRole('listitem', { name: 'people widget' });
    fireEvent.keyDown(people, { key: 'ArrowLeft', altKey: true });
    expect(onChange).toHaveBeenLastCalledWith([
      'count',
      'progress',
      'filter',
      'people',
      'mine',
      'due',
    ]);
    fireEvent.keyDown(people, { key: 'Delete' });
    expect(onChange).toHaveBeenLastCalledWith(['count', 'progress', 'filter', 'mine', 'due']);
  });

  it('takes the pinned Filter off with Delete, and never moves it with Alt+arrows', () => {
    room = 600;
    const { onChange } = show();
    const pinned = screen.getByRole('group', { name: 'Filter widget' });
    fireEvent.keyDown(pinned, { key: 'ArrowLeft', altKey: true });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(pinned, { key: 'Delete' });
    expect(onChange).toHaveBeenCalledWith(['count', 'progress', 'mine', 'people', 'due']);
  });

  it('moves a row widget past its neighbour, the Filter keeping its place in the list', () => {
    room = 600;
    const { onChange } = show();
    fireEvent.keyDown(screen.getByRole('listitem', { name: 'progress widget' }), {
      key: 'ArrowRight',
      altKey: true,
    });
    expect(onChange).toHaveBeenCalledWith(['count', 'mine', 'filter', 'progress', 'people', 'due']);
  });

  it('changes nothing while the zone is not laid out', () => {
    room = 0;
    show();
    expect(more()).toBeNull();
    expect(row()).toEqual(WIDGETS);
  });
});
