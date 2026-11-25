// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '../../lib/sidebar-width';
import { CONTENTS_SIDEBAR_WIDTH_KEY } from '../../lib/contents-sidebar';
import { resetSidebarWidthStores, useSidebarWidth } from '../../hooks/ui/useSidebarWidth';
import { useContentsSidebarWidth } from '../../hooks/ui/useContentsSidebarWidth';
import { SidebarResizeHandle } from './SidebarResizeHandle';

// liveworkspace/docs/specs/011-workbench/sidebar-width.md "Resizing": the handle, and the store every reader shares.
const KEY = 'test:resize';

// A window `width` px wide, as the step media queries read it; `coarse` for a touch-only device.
function windowOf(width: number, coarse = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const min = /min-width: (\d+)px/.exec(query);
      const matches = min ? width >= Number(min[1]) : query === '(hover: none)' ? coarse : false;
      return {
        matches,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
    }),
  );
}

// The handle wired to the store under KEY, as a sidebar wires it, with its width shown beside it.
function Sidebar({ scale = 1 }: { scale?: number }) {
  const sized = useSidebarWidth(KEY, 236);
  return (
    <div>
      <output data-testid="width">{sized.width}</output>
      <output data-testid="settled">{`${sized.settledWidth} ${sized.dragging ? 'dragging' : 'still'}`}</output>
      <SidebarResizeHandle
        label="Resize Contents"
        width={sized.width}
        scale={scale}
        onResize={sized.set}
        onCommit={sized.commit}
        onReset={sized.reset}
        onCancel={sized.cancel}
      />
    </div>
  );
}

const width = () => Number(screen.getByTestId('width').textContent);
const settled = () => screen.getByTestId('settled').textContent;
const handle = () => screen.getByRole('separator', { name: 'Resize Contents' });
const frame = () =>
  act(() => {
    vi.advanceTimersToNextFrame();
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
  windowOf(1280);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  resetSidebarWidthStores();
  document.documentElement.style.cursor = '';
});

describe('the default', () => {
  it('is the base up to 1,439 px and steps up on wider windows', () => {
    const at = (w: number) => {
      windowOf(w);
      const { result, unmount } = renderHook(() => useSidebarWidth(KEY, 236));
      const out = result.current.width;
      unmount();
      return out;
    };
    expect(at(1280)).toBe(236);
    expect(at(1440)).toBe(272);
    expect(at(1520)).toBe(296);
    expect(at(1920)).toBe(320);
  });

  it('renders the base on the server, where no width is kept', () => {
    localStorage.setItem(KEY, '400');
    expect(renderToString(<Sidebar />)).toContain('>236<');
  });

  it("is Contents' own through useContentsSidebarWidth", () => {
    localStorage.setItem(CONTENTS_SIDEBAR_WIDTH_KEY, '300');
    const { result } = renderHook(() => useContentsSidebarWidth());
    expect(result.current.width).toBe(300);
    expect(result.current.custom).toBe(300);
    expect(result.current.defaultWidth).toBe(236);
  });
});

