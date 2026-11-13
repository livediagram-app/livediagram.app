// @vitest-environment jsdom
// docs/specs/026-plan/plan-board.md "Cards out of view wait" (blueprint plan-board.md "Far runs"): a busy board builds
// only its runs near the view; a run arriving near is built before the frame (a board's worth at once as a transition), one leaving drops its cards and keeps
// its height, a card about to take focus is built first, and without IntersectionObserver every run is built.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanCardRun } from '@/components/plan/PlanCardRun';
import {
  RUN_NEAR_ATTR,
  RUN_REVEAL_TRANSITION,
  RunRevealContext,
  cardOrRunSelector,
  focusPlanCard,
  markNear,
  runIsNear,
  useCardRunReveal,
} from './useCardRunReveal';
import { cardsToMeasure } from './usePlanCardFlip';

afterEach(cleanup);

// The near runs a commit found are drawn once its layout effects have run (a microtask later).
const settle = () => act(async () => {});

const box = (top: number, height: number, left = 0, width = 200) =>
  ({
    top,
    bottom: top + height,
    left,
    right: left + width,
    width,
    height,
    x: left,
    y: top,
  }) as DOMRect;

// A run named `c<top>` sits at that top; the body is 0..500 tall, 0..1000 wide.
function placeRects() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.hasAttribute('data-body')) return box(0, 500, 0, 1000);
    const ids = this.dataset.planRunIds;
    return box(ids ? Number(ids.slice(1)) : 0, 100);
  });
}

describe('runIsNear', () => {
  const view = { top: 100, bottom: 600, left: 0, right: 1000 };
  it('takes a run within one view of the view on every side', () => {
    expect(runIsNear({ top: 300, bottom: 400, left: 0, right: 200 }, view)).toBe(true);
    expect(runIsNear({ top: 1000, bottom: 1100, left: 0, right: 200 }, view)).toBe(true);
    expect(runIsNear({ top: -450, bottom: -390, left: 0, right: 200 }, view)).toBe(true);
    expect(runIsNear({ top: 1101, bottom: 1200, left: 0, right: 200 }, view)).toBe(false);
    expect(runIsNear({ top: -600, bottom: -401, left: 0, right: 200 }, view)).toBe(false);
    expect(runIsNear({ top: 300, bottom: 400, left: 2001, right: 2200 }, view)).toBe(false);
    expect(runIsNear({ top: 300, bottom: 400, left: -1200, right: -1001 }, view)).toBe(false);
  });
});

type Spy = {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  fire: (entries: { target: Element; isIntersecting: boolean }[]) => void;
  options?: IntersectionObserverInit;
};

function fakeIntersectionObserver(): Spy {
  const spy = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    fire: () => {},
  } as Spy;
  class FakeIO {
    constructor(
      cb: (e: { target: Element; isIntersecting: boolean }[]) => void,
      opts: IntersectionObserverInit,
    ) {
      spy.fire = cb;
      spy.options = opts;
    }
    observe = spy.observe;
    unobserve = spy.unobserve;
    disconnect = spy.disconnect;
  }
  vi.stubGlobal('IntersectionObserver', FakeIO);
  return spy;
}

function Board({
  tops,
  busy = true,
  onDrawn,
}: {
  tops: number[];
  busy?: boolean;
  onDrawn?: (run: HTMLElement) => void;
}) {
  const reveal = useCardRunReveal(busy, onDrawn);
  return (
    <RunRevealContext value={reveal}>
      <div data-plan-body="" data-body="">
        {tops.map((t) => (
          <PlanCardRun key={t} ids={`c${t}`} count={1} simplified={false}>
            <div data-plan-card={`c${t}`} tabIndex={0} />
          </PlanCardRun>
        ))}
      </div>
    </RunRevealContext>
  );
}

const runAt = (c: HTMLElement, top: number) =>
  c.querySelector<HTMLElement>(`[data-plan-run][data-plan-run-ids="c${top}"]`)!;
const built = (c: HTMLElement, top: number) => !!runAt(c, top).querySelector('[data-plan-card]');

