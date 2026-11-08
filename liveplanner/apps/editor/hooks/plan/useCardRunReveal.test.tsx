// @vitest-environment jsdom
// docs/specs/026-plan/plan-board.md "Cards out of view wait" (blueprint plan-board.md "Far runs"): a busy board draws
// only its runs near the view; a run arriving near is drawn before the frame, one leaving keeps its height, a card
// about to take focus is drawn first, and without IntersectionObserver every run is drawn.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RUN_NEAR_ATTR,
  markNear,
  revealCard,
  runIsNear,
  useCardRunReveal,
} from './useCardRunReveal';
import { cardsToMeasure } from './usePlanCardFlip';

afterEach(cleanup);

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

// Runs placed by a `data-top` attribute; the body is 0..500 tall, 0..1000 wide.
function placeRects() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.hasAttribute('data-body')) return box(0, 500, 0, 1000);
    return box(Number(this.dataset.top ?? 0), 100);
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

function Board({ tops, busy = true }: { tops: number[]; busy?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useCardRunReveal(ref, busy);
  return (
    <div ref={ref} data-body="">
      {tops.map((t) => (
        <div key={t} data-plan-run="" data-top={t} className="plan-card-run">
          <div data-plan-card={`c${t}`} tabIndex={0} />
        </div>
      ))}
    </div>
  );
}

const runAt = (c: HTMLElement, top: number) =>
  c.querySelector<HTMLElement>(`[data-plan-run][data-top="${top}"]`)!;

describe('useCardRunReveal', () => {
  beforeEach(() => placeRects());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('draws the runs near the view before the first frame, and observes every run', () => {
    const io = fakeIntersectionObserver();
    const { container } = render(<Board tops={[0, 400, 900, 1200, 3000]} />);
    expect(runAt(container, 0).hasAttribute(RUN_NEAR_ATTR)).toBe(true);
    expect(runAt(container, 900).hasAttribute(RUN_NEAR_ATTR)).toBe(true);
    expect(runAt(container, 1200).hasAttribute(RUN_NEAR_ATTR)).toBe(false);
    expect(runAt(container, 3000).hasAttribute(RUN_NEAR_ATTR)).toBe(false);
    expect(io.observe).toHaveBeenCalledTimes(5);
    expect(io.options).toMatchObject({ rootMargin: '100%' });
  });

  it('draws a run React adds near the view before the frame, and lets a removed run go', async () => {
    const io = fakeIntersectionObserver();
    const { container, rerender } = render(<Board tops={[0, 3000]} />);
    await act(async () => rerender(<Board tops={[0, 300, 4000]} />));
    expect(runAt(container, 300).hasAttribute(RUN_NEAR_ATTR)).toBe(true);
    expect(runAt(container, 4000).hasAttribute(RUN_NEAR_ATTR)).toBe(false);
    expect(io.unobserve).toHaveBeenCalledTimes(1);
    expect(io.observe).toHaveBeenCalledTimes(4);
  });

  it('finds the runs inside a column React adds whole, and skips text', async () => {
    const io = fakeIntersectionObserver();
    function Columns({ open }: { open: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      useCardRunReveal(ref, true);
      return (
        <div ref={ref} data-body="">
          {open ? (
            <section>
              text
              <div data-plan-run="" data-top={200} className="plan-card-run" />
              <div data-plan-run="" data-top={5000} className="plan-card-run" />
            </section>
          ) : null}
        </div>
      );
    }
    const { container, rerender } = render(<Columns open={false} />);
    await act(async () => rerender(<Columns open />));
    expect(runAt(container, 200).hasAttribute(RUN_NEAR_ATTR)).toBe(true);
    expect(runAt(container, 5000).hasAttribute(RUN_NEAR_ATTR)).toBe(false);
    expect(io.observe).toHaveBeenCalledTimes(2);
  });

  it('keeps a run leaving the view at its height, and draws it again as it comes back', () => {
    const io = fakeIntersectionObserver();
    const { container } = render(<Board tops={[0]} />);
    const run = runAt(container, 0);
    Object.defineProperty(run, 'offsetHeight', { configurable: true, value: 412 });
    act(() => io.fire([{ target: run, isIntersecting: false }]));
    expect(run.hasAttribute(RUN_NEAR_ATTR)).toBe(false);
    expect(run.style.getPropertyValue('--run-h')).toBe('412px');
    act(() => io.fire([{ target: run, isIntersecting: true }]));
    expect(run.hasAttribute(RUN_NEAR_ATTR)).toBe(true);
    expect(run.style.getPropertyValue('--run-h')).toBe('');
  });

  it('keeps what it set across a re-render, and lets go of everything on unmount', () => {
    const io = fakeIntersectionObserver();
    const { container, rerender, unmount } = render(<Board tops={[0, 3000]} />);
    rerender(<Board tops={[0, 3000]} />);
    expect(runAt(container, 0).hasAttribute(RUN_NEAR_ATTR)).toBe(true);
    unmount();
    expect(io.disconnect).toHaveBeenCalled();
  });

  it('does nothing on a board that is not busy', () => {
    const io = fakeIntersectionObserver();
    const { container } = render(<Board tops={[0]} busy={false} />);
    expect(runAt(container, 0).hasAttribute(RUN_NEAR_ATTR)).toBe(false);
    expect(io.observe).not.toHaveBeenCalled();
  });

  it('draws every run without IntersectionObserver, those added too', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container, rerender } = render(<Board tops={[0, 3000]} />);
    expect(runAt(container, 3000).hasAttribute(RUN_NEAR_ATTR)).toBe(true);
    await act(async () => rerender(<Board tops={[0, 3000, 5000]} />));
    expect(runAt(container, 5000).hasAttribute(RUN_NEAR_ATTR)).toBe(true);
  });
});

describe('revealCard and cardsToMeasure', () => {
  beforeEach(() => placeRects());
  afterEach(() => vi.restoreAllMocks());

  it('draws a far card’s run before it takes focus, and ignores a card in no run', () => {
    const { container } = render(<Board tops={[3000]} busy={false} />);
    const run = runAt(container, 3000);
    run.style.setProperty('--run-h', '300px');
    revealCard(run.querySelector('[data-plan-card]'));
    expect(run.hasAttribute(RUN_NEAR_ATTR)).toBe(true);
    expect(run.style.getPropertyValue('--run-h')).toBe('');
    expect(() => revealCard(document.createElement('div'))).not.toThrow();
    expect(() => revealCard(null)).not.toThrow();
    markNear(run);
    expect(run.hasAttribute(RUN_NEAR_ATTR)).toBe(true);
  });

  it('cardsToMeasure draws each run it reads, and only those', () => {
    const { container } = render(<Board tops={[0, 3000]} busy={false} />);
    const body = container.querySelector<HTMLElement>('[data-body]')!;
    expect(cardsToMeasure(body).map((c) => c.dataset.planCard)).toEqual(['c0']);
    expect(runAt(container, 0).hasAttribute(RUN_NEAR_ATTR)).toBe(true);
    expect(runAt(container, 3000).hasAttribute(RUN_NEAR_ATTR)).toBe(false);
  });
});

describe('the far run styles', () => {
  const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
  it('hide a far run’s cards and hold its height', () => {
    expect(css).toMatch(/\.plan-card-run:not\(\[data-plan-run-near\]\) > \* \{\s*display: none;/);
    expect(css).toMatch(
      /\.plan-card-run:not\(\[data-plan-run-near\]\) \{\s*height: var\(--run-h, calc\(var\(--run-cards, 1\) \* 140px \+ 40px\)\);/,
    );
  });
});
