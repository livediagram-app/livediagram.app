// @vitest-environment jsdom
// The category bar and its flyouts (docs/specs/007-editor/toolbar-layout.md "The category bar"): hover intent, the
// keyboard and the guards that keep a flyout open mid-drag or mid-search, on the meeting palette's bar.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';
import { HOVER_CLOSE_MS, HOVER_OPEN_MS } from './CategoryBar';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function show() {
  const h = Object.fromEntries(
    PALETTE_ADD_HANDLER_KEYS.map((k) => [k, vi.fn()]),
  ) as unknown as PaletteAddHandlers;
  render(
    <ToolbarPalette
      canvasTool="select"
      onSetCanvasTool={vi.fn()}
      canvasEmpty={false}
      pendingDraw={null}
      {...h}
    />,
  );
  return h;
}

const button = (name: string) => screen.getByRole('button', { name });
const flyout = () => document.querySelector<HTMLElement>('[data-category-flyout]');
const heading = () => flyout()?.querySelector('h3')?.textContent;
const mouse = { pointerType: 'mouse' };
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('hover intent', () => {
  it('opens a category the pointer rests on, not one it sweeps across', () => {
    show();
    fireEvent.pointerEnter(button('Seating'), mouse);
    fireEvent.pointerLeave(button('Seating'), mouse);
    fireEvent.pointerEnter(button('Travel'), mouse);
    wait(HOVER_OPEN_MS - 10);
    expect(flyout()).toBeNull();
    wait(20);
    expect(heading()).toBe('Travel');
  });

  it('moves an open flyout to the next category at once, and ignores a touch', () => {
    show();
    fireEvent.pointerEnter(button('Seating'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.pointerEnter(button('Rooms'), mouse);
    expect(heading()).toBe('Rooms');
    fireEvent.pointerEnter(button('Travel'), { pointerType: 'touch' });
    expect(heading()).toBe('Rooms');
  });

  it('closes once the pointer has left both the bar and the flyout, after a grace', () => {
    show();
    fireEvent.pointerEnter(button('Seating'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.pointerLeave(button('Seating'), mouse);
    // Crossing the gap into the flyout keeps it.
    fireEvent.pointerEnter(flyout()!.firstElementChild!, mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(flyout()).not.toBeNull();
    fireEvent.pointerLeave(flyout()!.firstElementChild!, mouse);
    wait(HOVER_CLOSE_MS);
    expect(flyout()).toBeNull();
  });

  it('keeps a category opened by a click open when the pointer leaves, until a press outside', () => {
    show();
    fireEvent.click(button('Seating'), { detail: 1 });
    fireEvent.pointerLeave(button('Seating'), mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(heading()).toBe('Seating');
    // Pointing at another category still moves it there, and it stays pinned.
    fireEvent.pointerEnter(button('Travel'), mouse);
    expect(heading()).toBe('Travel');
    fireEvent.pointerLeave(button('Travel'), mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(heading()).toBe('Travel');
    fireEvent.pointerDown(document.body);
    expect(flyout()).toBeNull();
  });

  it('pins a category the hover opened once it is clicked', () => {
    show();
    fireEvent.pointerEnter(button('Seating'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.click(button('Seating'), { detail: 1 });
    fireEvent.pointerLeave(button('Seating'), mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(heading()).toBe('Seating');
  });

  it('keeps a click on a category the hover opened from closing it', () => {
    show();
    fireEvent.pointerEnter(button('Seating'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.click(button('Seating'), { detail: 1 });
    expect(heading()).toBe('Seating');
  });

  it('closes the open category on a second tap', () => {
    show();
    fireEvent.pointerDown(button('Seating'), { pointerType: 'touch' });
    fireEvent.click(button('Seating'), { detail: 1 });
    expect(heading()).toBe('Seating');
    fireEvent.pointerDown(button('Seating'), { pointerType: 'touch' });
    fireEvent.click(button('Seating'), { detail: 1 });
    expect(flyout()).toBeNull();
    // And a third opens it again.
    fireEvent.pointerDown(button('Seating'), { pointerType: 'touch' });
    fireEvent.click(button('Seating'), { detail: 1 });
    expect(heading()).toBe('Seating');
  });

  it('moves a tap on another category there rather than closing', () => {
    show();
    fireEvent.pointerDown(button('Seating'), { pointerType: 'touch' });
    fireEvent.click(button('Seating'), { detail: 1 });
    fireEvent.pointerDown(button('Travel'), { pointerType: 'touch' });
    fireEvent.click(button('Travel'), { detail: 1 });
    expect(heading()).toBe('Travel');
  });

  it('keeps a second mouse click on the open category from closing it', () => {
    show();
    fireEvent.pointerDown(button('Seating'), mouse);
    fireEvent.click(button('Seating'), { detail: 1 });
    fireEvent.pointerDown(button('Seating'), mouse);
    fireEvent.click(button('Seating'), { detail: 1 });
    expect(heading()).toBe('Seating');
  });

  it('stays open while a tile is dragged out, and closes on the drop', () => {
    show();
    fireEvent.pointerEnter(button('Seating'), mouse);
    wait(HOVER_OPEN_MS);
    const body = flyout()!.firstElementChild!;
    fireEvent.dragStart(within(flyout()!).getByRole('button', { name: 'Add Chair' }), {
      dataTransfer: { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '' },
    });
    fireEvent.pointerLeave(body, mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(flyout()).not.toBeNull();
    fireEvent.dragEnd(within(flyout()!).getByRole('button', { name: 'Add Chair' }));
    expect(flyout()).toBeNull();
  });

  it('stays open while its search holds a query', () => {
    show();
    fireEvent.pointerEnter(button('Icons'), mouse);
    wait(HOVER_OPEN_MS);
    const field = within(flyout()!).getByRole('textbox') as HTMLInputElement;
    field.focus();
    fireEvent.change(field, { target: { value: 'star' } });
    fireEvent.pointerLeave(flyout()!.firstElementChild!, mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(flyout()).not.toBeNull();
  });
});

describe('the keyboard', () => {
  it('walks the bar with the arrows, and Down opens a category with its first tile focused', () => {
    show();
    button('Write').focus();
    fireEvent.keyDown(button('Write'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Travel'));
    fireEvent.keyDown(button('Travel'), { key: 'ArrowLeft' });
    fireEvent.keyDown(button('Write'), { key: 'ArrowLeft' });
    // Wraps round to the last.
    expect(document.activeElement).toBe(button('Media'));
    fireEvent.keyDown(button('Media'), { key: 'ArrowDown' });
    expect(heading()).toBe('Media');
    expect(document.activeElement?.hasAttribute('data-flyout-item')).toBe(true);
  });

  it('moves an open flyout along with the focus, and toggles from Enter', () => {
    show();
    fireEvent.click(button('Seating'), { detail: 0 });
    expect(heading()).toBe('Seating');
    fireEvent.keyDown(button('Seating'), { key: 'ArrowRight' });
    expect(heading()).toBe('Rooms');
    fireEvent.click(button('Rooms'), { detail: 0 });
    expect(flyout()).toBeNull();
  });

  it('walks the tiles with the arrows', () => {
    show();
    fireEvent.click(button('Travel'), { detail: 0 });
    const portal = within(flyout()!).getByRole('button', { name: 'Add Portal' });
    expect(document.activeElement).toBe(portal);
    fireEvent.keyDown(portal, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(
      within(flyout()!).getByRole('button', { name: 'Add Bring Focus' }),
    );
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Add Link Card');
  });

  it('hands the focus back to the category on Escape', () => {
    show();
    fireEvent.click(button('Seating'), { detail: 0 });
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(flyout()).toBeNull();
    expect(document.activeElement).toBe(button('Seating'));
  });
});
