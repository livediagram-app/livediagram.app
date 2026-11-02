// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhoneColumnSwipe } from './usePhoneColumnSwipe';

const held = vi.hoisted(() => ({ now: false }));
vi.mock('./usePlanCardDrag', () => ({ cardHeld: () => held.now }));
const reduced = vi.hoisted(() => ({ now: false }));
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => reduced.now,
}));

// docs/specs/026-plan/plan-board.md "On a phone", "A column changes only on a swipe meant for it": a 390 px phone's
// body, its four 326 px columns 12 px apart, each centred at a stop 338 px on from the last.
const COLUMN = 326;
const PITCH = 338;
const COLUMNS = 4;

function board(scrollLeft = 0) {
  const body = document.createElement('div');
  body.scrollLeft = scrollLeft;
  Object.defineProperty(body, 'clientWidth', { value: 390 });
  Object.defineProperty(body, 'scrollWidth', { value: 390 + PITCH * (COLUMNS - 1) });
  body.getBoundingClientRect = () => ({ left: 0, width: 390 }) as DOMRect;
  for (let i = 0; i < COLUMNS; i++) {
    const marker = document.createElement('div');
    marker.setAttribute('data-plan-snap', '');
    marker.getBoundingClientRect = () =>
      ({ left: 32 + i * PITCH - body.scrollLeft, width: COLUMN }) as DOMRect;
    body.appendChild(marker);
  }
  body.scrollTo = vi.fn((opts: ScrollToOptions) => {
    body.scrollLeft = opts.left!;
  }) as unknown as typeof body.scrollTo;
  document.body.appendChild(body);
  return body;
}

let clock = 0;
function touch(el: HTMLElement, type: string, points: [number, number][], dt = 16) {
  clock += dt;
  const e = new Event(type);
  Object.defineProperty(e, 'touches', {
    value: points.map(([clientX, clientY]) => ({ clientX, clientY })),
  });
  Object.defineProperty(e, 'timeStamp', { value: clock });
  el.dispatchEvent(e);
}

// A finger from (x, y), through each step, then lifted (dt ms a step).
function swipe(el: HTMLElement, from: [number, number], steps: [number, number][], dt = 16) {
  touch(el, 'touchstart', [from]);
  for (const p of steps) touch(el, 'touchmove', [p], dt);
  touch(el, 'touchend', [], dt);
}

