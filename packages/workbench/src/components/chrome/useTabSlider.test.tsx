// @vitest-environment jsdom

// The open tab's sliding card (docs/specs/007-editor/editor-app.md "How a tab looks"): in place on mount, a spring
// slide to each newly opened tab aimed past any folder still easing, an instant follow on layout changes, nothing
// under reduced motion, and each tab's own card back when nothing in the strip is open.

import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { measureSlot, TAB_SLIDE_MS, TAB_SLIDER_FOOT_PX, useTabSlider } from './useTabSlider';

// Layout, as jsdom has none: each element's box comes from its data-x / data-w (the list at 0, 40 tall tabs).
function rectOf(el: Element): DOMRect {
  const h = el as HTMLElement;
  const x = Number(h.dataset.x ?? 0);
  const w = Number(h.dataset.w ?? 0);
  const y = h.matches('[data-tab]') ? 8 : 0;
  const ht = h.matches('[data-tab]') ? 40 : 48;
  return { left: x, right: x + w, top: y, bottom: y + ht, width: w, height: ht, x, y } as DOMRect;
}

let observers: { cb: ResizeObserverCallback; targets: Set<Element> }[];
let reduced: boolean;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  observers = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduced })),
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      targets = new Set<Element>();
      constructor(cb: ResizeObserverCallback) {
        observers.push({ cb, targets: this.targets });
      }
      observe(el: Element) {
        this.targets.add(el);
      }
      unobserve(el: Element) {
        this.targets.delete(el);
      }
      disconnect() {
        this.targets.clear();
      }
    },
  );
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectOf(this);
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Tab = { id: string; x: number; w: number };
function Strip({ tabs, activeId, order }: { tabs: Tab[]; activeId: string; order?: string }) {
  const list = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLDivElement>(null);
  useTabSlider(list, slider, activeId, order ?? tabs.map((t) => t.id).join('|'));
  return (
    <div ref={list} data-testid="list">
      <div ref={slider} data-testid="slider" />
      {tabs.map((t) => (
        <div
          key={t.id}
          data-tab=""
          data-x={t.x}
          data-w={t.w}
          data-active={t.id === activeId ? '' : undefined}
        />
      ))}
    </div>
  );
}

const TABS: Tab[] = [
  { id: 'a', x: 10, w: 80 },
  { id: 'b', x: 92, w: 100 },
];
const slider = (c: HTMLElement) => c.querySelector('[data-testid="slider"]') as HTMLElement;
const list = (c: HTMLElement) => c.querySelector('[data-testid="list"]') as HTMLElement;

