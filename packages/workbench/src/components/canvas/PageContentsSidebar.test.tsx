// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { usePageContents } from '../../hooks/ui/usePageContents';
import { ViewportStoreProvider } from '../../hooks/canvas/useViewportStore';
import { createViewportStore } from '../../lib/viewport-store';
import { contentsClusterLeft, CONTENTS_SIDEBAR_WIDTH } from '../../lib/contents-sidebar';
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
}: {
  pages?: typeof PAGES;
  focusPage?: (id: string) => void;
  onMinimise?: () => void;
  stack?: { on: boolean; onToggle: () => void };
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
