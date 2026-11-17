// @vitest-environment jsdom
// One popover at a time on the strip (docs/specs/007-editor/toolbar-layout.md "One popover at a time"): a category
// opening, by hover intent, a press or the focus, closes Search, the Library and the Selection Mode menu, and a
// pointer only passing over the bar closes nothing.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';
import { HOVER_OPEN_MS } from './CategoryBar';

// An editor with the Library, so the strip shows its button (an empty one is enough).
vi.mock('@liveworkspace/workbench/components/library/LibraryProvider', () => ({
  useLibrary: () => ({
    state: { status: 'ready', items: [], teams: [], hidden: 0, legacyWritable: false },
    notice: null,
    reload: () => {},
    ensureLoaded: () => {},
    requestSave: () => {},
    place: async () => null,
    rename: async () => false,
    renameFolder: async () => false,
    remove: async () => false,
  }),
}));

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
    <EditorModeProvider
      value={{ mode: 'diagram', setMode: vi.fn(), canSwitch: true, canEdit: true }}
    >
      <ToolbarPalette
        canvasTool="select"
        onSetCanvasTool={vi.fn()}
        canvasEmpty={false}
        pendingDraw={null}
        {...h}
      />
    </EditorModeProvider>,
  );
}

const button = (name: string) => screen.getByRole('button', { name });
const flyout = () => document.querySelector('[data-category-flyout]');
const mouse = { pointerType: 'mouse' };
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
// Rests the mouse on a category long enough to open it.
const restOn = (name: string) => {
  fireEvent.pointerEnter(button(name), mouse);
  wait(HOVER_OPEN_MS + 10);
};

const searchPopover = () => document.querySelector('[data-toolbar-search]');
const libraryPopover = () => document.querySelector('[data-toolbar-library]');
const selectionMenu = () => screen.queryByRole('listbox', { name: 'Selection mode' });

describe('a category opening closes the strip’s other popovers', () => {
  it('closes Search on a rest, and keeps a typed query through a pass', () => {
    show();
    fireEvent.click(button('Search elements'));
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Search elements' });
    fireEvent.change(field, { target: { value: 'pie' } });
    // Crossing the bar on the way somewhere else: no category opens, Search and its query stay.
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS - 30);
    fireEvent.pointerLeave(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    expect(flyout()).toBeNull();
    expect(searchPopover()).not.toBeNull();
    expect(field.value).toBe('pie');
    // Resting on one is the deliberate hover: its flyout replaces Search.
    restOn('Layout');
    expect(flyout()).not.toBeNull();
    expect(searchPopover()).toBeNull();
  });

  it('closes the Library', () => {
    show();
    fireEvent.click(button('Library'));
    expect(libraryPopover()).not.toBeNull();
    restOn('Shapes');
    expect(flyout()).not.toBeNull();
    expect(libraryPopover()).toBeNull();
  });

  it('closes the Selection Mode menu', () => {
    show();
    fireEvent.click(button('Selection mode'));
    expect(selectionMenu()).not.toBeNull();
    restOn('Shapes');
    expect(flyout()).not.toBeNull();
    expect(selectionMenu()).toBeNull();
  });

  it('closes them when a category button takes the focus', () => {
    show();
    fireEvent.click(button('Search elements'));
    expect(searchPopover()).not.toBeNull();
    fireEvent.focus(button('Shapes'));
    expect(searchPopover()).toBeNull();
    fireEvent.click(button('Selection mode'));
    expect(selectionMenu()).not.toBeNull();
    fireEvent.focus(button('Draw'));
    expect(selectionMenu()).toBeNull();
  });
});