describe('SidebarResizeHandle', () => {
  it('is a focusable vertical separator with its value and bounds', () => {
    render(<Sidebar />);
    const sep = handle();
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
    expect(sep.tabIndex).toBe(0);
    expect(sep.getAttribute('aria-valuenow')).toBe('236');
    expect(sep.getAttribute('aria-valuemin')).toBe(String(SIDEBAR_MIN_WIDTH));
    expect(sep.getAttribute('aria-valuemax')).toBe(String(SIDEBAR_MAX_WIDTH));
    expect(sep.getAttribute('aria-valuetext')).toBe('236 pixels');
    expect(sep.className).toContain('cursor-col-resize');
  });

  it('drags the width live, once a frame, at the UI scale, and keeps it on release', () => {
    const capture = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: capture,
    });
    render(<Sidebar scale={2} />);
    const sep = handle();
    fireEvent.pointerDown(sep, { button: 0, pointerId: 1, clientX: 500, pointerType: 'mouse' });
    expect(document.documentElement.style.cursor).toBe('col-resize');
    expect(sep.hasAttribute('data-dragging')).toBe(true);
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 540 });
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 600 });
    // Another pointer's move is not this drag's.
    fireEvent.pointerMove(sep, { pointerId: 2, clientX: 900 });
    expect(width()).toBe(236);
    frame();
    // 100 screen px at a 2x scale is 50 px of sidebar.
    expect(width()).toBe(286);
    expect(localStorage.getItem(KEY)).toBeNull();
    fireEvent.pointerUp(sep, { pointerId: 1 });
    expect(capture).toHaveBeenCalledWith(1);
    Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
    expect(localStorage.getItem(KEY)).toBe('286');
    expect(document.documentElement.style.cursor).toBe('');
    // A release with no drag under way, and a lost capture after it, change nothing.
    fireEvent.pointerUp(sep, { pointerId: 1 });
    fireEvent(sep, new Event('lostpointercapture', { bubbles: true }));
    expect(width()).toBe(286);
  });

  it('clamps a drag to the bounds', () => {
    render(<Sidebar />);
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 5000 });
    frame();
    expect(width()).toBe(SIDEBAR_MAX_WIDTH);
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: -5000 });
    frame();
    expect(width()).toBe(SIDEBAR_MIN_WIDTH);
  });

  it('puts the width back on Escape or a cancelled pointer', () => {
    localStorage.setItem(KEY, '260');
    render(<Sidebar />);
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 600 });
    frame();
    expect(width()).toBe(360);
    // The width kept stays where the drag began until it ends.
    expect(settled()).toBe('260 dragging');
    // A pressed handle takes no focus, so Escape is heard wherever the focus is; another key there is not the drag's.
    fireEvent.keyDown(document.body, { key: 'Shift' });
    expect(width()).toBe(360);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(width()).toBe(260);
    expect(settled()).toBe('260 still');
    expect(localStorage.getItem(KEY)).toBe('260');
    // The drag is over: a later Escape is nobody's here.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(width()).toBe(260);
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 600 });
    frame();
    fireEvent.pointerCancel(handle(), { pointerId: 1 });
    frame();
    expect(width()).toBe(260);
    // Cancelled before any frame moved it: nothing to put back.
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 500 });
    fireEvent.pointerCancel(handle(), { pointerId: 1 });
    expect(settled()).toBe('260 still');
  });

  it('keeps where it is when the pointer capture is lost mid-drag', () => {
    render(<Sidebar />);
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 520 });
    fireEvent(handle(), new Event('lostpointercapture', { bubbles: true }));
    expect(width()).toBe(256);
    expect(localStorage.getItem(KEY)).toBe('256');
  });

  it('ignores a secondary button and a touch', () => {
    render(<Sidebar />);
    fireEvent.pointerDown(handle(), { button: 2, pointerId: 1, clientX: 500 });
    fireEvent.pointerDown(handle(), {
      button: 0,
      pointerId: 1,
      clientX: 500,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 600 });
    frame();
    expect(width()).toBe(236);
    expect(handle().hasAttribute('data-dragging')).toBe(false);
  });

  it('steps with the arrow keys, jumps to the bounds with Home and End, and resets with Enter', () => {
    render(<Sidebar />);
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(width()).toBe(244);
    fireEvent.keyDown(handle(), { key: 'ArrowRight', shiftKey: true });
    expect(width()).toBe(276);
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    expect(width()).toBe(268);
    expect(localStorage.getItem(KEY)).toBe('268');
    fireEvent.keyDown(handle(), { key: 'End' });
    expect(width()).toBe(SIDEBAR_MAX_WIDTH);
    // Already there: nothing changes.
    fireEvent.keyDown(handle(), { key: 'End' });
    expect(width()).toBe(SIDEBAR_MAX_WIDTH);
    fireEvent.keyDown(handle(), { key: 'Home' });
    expect(width()).toBe(SIDEBAR_MIN_WIDTH);
    // Escape with no drag, and any other key, are not the handle's.
    fireEvent.keyDown(handle(), { key: 'Escape' });
    fireEvent.keyDown(handle(), { key: 'a' });
    expect(width()).toBe(SIDEBAR_MIN_WIDTH);
    fireEvent.keyDown(handle(), { key: 'Enter' });
    expect(width()).toBe(236);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('goes back to the default for the window on a double-click', () => {
    windowOf(1920);
    localStorage.setItem(KEY, '420');
    render(<Sidebar />);
    expect(width()).toBe(420);
    fireEvent.doubleClick(handle());
    expect(width()).toBe(320);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('has no handle on a touch-only device', () => {
    windowOf(1920, true);
    render(<Sidebar />);
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('gives the page its cursor back when it goes mid-drag', () => {
    const { unmount } = render(<Sidebar />);
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 520 });
    unmount();
    expect(document.documentElement.style.cursor).toBe('');
    // Unmounted with no drag under way: nothing to give back.
    render(<Sidebar />).unmount();
  });
});
