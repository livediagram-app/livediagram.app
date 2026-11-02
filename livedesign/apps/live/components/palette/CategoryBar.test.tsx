// @vitest-environment jsdom
// The category bar and its flyouts (docs/specs/007-editor/toolbar-layout.md "The category bar"): hover intent, the
// keyboard, a tile's side panel, and the guards that keep a flyout open mid-drag or mid-search.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';
import { HOVER_CLOSE_MS, HOVER_OPEN_MS } from './CategoryBar';
import { MinimalChromeProvider } from '@liveworkspace/workbench/components/providers/minimal-chrome';
import { EditorContext } from '@/app/design/[id]/EditorContext';
import { setCurrentPageKind } from '@/lib/current-page-kind';
import { defaultFill, FILL_CHOICE_KEY, resetFillColour } from './fill-tool-colour';

// A phone's strip, for the Fill tool's tap (its panel, since a phone cannot rest on a tile).
const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
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

function show({ minimal = false }: { minimal?: boolean } = {}) {
  const h = Object.fromEntries(
    PALETTE_ADD_HANDLER_KEYS.map((k) => [k, vi.fn()]),
  ) as unknown as PaletteAddHandlers;
  render(
    <MinimalChromeProvider value={minimal}>
      <EditorModeProvider value={{ mode: 'pages', canEdit: true }}>
        <ToolbarPalette
          canvasTool="select"
          onSetCanvasTool={vi.fn()}
          canvasEmpty={false}
          pendingDraw={null}
          {...h}
        />
      </EditorModeProvider>
    </MinimalChromeProvider>,
  );
  return h;
}