describe('useTabSlider', () => {
  it('stands under the open tab on mount, without sliding in', () => {
    const { container } = render(<Strip tabs={TABS} activeId="a" />);
    const s = slider(container);
    expect(s.style.transform).toBe('translate3d(10px, 8px, 0)');
    expect(s.style.width).toBe('80px');
    expect(s.style.height).toBe(`${40 + TAB_SLIDER_FOOT_PX}px`);
    expect(s.style.transition).toBe('none');
    expect(s.style.opacity).toBe('1');
    expect(list(container).hasAttribute('data-tab-slide')).toBe(true);
  });

  it('slides to a newly opened tab, then settles without a transition', () => {
    const { container, rerender } = render(<Strip tabs={TABS} activeId="a" />);
    rerender(<Strip tabs={TABS} activeId="b" />);
    const s = slider(container);
    expect(s.style.transform).toBe('translate3d(92px, 8px, 0)');
    expect(s.style.width).toBe('100px');
    expect(s.style.transition).toContain(`transform ${TAB_SLIDE_MS}ms`);
    // Layout changes during the slide are the slide's own: the card keeps travelling.
    act(() => observers[0]!.cb([], {} as ResizeObserver));
    expect(s.style.transition).toContain('transform');
    act(() => {
      vi.advanceTimersByTime(TAB_SLIDE_MS + 20);
    });
    expect(s.style.transition).toBe('none');
    expect(s.style.transform).toBe('translate3d(92px, 8px, 0)');
  });

  it('turns round mid-slide, settling once from the last switch', () => {
    const { container, rerender } = render(<Strip tabs={TABS} activeId="a" />);
    rerender(<Strip tabs={TABS} activeId="b" />);
    act(() => {
      vi.advanceTimersByTime(TAB_SLIDE_MS / 2);
    });
    rerender(<Strip tabs={TABS} activeId="a" />);
    const s = slider(container);
    expect(s.style.transform).toBe('translate3d(10px, 8px, 0)');
    act(() => {
      vi.advanceTimersByTime(TAB_SLIDE_MS / 2 + 20);
    });
    // The first slide's settle was dropped: still travelling.
    expect(s.style.transition).toContain('transform');
    act(() => {
      vi.advanceTimersByTime(TAB_SLIDE_MS);
    });
    expect(s.style.transition).toBe('none');
  });

  it('jumps, never slides, under reduced motion', () => {
    const { container, rerender } = render(<Strip tabs={TABS} activeId="a" />);
    reduced = true;
    rerender(<Strip tabs={TABS} activeId="b" />);
    expect(slider(container).style.transition).toBe('none');
    expect(slider(container).style.transform).toBe('translate3d(92px, 8px, 0)');
  });

  it('follows its tab at once when the layout moves it, and when the order changes', () => {
    const { container, rerender } = render(<Strip tabs={TABS} activeId="a" />);
    // The open tab grew (a rename): the observer hears it.
    rerender(<Strip tabs={[{ id: 'a', x: 10, w: 120 }, TABS[1]!]} activeId="a" order="a|b" />);
    act(() => observers[0]!.cb([], {} as ResizeObserver));
    expect(slider(container).style.width).toBe('120px');
    expect(slider(container).style.transition).toBe('none');
    // Reordered: same sizes, so only the order key tells.
    rerender(
      <Strip
        tabs={[
          { id: 'b', x: 10, w: 100 },
          { id: 'a', x: 112, w: 80 },
        ]}
        activeId="a"
      />,
    );
    expect(slider(container).style.transform).toBe('translate3d(112px, 8px, 0)');
    expect(slider(container).style.transition).toBe('none');
  });

  it('watches the open tab, and only that one', () => {
    const { container, rerender } = render(<Strip tabs={TABS} activeId="a" />);
    const [first, second] = Array.from(container.querySelectorAll('[data-tab]'));
    expect(observers[0]!.targets.has(list(container))).toBe(true);
    expect(observers[0]!.targets.has(first!)).toBe(true);
    rerender(<Strip tabs={TABS} activeId="b" />);
    expect(observers[0]!.targets.has(first!)).toBe(false);
    expect(observers[0]!.targets.has(second!)).toBe(true);
  });

  it('hands back to each tab’s own card when nothing in the strip is open', () => {
    const { container, rerender } = render(<Strip tabs={TABS} activeId="a" />);
    rerender(<Strip tabs={TABS} activeId="elsewhere" />);
    expect(list(container).hasAttribute('data-tab-slide')).toBe(false);
    expect(slider(container).style.opacity).toBe('0');
    // The next open tab: the card appears there, rather than sliding from where it last stood.
    rerender(<Strip tabs={TABS} activeId="b" />);
    expect(slider(container).style.transition).toBe('none');
    expect(slider(container).style.transform).toBe('translate3d(92px, 8px, 0)');
  });

  it('does without a ResizeObserver, and stops its timer when it unmounts', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { container, rerender, unmount } = render(<Strip tabs={TABS} activeId="a" />);
    rerender(<Strip tabs={TABS} activeId="b" />);
    expect(slider(container).style.width).toBe('100px');
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  });
});

describe('measureSlot', () => {
  function strip() {
    const l = document.createElement('div');
    l.innerHTML = `
      <div data-collapse-width="shut" data-w="60" style="width: 0px"><div data-tab data-x="0" data-w="60"></div></div>
      <div data-collapse-width="open" data-w="20"></div>
      <div data-collapse-width="open" data-w="40" style="width: 40px"><div data-tab data-active data-x="100" data-w="40"></div></div>
      <div data-collapse-width="open" data-w="10" style="width: 80px"></div>`;
    return { l, tab: l.querySelector('[data-active]') as HTMLElement };
  }

  it('measures where the tab stands now', () => {
    const { l, tab } = strip();
    expect(measureSlot(l, tab, false)).toEqual({ x: 100, y: 8, w: 40, h: 40 + TAB_SLIDER_FOOT_PX });
  });

  it('aims past widths still easing before the tab, ignoring its own box, boxes after it and settled ones', () => {
    const { l, tab } = strip();
    // The first box eases from 60 to 0: the tab will stand 60px further left.
    expect(measureSlot(l, tab, true).x).toBe(40);
  });

  it('widens the card for a slot of the tab itself easing open, and does not move it', () => {
    const l = document.createElement('div');
    l.innerHTML = `
      <div data-tab data-active data-x="100" data-w="40">
        <div data-collapse-width="open" data-w="0" style="width: 28px"></div>
      </div>`;
    const tab = l.querySelector('[data-active]') as HTMLElement;
    const box = measureSlot(l, tab, true);
    expect(box.x).toBe(100);
    expect(box.w).toBe(68);
    expect(measureSlot(l, tab, false).w).toBe(40);
  });
});