function mount(body: HTMLElement, enabled = true, carrying = false) {
  return renderHook(({ on, carry }) => usePhoneColumnSwipe({ current: body }, on, carry), {
    initialProps: { on: enabled, carry: carrying },
  });
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  held.now = false;
  reduced.now = false;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('usePhoneColumnSwipe', () => {
  it('leaves a scroll down that drifts sideways to the browser: the column holds', () => {
    const body = board(PITCH);
    mount(body);
    swipe(
      body,
      [200, 600],
      [
        [204, 580],
        [230, 520],
        [290, 420],
        [330, 300],
      ],
    );
    expect(body.scrollLeft).toBe(PITCH);
    expect(body.scrollTo).not.toHaveBeenCalled();
    expect(body.style.scrollSnapType).toBe('');
  });

  it('carries the columns under a sideways finger, snapping off, and glides back from a short swipe', () => {
    const body = board(PITCH);
    mount(body);
    touch(body, 'touchstart', [[200, 400]]);
    touch(body, 'touchmove', [[188, 402]], 60);
    expect(body.style.scrollSnapType).toBe('none');
    touch(body, 'touchmove', [[170, 404]], 60);
    expect(body.scrollLeft).toBe(PITCH + 30);
    touch(body, 'touchend', [], 60);
    expect(body.scrollTo).toHaveBeenLastCalledWith({ left: PITCH, behavior: 'smooth' });
    // The glide ends: the columns snap again.
    body.dispatchEvent(new Event('scrollend'));
    expect(body.style.scrollSnapType).toBe('');
  });

  it('moves one column on a long swipe, either way, never past the ends', () => {
    const body = board(PITCH);
    mount(body);
    swipe(
      body,
      [300, 400],
      [
        [280, 404],
        [200, 410],
        [150, 412],
      ],
      80,
    );
    expect(body.scrollTo).toHaveBeenLastCalledWith({ left: 2 * PITCH, behavior: 'smooth' });
    swipe(
      body,
      [100, 400],
      [
        [120, 400],
        [260, 404],
      ],
      80,
    );
    expect(body.scrollLeft).toBe(PITCH);
    // From the first column, a swipe back stays there.
    body.scrollLeft = 0;
    swipe(
      body,
      [100, 400],
      [
        [120, 400],
        [260, 404],
      ],
      80,
    );
    expect(body.scrollLeft).toBe(0);
  });

  it('moves one column on a quick flick, and not when the finger stops before lifting', () => {
    const body = board(0);
    mount(body);
    swipe(
      body,
      [300, 400],
      [
        [288, 400],
        [270, 401],
      ],
      16,
    );
    expect(body.scrollLeft).toBe(PITCH);
    touch(body, 'touchstart', [[300, 400]]);
    touch(body, 'touchmove', [[288, 400]]);
    touch(body, 'touchmove', [[270, 401]]);
    touch(body, 'touchend', [], 300);
    expect(body.scrollLeft).toBe(PITCH);
  });

  it('jumps rather than glides under reduced motion, snapping again after a fallback with no scrollend', () => {
    vi.useFakeTimers();
    reduced.now = true;
    const body = board(0);
    body.scrollTo = vi.fn() as typeof body.scrollTo;
    mount(body);
    swipe(
      body,
      [300, 400],
      [
        [280, 400],
        [150, 400],
      ],
      80,
    );
    expect(body.scrollTo).toHaveBeenLastCalledWith({ left: PITCH, behavior: 'auto' });
    expect(body.style.scrollSnapType).toBe('none');
    vi.advanceTimersByTime(600);
    expect(body.style.scrollSnapType).toBe('');
  });

  it('snaps again at once when the release lands where the columns already are', () => {
    const body = board(0);
    mount(body);
    swipe(
      body,
      [300, 400],
      [
        [312, 400],
        [300, 400],
      ],
    );
    expect(body.scrollTo).not.toHaveBeenCalled();
    expect(body.style.scrollSnapType).toBe('');
  });

  it('stands down for a second finger, a card held to carry, or a card already carried', () => {
    const body = board(PITCH);
    const view = mount(body);
    touch(body, 'touchstart', [[300, 400]]);
    touch(body, 'touchmove', [[280, 400]]);
    touch(body, 'touchstart', [
      [280, 400],
      [100, 500],
    ]);
    touch(body, 'touchmove', [
      [100, 400],
      [100, 500],
    ]);
    expect(body.scrollLeft).toBe(PITCH);
    touch(body, 'touchend', [[100, 500]]);
    touch(body, 'touchend', []);

    held.now = true;
    swipe(body, [300, 400], [[150, 400]]);
    expect(body.scrollLeft).toBe(PITCH);
    held.now = false;

    view.rerender({ on: true, carry: true });
    swipe(body, [300, 400], [[150, 400]]);
    expect(body.scrollLeft).toBe(PITCH);
  });

  it('ends a swipe the browser cancels where it began', () => {
    const body = board(PITCH);
    mount(body);
    touch(body, 'touchstart', [[300, 400]]);
    touch(body, 'touchmove', [[150, 400]]);
    touch(body, 'touchcancel', []);
    expect(body.scrollLeft).toBe(PITCH);
  });

  it('does nothing on a board of one column, or with no column stops', () => {
    const body = board(0);
    while (body.children.length > 1) body.lastChild!.remove();
    mount(body);
    swipe(body, [300, 400], [[100, 400]]);
    expect(body.scrollTo).not.toHaveBeenCalled();
    expect(body.style.scrollSnapType).toBe('');
  });

  it('listens to nothing when off, and lets the columns snap again when switched off mid-swipe', () => {
    const body = board(PITCH);
    const view = mount(body, false);
    swipe(body, [300, 400], [[100, 400]]);
    expect(body.scrollTo).not.toHaveBeenCalled();
    view.rerender({ on: true, carry: false });
    touch(body, 'touchstart', [[300, 400]]);
    touch(body, 'touchmove', [[250, 400]]);
    expect(body.style.scrollSnapType).toBe('none');
    view.unmount();
    expect(body.style.scrollSnapType).toBe('');
  });

  it('writes the columns once a frame, and drops a frame the release or unmounting overtakes', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    const body = board(PITCH);
    const view = mount(body);
    touch(body, 'touchstart', [[300, 400]]);
    // Inside the slop: not settled yet.
    touch(body, 'touchmove', [[296, 401]]);
    touch(body, 'touchmove', [[280, 400]]);
    touch(body, 'touchmove', [[270, 400]]);
    expect(frames).toHaveLength(1);
    expect(body.scrollLeft).toBe(PITCH);
    frames.shift()!(0);
    expect(body.scrollLeft).toBe(PITCH + 30);
    touch(body, 'touchmove', [[260, 400]]);
    touch(body, 'touchend', [], 300);
    // A frame left from before the release writes nothing.
    frames.shift()!(0);
    expect(body.scrollLeft).toBe(PITCH);
    touch(body, 'touchstart', [[300, 400]]);
    touch(body, 'touchmove', [[260, 400]]);
    view.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('takes its listeners passive, so a scroll down never waits on them', () => {
    const body = board(0);
    const add = vi.spyOn(body, 'addEventListener');
    mount(body);
    const touches = add.mock.calls.filter(([type]) => String(type).startsWith('touch'));
    expect(touches).toHaveLength(4);
    for (const [, , opts] of touches) expect(opts).toEqual({ passive: true });
  });
});
