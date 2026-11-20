// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TAB_REVEAL_PAD } from './tab-strip-scroll';
import { TabStrip, type TabRun } from './TabStrip';

// The strip's scroll buttons (docs/specs/007-editor/editor-app.md "Tab bar"): one over each edge with tabs beyond it,
// paging the row on a click or a tab dragged over it.

type T = { id: string; name: string };
const RUNS: TabRun<T>[] = Array.from({ length: 12 }, (_, n) => ({
  kind: 'loose',
  tab: { id: `t${n}`, name: `Tab ${n}` },
}));

let scrollTo: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function strip() {
  render(
    <TabStrip
      runs={RUNS}
      activeId="t0"
      readOnly={false}
      renderTab={(tab) => (
        <button
          key={tab.id}
          type="button"
          data-tab=""
          data-active={tab.id === 't0' ? '' : undefined}
        >
          {tab.name}
        </button>
      )}
      onReorder={vi.fn()}
      onRenameFolder={vi.fn()}
      renderRenameField={() => null}
    />,
  );
  return screen.getByRole('toolbar', { name: 'Tabs' }).parentElement as HTMLElement;
}

// A 600px strip at x 0 holding 12 tabs of 100px, 104 apart (1248px of row).
function overflow(scroller: HTMLElement, scrollLeft: number) {
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 1248 });
  scroller.scrollLeft = scrollLeft;
  vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 600,
    width: 600,
  } as DOMRect);
  scroller.querySelectorAll<HTMLElement>('[data-tab]').forEach((el, n) => {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: n * 104 - scrollLeft,
      right: n * 104 + 100 - scrollLeft,
    } as DOMRect);
  });
  act(() => {
    fireEvent.scroll(scroller);
    vi.advanceTimersByTime(20);
  });
}

const button = (direction: 'left' | 'right') =>
  document.querySelector(`[data-tab-scroll="${direction}"]`) as HTMLButtonElement;

describe('TabStrip scroll buttons', () => {
  it('shows neither while every tab fits, out of the tab order and hidden from assistive technology', () => {
    strip();
    expect(screen.queryByRole('button', { name: 'Scroll Tabs Left' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll Tabs Right' })).toBeNull();
    for (const d of ['left', 'right'] as const) {
      expect(button(d).dataset.shown).toBe('false');
      expect(button(d).tabIndex).toBe(-1);
    }
  });

  it('shows the right button at the start of a long row, and the left once it has scrolled', () => {
    const scroller = strip();
    overflow(scroller, 0);
    expect(screen.getByRole('button', { name: 'Scroll Tabs Right' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Scroll Tabs Left' })).toBeNull();
    overflow(scroller, 300);
    expect(screen.getByRole('button', { name: 'Scroll Tabs Left' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Scroll Tabs Right' })).toBeTruthy();
    overflow(scroller, 648);
    expect(screen.queryByRole('button', { name: 'Scroll Tabs Right' })).toBeNull();
  });

  it('pages the row on a click, stopping on the start of the tab the far edge would cut', () => {
    const scroller = strip();
    overflow(scroller, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Scroll Tabs Right' }));
    // A page of 520 cuts tab 5 (520 to 620) at 560, so it stops a pad before tab 5.
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 520 - TAB_REVEAL_PAD }));
    overflow(scroller, 648);
    scrollTo.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Scroll Tabs Left' }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect((scrollTo.mock.calls[0]![0] as { left: number }).left).toBeLessThan(648);
  });

  it('pages the row under a tab dragged over a button, once per beat', () => {
    const scroller = strip();
    overflow(scroller, 0);
    const right = button('right');
    fireEvent.dragOver(right);
    vi.advanceTimersByTime(100);
    fireEvent.dragOver(right);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(400);
    fireEvent.dragOver(right);
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it('leaves the strip where it is when a page would not move it', () => {
    const scroller = strip();
    overflow(scroller, 0);
    fireEvent.click(button('left'));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('stops listening when the strip goes', () => {
    const scroller = strip();
    const off = vi.spyOn(scroller, 'removeEventListener');
    cleanup();
    expect(off).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
