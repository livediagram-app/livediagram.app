// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { configureWorkbench, resetWorkbenchForTests } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { MORE_CATEGORIES_LABEL } from './CategoryBarMore';
import {
  CategoryBarButtons,
  HOVER_CLOSE_MS,
  HOVER_OPEN_MS,
  flyoutWidthClass,
  flyoutWidthPx,
  useCategoryBar,
  type BarCategoryBase,
} from './CategoryBar';

// The category bar every editor's strip draws (each editor's docs/specs/007-editor/toolbar-layout.md "The category
// bar"): hover intent, presses, the keyboard, More, and a tile dragged out of the flyout. The editors' own tests
// drive it with their real flyouts; these hold its every branch.

type Cat = BarCategoryBase & { width?: number };

const CATS: Cat[] = [
  { id: 'shapes', label: 'Shapes', icon: <svg />, group: 0 },
  { id: 'lines', label: 'Lines', icon: <svg />, group: 0 },
  { id: 'media', label: 'Media', icon: <svg />, group: 1 },
];

const track = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  configureWorkbench(testBindings({ track }));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  track.mockReset();
  resetWorkbenchForTests();
});

function Bar({
  shown = null,
  onOpen,
  labels = true,
  tourAnchors,
  scrollable,
  ariaLabel,
}: {
  shown?: number | null;
  onOpen?: () => void;
  labels?: boolean;
  tourAnchors?: boolean;
  scrollable?: boolean;
  ariaLabel?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const bar = useCategoryBar<Cat>(root, { onOpen, widthOf: (c) => c.width ?? 416 });
  const [query, setQuery] = useState('');
  return (
    <div ref={root}>
      <CategoryBarButtons
        bar={bar}
        categories={CATS}
        labels={labels}
        divider={<hr data-testid="divider" />}
        shown={shown}
        trailing={<span>Library</span>}
        {...(tourAnchors === undefined ? {} : { tourAnchors })}
        {...(scrollable === undefined ? {} : { scrollable })}
        {...(ariaLabel === undefined ? {} : { ariaLabel })}
      />
      <button
        type="button"
        onClick={() => bar.open({ id: 'ghost', label: 'Ghost', icon: null }, false)}
      >
        Open Ghost
      </button>
      {bar.openId ? (
        <div
          data-category-flyout=""
          data-see-through={bar.dragActive ? '' : undefined}
          data-keyboard={bar.viaKeyboard ? '' : undefined}
          onPointerEnter={bar.hoverFlyout}
          onPointerLeave={bar.leave}
        >
          <h3>{bar.openId}</h3>
          <input aria-label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="button" onClick={bar.dragStarted}>
            Drag Out
          </button>
          <button type="button" onClick={bar.dragEnded}>
            Drop
          </button>
          <button type="button" onClick={() => bar.close(true)}>
            Escape
          </button>
        </div>
      ) : null}
    </div>
  );
}

const button = (name: string) => screen.getByRole('button', { name });
const flyout = () => document.querySelector<HTMLElement>('[data-category-flyout]');
const openId = () => flyout()?.querySelector('h3')?.textContent ?? null;
const mouse = { pointerType: 'mouse' };
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('hover intent', () => {
  it('opens a category the pointer rests on, not one it sweeps across, and says so once', () => {
    render(<Bar />);
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS - 10);
    fireEvent.pointerLeave(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    expect(flyout()).toBeNull();
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    expect(openId()).toBe('shapes');
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'ToolbarCategory');
    expect(button('Shapes').getAttribute('aria-expanded')).toBe('true');
    // Coming back onto the open one keeps it, and sends nothing more.
    fireEvent.pointerEnter(button('Shapes'), mouse);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('moves at once to another category while one is open', () => {
    render(<Bar />);
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.pointerEnter(button('Lines'), mouse);
    expect(openId()).toBe('lines');
  });

  it('closes after a grace once the pointer leaves, unless it comes onto the flyout', () => {
    render(<Bar />);
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.pointerLeave(button('Shapes'), mouse);
    fireEvent.pointerEnter(flyout()!, mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(openId()).toBe('shapes');
    fireEvent.pointerLeave(flyout()!, mouse);
    wait(HOVER_CLOSE_MS);
    expect(flyout()).toBeNull();
  });

  it('ignores a touch or pen coming and going', () => {
    render(<Bar />);
    fireEvent.pointerEnter(button('Shapes'), { pointerType: 'touch' });
    wait(HOVER_OPEN_MS);
    expect(flyout()).toBeNull();
    fireEvent.click(button('Shapes'));
    fireEvent.pointerLeave(button('Shapes'), { pointerType: 'pen' });
    wait(HOVER_CLOSE_MS);
    expect(openId()).toBe('shapes');
  });

  it('stays while a search typed into the flyout holds a query', () => {
    render(<Bar />);
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    const search = screen.getByRole('textbox', { name: 'Search' });
    search.focus();
    fireEvent.change(search, { target: { value: '  ' } });
    fireEvent.pointerLeave(flyout()!, mouse);
    wait(HOVER_CLOSE_MS);
    // Only spaces: nothing typed worth keeping.
    expect(flyout()).toBeNull();
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    const again = screen.getByRole('textbox', { name: 'Search' });
    again.focus();
    fireEvent.change(again, { target: { value: 'cloud' } });
    fireEvent.pointerLeave(flyout()!, mouse);
    wait(HOVER_CLOSE_MS);
    expect(openId()).toBe('shapes');
  });

  it('stays open, see-through, while a tile is dragged out, and closes at the drop', () => {
    render(<Bar />);
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Drag Out' }));
    expect(flyout()!.hasAttribute('data-see-through')).toBe(true);
    fireEvent.pointerLeave(flyout()!, mouse);
    wait(HOVER_CLOSE_MS);
    expect(openId()).toBe('shapes');
    fireEvent.click(screen.getByRole('button', { name: 'Drop' }));
    expect(flyout()).toBeNull();
  });

  it('drops a pending hover when the bar unmounts', () => {
    const { unmount } = render(<Bar />);
    fireEvent.pointerEnter(button('Shapes'), mouse);
    unmount();
    expect(() => wait(HOVER_OPEN_MS)).not.toThrow();
  });
});

describe('presses', () => {
  it('a mouse click pins what the hover opened; leaving no longer closes it', () => {
    render(<Bar />);
    fireEvent.pointerEnter(button('Shapes'), mouse);
    wait(HOVER_OPEN_MS);
    fireEvent.pointerDown(button('Shapes'), mouse);
    fireEvent.click(button('Shapes'), { detail: 1 });
    fireEvent.pointerLeave(button('Shapes'), mouse);
    wait(HOVER_CLOSE_MS * 2);
    expect(openId()).toBe('shapes');
  });

  it('a tap or the keyboard toggles the open category shut', () => {
    render(<Bar />);
    fireEvent.pointerDown(button('Shapes'), { pointerType: 'touch' });
    fireEvent.click(button('Shapes'), { detail: 1 });
    expect(openId()).toBe('shapes');
    fireEvent.pointerDown(button('Shapes'), { pointerType: 'touch' });
    fireEvent.click(button('Shapes'), { detail: 1 });
    expect(flyout()).toBeNull();
    fireEvent.click(button('Lines'), { detail: 0 });
    expect(flyout()!.hasAttribute('data-keyboard')).toBe(true);
    fireEvent.click(button('Lines'), { detail: 0 });
    expect(flyout()).toBeNull();
    fireEvent.pointerDown(button('Media'), { pointerType: 'pen' });
    fireEvent.click(button('Media'), { detail: 1 });
    fireEvent.pointerDown(button('Media'), { pointerType: 'pen' });
    fireEvent.click(button('Media'), { detail: 1 });
    expect(flyout()).toBeNull();
  });

  it('closes the strip’s other popovers as a category opens or a button takes the focus', () => {
    const onOpen = vi.fn();
    render(<Bar onOpen={onOpen} />);
    act(() => button('Lines').focus());
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(button('Lines'));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('hands the focus back to the open category’s button on Escape', () => {
    render(<Bar />);
    fireEvent.click(button('Media'));
    fireEvent.click(screen.getByRole('button', { name: 'Escape' }));
    expect(flyout()).toBeNull();
    expect(document.activeElement).toBe(button('Media'));
  });
});

describe('the keyboard', () => {
  it('walks the bar with the arrows, wrapping, and Down opens the focused category', () => {
    render(<Bar />);
    act(() => button('Shapes').focus());
    fireEvent.keyDown(button('Shapes'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(button('Media'));
    fireEvent.keyDown(button('Media'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Shapes'));
    fireEvent.keyDown(button('Shapes'), { key: 'Tab' });
    expect(flyout()).toBeNull();
    fireEvent.keyDown(button('Shapes'), { key: 'ArrowDown' });
    expect(openId()).toBe('shapes');
    // An open flyout follows the focus.
    fireEvent.keyDown(button('Shapes'), { key: 'ArrowRight' });
    expect(openId()).toBe('lines');
  });
});

describe('More', () => {
  it('folds the categories past `shown` behind More, which opens one under itself', () => {
    render(<Bar shown={1} />);
    expect(screen.queryByRole('button', { name: 'Lines' })).toBeNull();
    const more = button(MORE_CATEGORIES_LABEL);
    // Right from the last shown category lands on More, and More hands its arrows back to the bar.
    act(() => button('Shapes').focus());
    fireEvent.keyDown(button('Shapes'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(more);
    fireEvent.keyDown(more, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Shapes'));
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Media' }));
    expect(openId()).toBe('media');
    expect(more.querySelector('.opacity-100')).toBeTruthy();
    // Escape hands the focus back to More, where it opened.
    fireEvent.click(screen.getByRole('button', { name: 'Escape' }));
    expect(document.activeElement).toBe(more);
  });

  it('opening More’s list closes an open flyout', () => {
    render(<Bar shown={2} />);
    fireEvent.click(button('Shapes'));
    fireEvent.click(button(MORE_CATEGORIES_LABEL));
    expect(flyout()).toBeNull();
  });

  it('opens nothing with nowhere to hang from: neither its button nor More on the bar', () => {
    render(<Bar />);
    fireEvent.click(button('Open Ghost'));
    expect(flyout()).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });
});

describe('the buttons', () => {
  it('draws a divider between bands, names, tour anchors and the trailing part', () => {
    render(<Bar />);
    expect(screen.getAllByTestId('divider')).toHaveLength(1);
    expect(screen.getByText('Library')).toBeTruthy();
    expect(button('Shapes').getAttribute('data-tour-id')).toBe('palette-category');
    expect(button('Lines').getAttribute('data-tour-id')).toBe('bar-lines');
    expect(screen.getByRole('toolbar', { name: 'Palette categories' })).toBeTruthy();
    expect(screen.getByRole('toolbar').hasAttribute('data-strip-rail')).toBe(false);
  });

  it('can leave out the tour anchors and the names, scroll on a phone, and take its own name', () => {
    render(<Bar tourAnchors={false} labels={false} scrollable ariaLabel="Actions" />);
    expect(button('Shapes').hasAttribute('data-tour-id')).toBe(false);
    expect(screen.queryByText('Shapes')).toBeNull();
    const toolbar = screen.getByRole('toolbar', { name: 'Actions' });
    expect(toolbar.hasAttribute('data-strip-rail')).toBe(true);
  });
});

describe('flyout widths', () => {
  it('sizes a catalogue, a grid and cards in one column or two', () => {
    const columns = (n: number) => (n <= 2 ? 1 : 2);
    expect(flyoutWidthPx(null, false, columns)).toBe(600);
    expect(flyoutWidthPx(8, false, columns)).toBe(416);
    expect(flyoutWidthPx(2, true, columns)).toBe(304);
    expect(flyoutWidthPx(6, true, columns)).toBe(576);
  });

  it('names each width’s class, the grid’s for any other', () => {
    expect(flyoutWidthClass(600)).toBe('w-[37.5rem]');
    expect(flyoutWidthClass(416)).toBe('w-[26rem]');
    expect(flyoutWidthClass(576)).toBe('w-[36rem]');
    expect(flyoutWidthClass(304)).toBe('w-[19rem]');
    expect(flyoutWidthClass(512)).toBe('w-[26rem]');
  });
});