describe('PlanCardRun with useCardRunReveal', () => {
  beforeEach(() => placeRects());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('builds the runs near the view before the first frame, and observes every run', async () => {
    const io = fakeIntersectionObserver();
    const { container } = render(<Board tops={[0, 400, 900, 1200, 3000]} />);
    await settle();
    for (const t of [0, 400, 900]) {
      expect(runAt(container, t).hasAttribute(RUN_NEAR_ATTR)).toBe(true);
      expect(built(container, t)).toBe(true);
    }
    for (const t of [1200, 3000]) {
      expect(runAt(container, t).hasAttribute(RUN_NEAR_ATTR)).toBe(false);
      expect(runAt(container, t).children.length).toBe(0);
      expect(runAt(container, t).style.getPropertyValue('--run-cards')).toBe('1');
    }
    expect(io.observe).toHaveBeenCalledTimes(5);
    expect(io.options).toMatchObject({ rootMargin: '100%' });
    expect(io.options?.root).toBe(container.querySelector('[data-plan-body]'));
  });

  it('builds a run React adds near the view at once, and lets a removed run go', async () => {
    const io = fakeIntersectionObserver();
    const { container, rerender } = render(<Board tops={[0, 3000]} />);
    await settle();
    rerender(<Board tops={[0, 300, 4000]} />);
    await settle();
    expect(built(container, 300)).toBe(true);
    expect(built(container, 4000)).toBe(false);
    expect(io.unobserve).toHaveBeenCalledTimes(1);
    expect(io.observe).toHaveBeenCalledTimes(4);
  });

  it('drops a run’s cards as it leaves the view, keeping its height, and builds them as it comes back', async () => {
    const io = fakeIntersectionObserver();
    const { container } = render(<Board tops={[0]} />);
    await settle();
    const run = runAt(container, 0);
    Object.defineProperty(run, 'offsetHeight', { configurable: true, value: 412 });
    act(() => io.fire([{ target: run, isIntersecting: false }]));
    expect(run.hasAttribute(RUN_NEAR_ATTR)).toBe(false);
    expect(run.children.length).toBe(0);
    expect(run.style.getPropertyValue('--run-h')).toBe('412px');
    // Already far: nothing read or set again.
    act(() => io.fire([{ target: run, isIntersecting: false }]));
    act(() => io.fire([{ target: run, isIntersecting: true }]));
    expect(built(container, 0)).toBe(true);
    expect(run.style.getPropertyValue('--run-h')).toBe('');
  });

  it('tells the board each run whose cards it built', async () => {
    fakeIntersectionObserver();
    const onDrawn = vi.fn();
    const { container } = render(<Board tops={[0, 3000]} onDrawn={onDrawn} />);
    await settle();
    expect(onDrawn).toHaveBeenCalledTimes(1);
    expect(onDrawn).toHaveBeenCalledWith(runAt(container, 0));
  });

  it('keeps its runs across a re-render, and lets go of everything on unmount', async () => {
    const io = fakeIntersectionObserver();
    const { container, rerender, unmount } = render(<Board tops={[0, 3000]} />);
    await settle();
    rerender(<Board tops={[0, 3000]} />);
    await settle();
    expect(built(container, 0)).toBe(true);
    expect(built(container, 3000)).toBe(false);
    unmount();
    expect(io.disconnect).toHaveBeenCalled();
  });

  it('builds every run on a board that is not busy', () => {
    const io = fakeIntersectionObserver();
    const { container } = render(<Board tops={[0, 3000]} busy={false} />);
    expect(built(container, 3000)).toBe(true);
    expect(io.observe).not.toHaveBeenCalled();
  });

  it('builds every run without IntersectionObserver, those added too', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container, rerender } = render(<Board tops={[0, 3000]} />);
    expect(built(container, 3000)).toBe(true);
    expect(runAt(container, 3000).hasAttribute(RUN_NEAR_ATTR)).toBe(true);
    rerender(<Board tops={[0, 3000, 5000]} />);
    expect(built(container, 5000)).toBe(true);
  });

  it('builds a run outside any board body at once', () => {
    fakeIntersectionObserver();
    function Loose() {
      const reveal = useCardRunReveal(true);
      return (
        <RunRevealContext value={reveal}>
          <PlanCardRun ids="c3000" count={1} simplified>
            <div data-plan-card="c3000" />
          </PlanCardRun>
        </RunRevealContext>
      );
    }
    const { container } = render(<Loose />);
    expect(built(container, 3000)).toBe(true);
    expect(runAt(container, 3000).className).toContain('gap-1.5');
  });
});

