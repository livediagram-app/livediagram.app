// @vitest-environment jsdom
// The category bar and its flyouts (docs/specs/007-editor/toolbar-layout.md "The category bar"): hover intent, the
// keyboard, a tile's side panel, and the guards that keep a flyout open mid-drag or mid-search.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';
import { HOVER_CLOSE_MS, HOVER_OPEN_MS } from './CategoryBar';

// The Library, off unless a test turns it on: an editor with one shows its button beside Search.
const libraryOn = vi.hoisted(() => ({ value: false }));
vi.mock('@liveworkspace/workbench/components/library/LibraryProvider', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@liveworkspace/workbench/components/library/LibraryProvider')
    >();
  const library = {
    state: { status: 'ready' as const, items: [], teams: [], hidden: 0, legacyWritable: false },
    notice: null,
    reload: () => {},
    ensureLoaded: () => {},
    requestSave: () => {},
    place: async () => null,
    rename: async () => false,
    renameFolder: async () => false,
    remove: async () => false,
  };
  return { ...actual, useLibrary: () => (libraryOn.value ? library : actual.useLibrary()) };
});

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
  render(<ToolbarPalette pendingDraw={null} {...h} />);
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

describe('the flyout a category opens', () => {
  it('is the dialog its button says it opens, named for the category', () => {
    show();
    expect(button('Shapes').getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(button('Shapes'));
    expect(screen.getByRole('dialog', { name: 'Shapes' })).toBe(flyout());
  });
});

describe('hover intent', () => {
  it('opens a category the pointer rests on, not one it sweeps across', () => {
    show();
    fireEvent.pointerEnter(button('Shapes'), mouse);
    fireEvent.pointerLeave(button('Shapes'), mouse);
    fireEvent.pointerEnter(button('Concepts'), mouse);
    wait(HOVER_OPEN_MS - 10);
    expect(flyout()).toBeNull();
    wait(20);
    expect(heading()).toBe('Concepts');
  });

  it('moves an open flyout to the next category at once, and ignores a touch', () => {
    show();
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.pointerEnter(button('Concepts'), mouse);
    expect(heading()).toBe('Concepts');
    fireEvent.pointerEnter(button('Concepts'), { pointerType: 'touch' });
    expect(heading()).toBe('Concepts');
  });

  it('closes once the pointer has left both the bar and the flyout, after a grace', () => {
    show();
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.pointerLeave(button('Shapes'), mouse);
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
    fireEvent.click(button('Shapes'), { detail: 1 });
    fireEvent.pointerLeave(button('Shapes'), mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(heading()).toBe('Shapes');
    // Pointing at another category still moves it there, and it stays pinned.
    fireEvent.pointerEnter(button('Concepts'), mouse);
    expect(heading()).toBe('Concepts');
    fireEvent.pointerLeave(button('Concepts'), mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(heading()).toBe('Concepts');
    fireEvent.pointerDown(document.body);
    expect(flyout()).toBeNull();
  });

  it('pins a category the hover opened once it is clicked', () => {
    show();
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.click(button('Shapes'), { detail: 1 });
    fireEvent.pointerLeave(button('Shapes'), mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(heading()).toBe('Shapes');
  });

  it('keeps a click on a category the hover opened from closing it', () => {
    show();
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.click(button('Shapes'), { detail: 1 });
    expect(heading()).toBe('Shapes');
  });

  it('closes the open category on a second tap', () => {
    show();
    fireEvent.pointerDown(button('Shapes'), { pointerType: 'touch' });
    fireEvent.click(button('Shapes'), { detail: 1 });
    expect(heading()).toBe('Shapes');
    fireEvent.pointerDown(button('Shapes'), { pointerType: 'touch' });
    fireEvent.click(button('Shapes'), { detail: 1 });
    expect(flyout()).toBeNull();
    // And a third opens it again.
    fireEvent.pointerDown(button('Shapes'), { pointerType: 'touch' });
    fireEvent.click(button('Shapes'), { detail: 1 });
    expect(heading()).toBe('Shapes');
  });

  it('moves a tap on another category there rather than closing', () => {
    show();
    fireEvent.pointerDown(button('Shapes'), { pointerType: 'touch' });
    fireEvent.click(button('Shapes'), { detail: 1 });
    fireEvent.pointerDown(button('Concepts'), { pointerType: 'touch' });
    fireEvent.click(button('Concepts'), { detail: 1 });
    expect(heading()).toBe('Concepts');
  });

  it('keeps a second mouse click on the open category from closing it', () => {
    show();
    fireEvent.pointerDown(button('Shapes'), mouse);
    fireEvent.click(button('Shapes'), { detail: 1 });
    fireEvent.pointerDown(button('Shapes'), mouse);
    fireEvent.click(button('Shapes'), { detail: 1 });
    expect(heading()).toBe('Shapes');
  });

  it('stays open while a tile is dragged out, and closes on the drop', () => {
    show();
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    const body = flyout()!.firstElementChild!;
    fireEvent.dragStart(within(flyout()!).getByRole('button', { name: 'Add Square' }), {
      dataTransfer: { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '' },
    });
    fireEvent.pointerLeave(body, mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(flyout()).not.toBeNull();
    fireEvent.dragEnd(within(flyout()!).getByRole('button', { name: 'Add Square' }));
    expect(flyout()).toBeNull();
  });

  it('stays open while its search holds a query', () => {
    show();
    fireEvent.pointerEnter(button('Icons'), mouse);
    wait(HOVER_OPEN_MS);
    const field = within(flyout()!).getByRole<HTMLInputElement>('textbox');
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
    button('Shapes').focus();
    fireEvent.keyDown(button('Shapes'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Write'));
    fireEvent.keyDown(button('Write'), { key: 'ArrowLeft' });
    fireEvent.keyDown(button('Shapes'), { key: 'ArrowLeft' });
    // Wraps round to the last.
    expect(document.activeElement).toBe(button('Icons'));
    fireEvent.keyDown(button('Icons'), { key: 'ArrowLeft' });
    fireEvent.keyDown(button('Concepts'), { key: 'ArrowDown' });
    expect(heading()).toBe('Concepts');
    expect(document.activeElement?.hasAttribute('data-flyout-item')).toBe(true);
  });

  it('moves an open flyout along with the focus, and toggles from Enter', () => {
    show();
    fireEvent.click(button('Shapes'), { detail: 0 });
    expect(heading()).toBe('Shapes');
    fireEvent.keyDown(button('Shapes'), { key: 'ArrowRight' });
    expect(heading()).toBe('Write');
    fireEvent.click(button('Write'), { detail: 0 });
    expect(flyout()).toBeNull();
  });

  it('walks the tiles with the arrows', () => {
    show();
    fireEvent.click(button('Shapes'), { detail: 0 });
    const square = within(flyout()!).getByRole('button', { name: 'Add Square' });
    expect(document.activeElement).toBe(square);
    fireEvent.keyDown(square, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(
      within(flyout()!).getByRole('button', { name: 'Add Circle' }),
    );
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Add Speech Bubble');
  });

  it('hands the focus back to the category on Escape', () => {
    show();
    fireEvent.click(button('Shapes'), { detail: 0 });
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(flyout()).toBeNull();
    expect(document.activeElement).toBe(button('Shapes'));
  });
});
