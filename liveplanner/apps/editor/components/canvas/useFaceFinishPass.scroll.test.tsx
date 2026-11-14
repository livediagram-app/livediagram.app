// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SKETCH_INK_SETTLE_MS } from '@liveworkspace/workbench/components/canvas/settle-watch';
import type { RefObject } from 'react';
import {
  drawMarkerFace as drawSharedFace,
  useFaceFinishPass as useSharedPass,
} from '@liveworkspace/workbench/components/canvas/useFaceFinishPass';
import type { Finish } from '@liveplanner/project';
import { PLAN_BOARD } from './plan-face-finish';

// The shared pass as liveplanner runs it: with the Plan board's hooks (plan-face-finish.ts).
const drawMarkerFace = (root: HTMLElement, id: string, pen?: 'marker' | 'pencil', page?: boolean) =>
  drawSharedFace(root, id, pen, page, PLAN_BOARD);
const useFaceFinishPass = (ref: RefObject<HTMLElement | null>, finish: Finish, id: string) =>
  useSharedPass(ref, finish, id, { board: PLAN_BOARD });

// Scrolling a busy Plan board under Marker (docs/specs/026-plan/plan-board.md "Marker draws what is in view"): a take
// skips the cards the browser is not drawing (content-visibility), and a card scrolled into view changes nothing in
// the DOM, so it kept its plain line until the next edit. Each skipped card is now watched, and its arrival in view
// re-takes the face once the scrolling pauses. jsdom lays nothing out and has no IntersectionObserver or
// content-visibility: each box is sized through data-w / data-h, the browser's drawing is the `drawn` set, and the
// observer is a stand-in the test scrolls by hand.
const size = (key: 'offsetWidth' | 'offsetHeight', attr: string) =>
  Object.defineProperty(HTMLElement.prototype, key, {
    configurable: true,
    get(this: HTMLElement) {
      return Number(this.getAttribute(attr) ?? 0);
    },
  });

/** The cards the browser draws (in or near the view). */
let drawn = new Set<string>();

class FakeObserver {
  static all: FakeObserver[] = [];
  watched = new Set<Element>();
  readonly callback: (entries: IntersectionObserverEntry[]) => void;
  constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
    this.callback = callback;
    FakeObserver.all.push(this);
  }
  observe(el: Element) {
    this.watched.add(el);
  }
  disconnect() {
    this.watched.clear();
  }
  /** The view moves: each watched card reports whether it is now in view. */
  scroll(inView: (el: Element) => boolean) {
    const entries = [...this.watched].map((target) => entry(target, inView(target)));
    if (entries.length) this.callback(entries);
  }
}
const entry = (target: Element, isIntersecting: boolean) =>
  ({ target, isIntersecting }) as unknown as IntersectionObserverEntry;
const scroll = (inView: (el: Element) => boolean) =>
  FakeObserver.all.forEach((o) => o.scroll(inView));

beforeEach(() => {
  size('offsetWidth', 'data-w');
  size('offsetHeight', 'data-h');
  drawn = new Set();
  FakeObserver.all = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  // A card's contents are skipped while the browser is not drawing it (offScreenCard reads its first child).
  Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
    configurable: true,
    value(this: HTMLElement) {
      const card = this.parentElement?.getAttribute('data-plan-card');
      return card === null || card === undefined || drawn.has(card);
    },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
  delete (HTMLElement.prototype as { checkVisibility?: unknown }).checkVisibility;
});