describe('focusPlanCard, markNear and cardsToMeasure', () => {
  beforeEach(() => placeRects());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('builds a far card’s run and then focuses it; a built card at once; others are let be', async () => {
    fakeIntersectionObserver();
    const { container } = render(<Board tops={[0, 3000]} />);
    await settle();
    act(() => focusPlanCard(container, 'c3000', { preventScroll: true }));
    expect(document.activeElement).toBe(container.querySelector('[data-plan-card="c3000"]'));
    focusPlanCard(container, 'c0');
    expect(document.activeElement).toBe(container.querySelector('[data-plan-card="c0"]'));
    expect(() => focusPlanCard(container, 'nowhere')).not.toThrow();
    expect(() => focusPlanCard(null, 'c0')).not.toThrow();
    expect(() => focusPlanCard(container, null)).not.toThrow();
  });

  it('finds a card, or the far run naming it', async () => {
    fakeIntersectionObserver();
    const { container } = render(<Board tops={[0, 3000]} />);
    await settle();
    expect(container.querySelector(cardOrRunSelector('c0'))?.hasAttribute('data-plan-card')).toBe(
      true,
    );
    expect(container.querySelector(cardOrRunSelector('c3000'))).toBe(runAt(container, 3000));
    expect(container.querySelector(cardOrRunSelector('c30'))).toBeNull();
  });

  it('markNear builds a far run, and does nothing to one no board drew', async () => {
    const io = fakeIntersectionObserver();
    const { container } = render(<Board tops={[3000]} />);
    const run = runAt(container, 3000);
    markNear(run);
    await settle();
    expect(built(container, 3000)).toBe(true);
    // Still known as near: going far again drops its cards.
    Object.defineProperty(run, 'offsetHeight', { configurable: true, value: 90 });
    act(() => io.fire([{ target: run, isIntersecting: false }]));
    expect(built(container, 3000)).toBe(false);
    expect(() => markNear(document.createElement('div'))).not.toThrow();
  });

  it('cardsToMeasure reads the near runs’ cards and asks a near run not yet built to build', async () => {
    fakeIntersectionObserver();
    const { container } = render(<Board tops={[0, 3000]} />);
    await settle();
    const body = container.querySelector<HTMLElement>('[data-body]')!;
    expect(cardsToMeasure(body).map((c) => c.dataset.planCard)).toEqual(['c0']);
    await settle();
    expect(built(container, 3000)).toBe(false);
  });

  it('draws a board’s worth of near runs together as a transition, once its commit is done', async () => {
    fakeIntersectionObserver();
    const tops = Array.from({ length: RUN_REVEAL_TRANSITION + 2 }, (_, i) => i * 40);
    const { container } = render(<Board tops={tops} />);
    // Not in the board's own commit: the runs hold their places, empty.
    expect(built(container, 0)).toBe(false);
    await settle();
    for (const t of tops) expect(built(container, t)).toBe(true);
  });

  it('draws a few near runs before the frame, asks once per run, and forgets a run gone before it is drawn', async () => {
    fakeIntersectionObserver();
    const { container, rerender } = render(<Board tops={[0, 3000]} />);
    const far = runAt(container, 3000);
    // Asked twice in one commit: drawn once.
    markNear(far);
    markNear(far);
    rerender(<Board tops={[3000]} />);
    await settle();
    expect(built(container, 3000)).toBe(true);
    const { container: gone, unmount } = render(<Board tops={[0]} />);
    expect(built(gone, 0)).toBe(false);
    unmount();
    await expect(settle()).resolves.toBeUndefined();
  });
});

describe('the far run styles', () => {
  const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
  it('hold a far run’s height', () => {
    expect(css).toMatch(
      /\.plan-card-run:not\(\[data-plan-run-near\]\) \{\s*height: var\(--run-h, calc\(var\(--run-cards, 1\) \* 140px \+ 40px\)\);/,
    );
  });
});
