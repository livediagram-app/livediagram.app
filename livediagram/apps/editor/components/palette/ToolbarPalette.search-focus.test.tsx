// @vitest-environment jsdom
// Opening the strip's Search focuses its field at every width (docs/specs/007-editor/toolbar-layout.md "Search"; Work
// Tracker 1224): at 450 px the window read as a phone and the field was left unfocused, so "pie" typed straight after
// opening ran the canvas's shortcuts (P, I, E: the Hand tool among them). Only a touch screen waits for a tap.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';

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

// The window as the media queries read it: its width (the phone layout under 640 px) and whether its primary pointer
// is a finger.
function windowOf({ width, touch }: { width: number; touch: boolean }) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches:
        (query.includes('max-width: 639px') && width < 640) ||
        (query === '(pointer: coarse)' && touch),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    })),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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

const openSearch = () =>
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Search elements' }));
  });
const field = () => screen.getByRole('textbox', { name: 'Search elements' });

// What the keyboard does after opening: each key lands on whatever has the focus, as a browser sends it.
function typeKeys(text: string) {
  for (const key of text) {
    const target = (document.activeElement ?? document.body) as HTMLElement;
    fireEvent.keyDown(target, { key });
    if (target instanceof HTMLInputElement)
      fireEvent.change(target, { target: { value: target.value + key } });
  }
}

describe('opening the strip’s Search focuses its field', () => {
  for (const width of [1280, 450, 390]) {
    it(`at ${width} px, so "pie" typed straight after goes into the query`, () => {
      windowOf({ width, touch: false });
      show();
      openSearch();
      expect(document.activeElement).toBe(field());
      const shortcuts = vi.fn();
      window.addEventListener('keydown', shortcuts);
      typeKeys('pie');
      window.removeEventListener('keydown', shortcuts);
      expect(field()).toHaveProperty('value', 'pie');
      // Every key came from the field, which the canvas's shortcut handler ignores (an editable target).
      for (const [e] of shortcuts.mock.calls) expect((e as KeyboardEvent).target).toBe(field());
    });
  }

  it('waits for a tap on a touch screen, so no on-screen keyboard rises unasked', () => {
    windowOf({ width: 390, touch: true });
    show();
    openSearch();
    expect(field()).toBeTruthy();
    expect(document.activeElement).not.toBe(field());
  });
});