const CARDS = 30;
function Board() {
  const ref = useRef<HTMLDivElement>(null);
  useFaceFinishPass(ref, 'marker', 'board');
  return (
    <div ref={ref} data-w="1400" data-h="4000" style={{ position: 'absolute' }}>
      <div className="plan-col" data-plan-column="backlog" data-plan-lane="">
        {Array.from({ length: CARDS }, (_, i) => (
          <div
            key={i}
            data-plan-card={`c${i}`}
            data-w="260"
            data-h="100"
            style={{
              position: 'relative',
              border: '1px solid rgb(226, 232, 240)',
              borderRadius: 12,
            }}
          >
            <div>Card {i}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const card = (root: ParentNode, i: number) => root.querySelector(`[data-plan-card="c${i}"]`)!;
const inked = (root: ParentNode, i: number) =>
  !!card(root, i).querySelector(':scope > svg[data-marker-ink]') &&
  card(root, i).hasAttribute('data-marker-drawn');
const show = (from: number, to: number) => {
  drawn = new Set(Array.from({ length: to - from }, (_, i) => `c${from + i}`));
};
const between = (from: number, to: number) => (el: Element) => {
  const i = Number(el.getAttribute('data-plan-card')!.slice(1));
  return i >= from && i < to;
};

describe('scrolling a busy Plan board in marker', () => {
  it('draws the cards that scroll into view once the scrolling pauses, and only then', async () => {
    vi.useFakeTimers();
    show(0, 8);
    const { container } = render(<Board />);
    await act(async () => {});
    expect(inked(container, 0)).toBe(true);
    expect(inked(container, 7)).toBe(true);
    expect(inked(container, 8)).toBe(false);
    // Scrolled down: the browser now draws cards 10 to 17, and nothing in the board's DOM changed.
    show(10, 18);
    scroll(between(10, 18));
    // Not on the scroll's own frames: the face waits for the arrivals to pause.
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS / 2);
    expect(inked(container, 12)).toBe(false);
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS);
    for (let i = 10; i < 18; i++) expect(inked(container, i)).toBe(true);
    // The cards scrolled out of view keep nothing stale: the take skipped them.
    expect(inked(container, 0)).toBe(false);
    // And back up: the top cards take their ink again.
    show(0, 8);
    scroll(between(0, 8));
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS * 2);
    expect(inked(container, 0)).toBe(true);
    expect(inked(container, 12)).toBe(false);
  });

  it('re-takes once for a burst of arrivals, never once per scroll frame', async () => {
    vi.useFakeTimers();
    show(0, 8);
    const { container } = render(<Board />);
    await act(async () => {});
    const takes = vi.spyOn(container.firstElementChild!, 'setAttribute');
    // A fling: a card arrives every frame for 20 frames.
    for (let i = 8; i < 28; i++) {
      show(i - 7, i + 1);
      scroll(between(i - 7, i + 1));
      await vi.advanceTimersByTimeAsync(16);
    }
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS * 2);
    const held = takes.mock.calls.filter(([name]) => name === 'data-marker-taking');
    expect(held.length).toBeLessThanOrEqual(2);
    for (let i = 21; i < 28; i++) expect(inked(container, i)).toBe(true);
  });

  it('never loops on a card the browser still skips in view', async () => {
    vi.useFakeTimers();
    show(0, 8);
    const { container } = render(<Board />);
    await act(async () => {});
    const takes = vi.spyOn(container.firstElementChild!, 'setAttribute');
    // In view by the observer, but not drawn by the browser yet: one take, then quiet.
    scroll(between(8, 9));
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS * 2);
    scroll(between(8, 9));
    scroll(between(8, 9));
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS * 10);
    expect(takes.mock.calls.filter(([name]) => name === 'data-marker-taking')).toHaveLength(1);
    expect(inked(container, 8)).toBe(false);
  });

  it('holds no observer on a face that skips nothing, and lets go of it on unmount', async () => {
    vi.useFakeTimers();
    show(0, CARDS);
    const { unmount } = render(<Board />);
    await act(async () => {});
    expect(FakeObserver.all).toHaveLength(0);
    unmount();
    show(0, 8);
    const again = render(<Board />);
    await act(async () => {});
    const [observer] = FakeObserver.all;
    expect(observer!.watched.size).toBe(CARDS - 8);
    again.unmount();
    expect(observer!.watched.size).toBe(0);
  });
});

// On a phone every card is Minimal (40 px tall), as it is at any width on a Minimal board: its inset outline is under a
// frame's least size, so it was coloured in as a shape, which a card never is, and kept its plain line. Each card face
// is marked a frame (PlanCardFace's data-marker-frame).
function PhoneBoard({ marked = true, radius = 8 }: { marked?: boolean; radius?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useFaceFinishPass(ref, 'marker', 'board');
  return (
    <div ref={ref} data-w="375" data-h="724" style={{ position: 'absolute' }}>
      <div className="plan-col" data-plan-column="backlog" data-plan-lane="">
        {Array.from({ length: CARDS }, (_, i) => (
          <div
            key={i}
            data-plan-card={`c${i}`}
            data-w="351"
            data-h="40"
            style={{ position: 'relative' }}
          >
            <div
              className="plan-card"
              data-w="351"
              data-h="40"
              {...(marked ? { 'data-marker-frame': '' } : {})}
              style={{
                position: 'relative',
                border: '1px solid rgb(226, 232, 240)',
                borderRadius: radius,
                backgroundColor: 'rgb(255, 255, 255)',
              }}
            >
              <span>Card {i}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
const faceInked = (root: ParentNode, i: number) => {
  const face = card(root, i).firstElementChild!;
  return (
    !!face.querySelector(':scope > svg[data-marker-ink]') &&
    face.getAttribute('data-marker-drawn') === 'frame'
  );
};

describe('a phone board in marker (Minimal cards)', () => {
  it('outlines every Minimal card, square or round', () => {
    show(0, CARDS);
    for (const radius of [8, 20]) {
      const { container, unmount } = render(<PhoneBoard radius={radius} />);
      drawMarkerFace(container.firstElementChild as HTMLElement, 'board');
      for (let i = 0; i < CARDS; i++) expect(faceInked(container, i)).toBe(true);
      unmount();
    }
  });

  it('left an unmarked 40 px box plain, as before', () => {
    show(0, CARDS);
    const { container } = render(<PhoneBoard marked={false} />);
    drawMarkerFace(container.firstElementChild as HTMLElement, 'board');
    expect(faceInked(container, 0)).toBe(false);
  });

  it('inks the Minimal cards that scroll into view once the scrolling pauses', async () => {
    vi.useFakeTimers();
    show(0, 14);
    const { container } = render(<PhoneBoard />);
    await act(async () => {});
    expect(faceInked(container, 13)).toBe(true);
    expect(faceInked(container, 20)).toBe(false);
    show(14, 28);
    scroll(between(14, 28));
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS * 2);
    for (let i = 14; i < 28; i++) expect(faceInked(container, i)).toBe(true);
  });
});
