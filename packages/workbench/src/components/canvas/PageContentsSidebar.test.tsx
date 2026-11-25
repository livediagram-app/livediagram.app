// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { usePageContents } from '../../hooks/ui/usePageContents';
import { ViewportStoreProvider } from '../../hooks/canvas/useViewportStore';
import { createViewportStore } from '../../lib/viewport-store';
import {
  contentsClusterLeft,
  CONTENTS_SIDEBAR_WIDTH,
  CONTENTS_SIDEBAR_WIDTH_KEY,
} from '../../lib/contents-sidebar';
import { resetSidebarWidthStores } from '../../hooks/ui/useSidebarWidth';
import { UNSCALED } from '../../lib/ui-scale';
import { UiScaleProvider } from '../providers/ui-scale';
import { CONTENTS_FOLLOW_SETTLE_MS, ContentsSidebar } from './PageContentsSidebar';

// docs/specs/007-editor/pages-mode.md "Contents", "Docked": the sidebar's own branches (the shared list in it is
// driven in PageContents.test.tsx): the page in view read against what shows beside it, docking and collapsing with
// no pages, its presses kept from the canvas, and drawn at a raised UI scale.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  resetSidebarWidthStores();
});

// Three 100 px pages side by side, 50 px apart.
const PAGES = [0, 1, 2].map((i) => ({
  id: `p${i + 1}`,
  rect: { x: i * 150, y: 0, width: 100, height: 100 },
}));

function Sidebar({
  pages = PAGES,
  focusPage = () => {},
  onMinimise = () => {},
  stack,
  summary,
}: {
  pages?: typeof PAGES;
  focusPage?: (id: string) => void;
  onMinimise?: () => void;
  stack?: { on: boolean; onToggle: () => void };
  summary?: string | null;
}) {
  const contents = usePageContents({
    view: { pages, focusPage },
    rows: pages.map((p, i) => ({
      id: p.id,
      number: i + 1,
      name: `Page ${i + 1}`,
      line: 'Slide',
      locked: false,
      aspect: 1,
    })),
    dropUnit: () => null,
    lastPage: undefined,
    maxPages: 10,
    openSettings: () => {},
    track: () => {},
    here: pages[0]?.id,
  });
  return (
    <ContentsSidebar
      contents={{ ...contents, thumbs: new Map() }}
      pages={pages}
      focusPage={focusPage}
      footer={(end) => <div data-foot="">{end}</div>}
      top={64}
      onMinimise={onMinimise}
      stack={stack}
      summary={summary}
    />
  );
}

// The canvas the sidebar sits in: jsdom lays nothing out, so its box and the sidebar's are given.
function inCanvas() {
  const canvas = { left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400 };
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    const box = document.createElement('div');
    box.getBoundingClientRect = () => canvas as DOMRect;
    return this.matches('[data-contents-sidebar]') ? box : null;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return (
      this.matches('[data-contents-sidebar]')
        ? { left: 0, right: 236, top: 0, bottom: 400, width: 236, height: 400 }
        : { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }
    ) as DOMRect;
  });
}

