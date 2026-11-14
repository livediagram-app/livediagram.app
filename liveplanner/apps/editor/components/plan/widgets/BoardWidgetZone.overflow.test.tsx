// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardWidgetId } from '@liveplanner/items';
import { planPalette } from '../plan-palette';
import { BoardWidgetZone } from './BoardWidgetZone';
import { EDGE_FADE_PX, edgeFade, nudgeInRow, scrollingWidgets, slotInList } from './zone-overflow';

// Work Tracker 823 (docs/specs/026-plan/board-widgets.md "The header"): a zone too full for its widgets scrolls
// sideways, the Filter holding its start outside the scroll so nothing scrolls it out of reach, with a fade at an
// edge that has more past it; with room again every widget is back in its own order.
afterEach(cleanup);

// The widths jsdom has no layout for: the zone's room, and the row's content (12 widgets of 90 px, at most 1440 px
// header widths), its own width the room the pinned Filter leaves.
let room = 1000;
let content = 1100;
let pinWidth = 0;
beforeEach(() => {
  room = 1000;
  content = 1100;
  pinWidth = 0;
  const width = (el: HTMLElement) =>
    el.hasAttribute('data-widget-zone')
      ? room
      : el.hasAttribute('data-widget-row')
        ? room - (el.parentElement?.querySelector('[data-widget-pin]') ? pinWidth : 0)
        : 0;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return width(this);
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.hasAttribute('data-widget-row')) return width(this);
    return this.parentElement?.querySelector('[data-widget-pin]') ? content - pinWidth : content;
  });
  return () => vi.restoreAllMocks();
});

const WIDGETS: BoardWidgetId[] = ['count', 'progress', 'filter', 'mine'];

function show(widgets: BoardWidgetId[] = WIDGETS, canEdit = true) {
  const onChange = vi.fn();
  const props = {
    canEdit,
    palette: planPalette('light', {}),
    onChange,
    labelOf: (id: BoardWidgetId) => (id === 'filter' ? 'Filter' : id),
    render: (kind: BoardWidgetId) => <span>{kind}</span>,
  };
  const view = render(<BoardWidgetZone widgets={widgets} {...props} />);
  return {
    onChange,
    rerender: () => view.rerender(<BoardWidgetZone widgets={widgets} {...props} />),
  };
}
const zone = () => document.querySelector<HTMLElement>('[data-widget-zone]')!;
const row = () => document.querySelector<HTMLElement>('[data-widget-row]')!;
const listed = () => screen.getAllByRole('listitem').map((el) => el.dataset['widget']);

describe('a widget zone too full for its widgets', () => {
  it('pins the Filter at its start, outside the scrolling row, the rest in their order', () => {
    show();
    const pinned = screen.getByRole('group', { name: 'Filter widget' });
    expect(zone().firstElementChild!.contains(pinned)).toBe(true);
    expect(row().contains(pinned)).toBe(false);
    expect(listed()).toEqual(['count', 'progress', 'mine']);
    expect(pinned.getAttribute('aria-keyshortcuts')).toBe('Delete');
  });

  it('leaves every widget in its own order while they fit, and without a Filter', () => {
    content = 900;
    show();
    expect(screen.queryByRole('group', { name: 'Filter widget' })).toBeNull();
    expect(listed()).toEqual(WIDGETS);
    cleanup();
    content = 1100;
    show(['count', 'progress', 'mine']);
    expect(listed()).toEqual(['count', 'progress', 'mine']);
  });

  it('keeps the Filter pinned until the row is back well within its room', () => {
    pinWidth = 200;
    const { rerender } = show();
    expect(screen.getByRole('group', { name: 'Filter widget' })).toBeTruthy();
    // Just under the room: still pinned, so a count growing a digit never flips it.
    content = 995;
    rerender();
    act(() => void row().dispatchEvent(new Event('scroll')));
    expect(screen.getByRole('group', { name: 'Filter widget' })).toBeTruthy();
    content = 900;
    act(() => void row().dispatchEvent(new Event('scroll')));
    expect(screen.queryByRole('group', { name: 'Filter widget' })).toBeNull();
    expect(listed()).toEqual(WIDGETS);
  });

  it('fades an edge with more past it as the row scrolls', () => {
    show();
    expect(row().style.maskImage).toMatch(/^linear-gradient\(to right, rgb\(0, 0, 0\) 0,/);
    expect(row().style.maskImage).toContain('transparent 100%');
    row().scrollLeft = 40;
    act(() => void row().dispatchEvent(new Event('scroll')));
    expect(row().style.maskImage).toContain('transparent 0,');
  });

  it('takes the pinned Filter off with Delete, and never moves it with Alt+arrows', () => {
    const { onChange } = show();
    const pinned = screen.getByRole('group', { name: 'Filter widget' });
    fireEvent.keyDown(pinned, { key: 'ArrowLeft', altKey: true });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(pinned, { key: 'Delete' });
    expect(onChange).toHaveBeenCalledWith(['count', 'progress', 'mine']);
  });

  it('moves a row widget past its visible neighbour, the Filter keeping its place in the list', () => {
    const { onChange } = show();
    fireEvent.keyDown(screen.getByRole('listitem', { name: 'progress widget' }), {
      key: 'ArrowRight',
      altKey: true,
    });
    expect(onChange).toHaveBeenCalledWith(['count', 'mine', 'filter', 'progress']);
  });

  it('labels the pinned Filter for a Viewer too, with no keys to move or remove it', () => {
    show(WIDGETS, false);
    const pinned = screen.getByRole('group', { name: 'Filter widget' });
    expect(pinned.hasAttribute('tabindex')).toBe(false);
    expect(pinned.hasAttribute('aria-keyshortcuts')).toBe(false);
  });
});

describe('zone-overflow', () => {
  it('lists the row without the Filter only while it is pinned', () => {
    expect(scrollingWidgets(WIDGETS, false)).toBe(WIDGETS);
    expect(scrollingWidgets(WIDGETS, true)).toEqual(['count', 'progress', 'mine']);
  });

  it("puts a row slot back into the board's list", () => {
    const rowList = scrollingWidgets(WIDGETS, true);
    expect(slotInList(WIDGETS, rowList, 0)).toBe(0);
    expect(slotInList(WIDGETS, rowList, 2)).toBe(3);
    expect(slotInList(WIDGETS, rowList, 3)).toBe(4);
  });

  it('nudges as before when nothing is pinned, or the board has no Filter', () => {
    expect(nudgeInRow(WIDGETS, 'progress', 1, false)).toEqual([
      'count',
      'filter',
      'progress',
      'mine',
    ]);
    expect(nudgeInRow(['count', 'mine'], 'count', 1, true)).toEqual(['mine', 'count']);
    expect(nudgeInRow(WIDGETS, 'count', -1, true)).toEqual(WIDGETS);
  });

  it('fades only an edge with more past it', () => {
    expect(edgeFade(false, false)).toBeUndefined();
    expect(edgeFade(false, true)?.maskImage).toBe(
      `linear-gradient(to right, #000 0, #000 0px, #000 calc(100% - ${EDGE_FADE_PX}px), transparent 100%)`,
    );
    expect(edgeFade(true, false)?.WebkitMaskImage).toContain(
      `transparent 0, #000 ${EDGE_FADE_PX}px`,
    );
  });
});