const button = (name: string) => screen.getByRole('button', { name });
const flyout = () => document.querySelector<HTMLElement>('[data-category-flyout]');
const side = () => document.querySelector<HTMLElement>('[data-category-flyout-side]');
const heading = () => flyout()?.querySelector('h3')?.textContent;
const mouse = { pointerType: 'mouse' };
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('hover intent', () => {
  it('opens a category the pointer rests on, not one it sweeps across', () => {
    show();
    fireEvent.pointerEnter(button('Shapes'), mouse);
    fireEvent.pointerLeave(button('Shapes'), mouse);
    fireEvent.pointerEnter(button('Components'), mouse);
    wait(HOVER_OPEN_MS - 10);
    expect(flyout()).toBeNull();
    wait(20);
    expect(heading()).toBe('Components');
  });

  it('moves an open flyout to the next category at once, and ignores a touch', () => {
    show();
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.pointerEnter(button('Concepts'), mouse);
    expect(heading()).toBe('Concepts');
    fireEvent.pointerEnter(button('Components'), { pointerType: 'touch' });
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
    fireEvent.pointerEnter(button('Components'), mouse);
    expect(heading()).toBe('Components');
    fireEvent.pointerLeave(button('Components'), mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(heading()).toBe('Components');
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
    fireEvent.pointerDown(button('Components'), { pointerType: 'touch' });
    fireEvent.click(button('Components'), { detail: 1 });
    expect(heading()).toBe('Components');
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
    const field = within(flyout()!).getByRole('textbox') as HTMLInputElement;
    field.focus();
    fireEvent.change(field, { target: { value: 'star' } });
    fireEvent.pointerLeave(flyout()!.firstElementChild!, mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(flyout()).not.toBeNull();
  });
});

describe('minimal chrome (docs/specs/007-editor/power-user-mode.md)', () => {
  it('shows a picture tile’s icon alone, keeping its name, and a card its name', () => {
    show({ minimal: true });
    fireEvent.click(button('Shapes'), { detail: 1 });
    const square = within(flyout()!).getByRole('button', { name: 'Add Square' });
    expect(square.textContent).not.toContain('Square');
    fireEvent.click(button('Components'), { detail: 1 });
    expect(within(flyout()!).getAllByRole('button', { name: /Hero/ })[0]!.textContent).toContain(
      'Hero',
    );
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
    expect(document.activeElement).toBe(button('Data'));
    fireEvent.keyDown(button('Data'), { key: 'ArrowDown' });
    expect(heading()).toBe('Data');
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

describe('a tile’s side panel', () => {
  it('opens Card’s presets beside the flyout, keeping the flyout open', () => {
    const h = show();
    fireEvent.click(button('Components'), { detail: 1 });
    const card = within(flyout()!).getByRole('button', { name: 'Add Card' });
    expect(card.getAttribute('draggable')).toBeNull();
    fireEvent.click(card);
    expect(side()).not.toBeNull();
    expect(flyout()).not.toBeNull();
    expect(card.getAttribute('aria-expanded')).toBe('true');
    expect(side()!.querySelector('h3')?.textContent).toBe('Card');
    // A preset places as any tile does, and closes both.
    fireEvent.click(within(side()!).getAllByRole('button')[0]!);
    // The first preset, Service, is the card's own default.
    expect(h.onAddShape).toHaveBeenCalledWith('card', expect.anything());
    expect(flyout()).toBeNull();
    expect(side()).toBeNull();
  });

  it('opens on a rest, closes on a rest on another tile, and a second press closes it', () => {
    show();
    fireEvent.click(button('Components'), { detail: 1 });
    const card = within(flyout()!).getByRole('button', { name: 'Add Card' });
    fireEvent.pointerEnter(card);
    wait(200);
    expect(side()).not.toBeNull();
    fireEvent.pointerEnter(within(flyout()!).getByRole('button', { name: 'Add Hero' }));
    wait(HOVER_CLOSE_MS);
    expect(side()).toBeNull();
    fireEvent.click(card);
    expect(side()).not.toBeNull();
    fireEvent.click(card);
    expect(side()).toBeNull();
  });

  it('drops the side panel when the flyout moves to another category', () => {
    show();
    fireEvent.click(button('Components'), { detail: 1 });
    fireEvent.click(within(flyout()!).getByRole('button', { name: 'Add Badge' }));
    expect(side()).not.toBeNull();
    fireEvent.pointerEnter(button('Shapes'), mouse);
    expect(side()).toBeNull();
  });
});

// docs/specs/023-draw-mode/drawing-tools.md "The Fill tool": a logo page's Draw, after the markers.
describe('the Fill tool on a logo page', () => {
  afterEach(() => {
    setCurrentPageKind(null);
    localStorage.clear();
    resetFillColour();
    mobile.value = false;
  });

  function showLogo() {
    setCurrentPageKind('logo');
    const ctx = {
      beginDraw: vi.fn(),
      markerPens: { prefs: { pens: [{ id: 'main', colour: null, width: 4 }] }, updatePen: vi.fn() },
    };
    const h = Object.fromEntries(
      PALETTE_ADD_HANDLER_KEYS.map((k) => [k, vi.fn()]),
    ) as unknown as PaletteAddHandlers;
    render(
      <EditorContext.Provider value={ctx as never}>
        <EditorModeProvider value={{ mode: 'pages', canEdit: true }}>
          <ToolbarPalette
            canvasTool="select"
            onSetCanvasTool={vi.fn()}
            canvasEmpty={false}
            pendingDraw={null}
            {...h}
          />
        </EditorModeProvider>
      </EditorContext.Provider>,
    );
    fireEvent.click(button('Draw'), { detail: 1 });
    return { ctx, fill: within(flyout()!).getByRole('button', { name: 'Fill' }) };
  }

  it('sits in its own Fill group after the markers, and a press picks it up', () => {
    const { ctx, fill } = showLogo();
    const titles = [...flyout()!.querySelectorAll('h4')].map((h) => h.textContent);
    expect(titles.slice(-2)).toEqual(['Markers', 'Fill']);
    expect(fill.getAttribute('draggable')).toBeNull();
    fireEvent.click(fill);
    expect(ctx.beginDraw).toHaveBeenCalledWith({ type: 'fill', fill: defaultFill('light') });
    expect(side()).toBeNull();
  });

  it('holds its colour in the panel a rest opens, whose pick picks it up in that colour', () => {
    const { ctx, fill } = showLogo();
    fireEvent.pointerEnter(fill);
    wait(200);
    expect(side()!.querySelector('h3')?.textContent).toBe('Fill');
    fireEvent.click(within(side()!).getByRole('button', { name: 'No fill' }));
    expect(localStorage.getItem(FILL_CHOICE_KEY)).toBe('transparent');
    expect(ctx.beginDraw).toHaveBeenCalledWith({ type: 'fill', fill: 'transparent' });
  });

  it('on a phone, a tap opens its colour, and a colour picks it up', () => {
    mobile.value = true;
    const { ctx, fill } = showLogo();
    fireEvent.click(fill);
    expect(ctx.beginDraw).not.toHaveBeenCalled();
    expect(fill.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(side()!).getByRole('button', { name: 'No fill' }));
    expect(ctx.beginDraw).toHaveBeenCalledWith({ type: 'fill', fill: 'transparent' });
  });
});