describe('ContentsSidebar', () => {
  it('reads the page in view in what shows beside it, and frames it again as it docks', () => {
    inCanvas();
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    const store = createViewportStore(1);
    // The middle of what shows beside the sidebar (x 236 to 600, so 418) is on page 3 (x 300 to 400).
    store.setView({ zoom: 1, offset: { x: 418 - 350, y: 200 - 50 } });
    const focusPage = vi.fn();
    render(
      <ViewportStoreProvider store={store}>
        <Sidebar focusPage={focusPage} />
      </ViewportStoreProvider>,
    );
    expect(screen.getByRole('button', { name: 'Page 3' }).getAttribute('aria-current')).toBe(
      'page',
    );
    frames.shift()!(0);
    expect(focusPage).toHaveBeenCalledWith('p3');
  });

  it('frames the page again as the window settles after docking, then stops listening', () => {
    inCanvas();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const store = createViewportStore(1);
    store.setView({ zoom: 1, offset: { x: 418 - 350, y: 200 - 50 } });
    const focusPage = vi.fn();
    const { unmount } = render(
      <ViewportStoreProvider store={store}>
        <Sidebar focusPage={focusPage} />
      </ViewportStoreProvider>,
    );
    // Back from fullscreen: a resize while it settles drops the pending frame for a fresh one.
    window.dispatchEvent(new Event('resize'));
    expect(cancel).toHaveBeenCalled();
    frames.at(-1)!(0);
    expect(focusPage).toHaveBeenCalledWith('p3');
    // Once settled, a resize no longer reframes.
    vi.advanceTimersByTime(1500);
    const count = frames.length;
    window.dispatchEvent(new Event('resize'));
    expect(frames.length).toBe(count);
    unmount();
    vi.useRealTimers();
  });

  it('stops following the view once it is gone', () => {
    vi.useFakeTimers();
    const store = createViewportStore(1);
    const { unmount } = render(
      <ViewportStoreProvider store={store}>
        <Sidebar />
      </ViewportStoreProvider>,
    );
    act(() => store.setView({ zoom: 1, offset: { x: -300, y: 0 } }));
    unmount();
    // The pending read is dropped with it: nothing runs on an unmounted list.
    expect(() => vi.advanceTimersByTime(CONTENTS_FOLLOW_SETTLE_MS)).not.toThrow();
  });

  it('frames nothing on docking or collapsing a tab with no pages', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    const focusPage = vi.fn();
    const onMinimise = vi.fn();
    render(<Sidebar pages={[]} focusPage={focusPage} onMinimise={onMinimise} />);
    while (frames.length) frames.shift()!(0);
    fireEvent.click(screen.getByRole('button', { name: 'Contents Options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Collapse Contents' }));
    expect(onMinimise).toHaveBeenCalled();
    while (frames.length) frames.shift()!(0);
    expect(focusPage).not.toHaveBeenCalled();
  });

  it('keeps its presses and right-clicks from the canvas beneath it', () => {
    const onCanvasDown = vi.fn();
    const onCanvasMenu = vi.fn();
    render(
      <div onPointerDown={onCanvasDown} onContextMenu={onCanvasMenu}>
        <Sidebar />
      </div>,
    );
    const aside = screen.getByRole('complementary', { name: 'Contents' });
    fireEvent.pointerDown(aside);
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    aside.dispatchEvent(menu);
    expect(onCanvasDown).not.toHaveBeenCalled();
    expect(onCanvasMenu).not.toHaveBeenCalled();
    expect(menu.defaultPrevented).toBe(true);
  });

  it('offers Stack Pages in Contents Options where the editor hands it in', () => {
    const onToggle = vi.fn();
    render(<Sidebar stack={{ on: false, onToggle }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Contents Options' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Stack Pages/ }));
    expect(onToggle).toHaveBeenCalled();
  });

  // Above 100% the sidebar is zoomed, its top written in its own px, and the bottom-right cluster's left bound is
  // its width at that scale plus the gap, so the cluster wraps upward beside it, never under its Add Page.
  it('draws at a raised UI scale, the cluster stopping short of it so it wraps beside it', () => {
    const scale = 1.2;
    render(
      <UiScaleProvider value={{ ...UNSCALED, panels: scale }}>
        <Sidebar />
      </UiScaleProvider>,
    );
    const aside = screen.getByRole('complementary', { name: 'Contents' });
    expect(aside.style.zoom).toBe(String(scale));
    // 64 screen px below the canvas's top, inside a 1.2 zoom.
    expect(Number.parseFloat(aside.style.top) * scale).toBeCloseTo(64);
    expect(aside.style.width).toBe(`${CONTENTS_SIDEBAR_WIDTH}px`);
    const onScreen = CONTENTS_SIDEBAR_WIDTH * scale;
    expect(contentsClusterLeft(true, scale)).toBe(onScreen + 16);
    expect(contentsClusterLeft(true, scale)!).toBeGreaterThan(contentsClusterLeft(true, 1)!);
    expect(contentsClusterLeft(false, scale)).toBeNull();
  });
});

// livedocuments' flashcards.md "The whole talk": the sidebar has no header, so the summary heads its list.
describe('the sidebar summary', () => {
  it('heads the list with the summary, and has no head without one', () => {
    const { unmount } = render(<Sidebar summary="3 cards · about 2 min" />);
    const head = document.querySelector('[data-contents-summary]');
    expect(head?.textContent).toBe('3 cards · about 2 min');
    const list = screen.getAllByRole('list')[0]!;
    expect(head!.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();
    render(<Sidebar />);
    expect(document.querySelector('[data-contents-summary]')).toBeNull();
  });

  // liveworkspace/docs/specs/011-workbench/sidebar-width.md: the width kept in this browser, the film filling it, the
  // handle at its edge, and a cut-off name whole in its tooltip on the row's keyboard focus.
  it('draws at the width kept in this browser, its film filling it, with its resize handle', () => {
    localStorage.setItem(CONTENTS_SIDEBAR_WIDTH_KEY, '320');
    render(<Sidebar />);
    const aside = screen.getByRole('complementary', { name: 'Contents' });
    expect(aside.style.width).toBe('320px');
    expect(aside.style.getPropertyValue('--contents-film-w')).toBe('256px');
    const handle = screen.getByRole('separator', { name: 'Resize Contents' });
    fireEvent.doubleClick(handle);
    expect(aside.style.width).toBe(`${CONTENTS_SIDEBAR_WIDTH}px`);
    expect(contentsClusterLeft(true, 1, 320)).toBe(336);
  });

  it.each([
    ['keyboard focus', () => true, true],
    [
      'an engine without :focus-visible',
      () => {
        throw new Error('unsupported');
      },
      true,
    ],
    ['a press', () => false, false],
  ])('names a cut-off page in a tooltip on %s', (_how, visible, shown) => {
    vi.useFakeTimers();
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ':focus-visible' ? visible() : matches.call(this, selector);
    });
    render(<Sidebar />);
    const name = screen.getAllByText('Page 2')[0]!;
    Object.defineProperty(name, 'clientWidth', { configurable: true, value: 40 });
    Object.defineProperty(name, 'scrollWidth', { configurable: true, value: 120 });
    const row = screen.getByRole('button', { name: 'Page 2' });
    act(() => row.focus());
    expect(screen.queryByRole('tooltip')?.textContent ?? null).toBe(shown ? 'Page 2' : null);
    act(() => row.blur());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
