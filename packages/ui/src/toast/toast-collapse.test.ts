// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TOAST_BELL_ATTR,
  TOAST_COLLAPSE_MS,
  collapseIntoBell,
  collapseTarget,
  findToastBell,
} from './toast-collapse';

// liveworkspace/docs/specs/016-notifications/toasts.md "Collapsing into the bell".

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

function bellAt(r: DOMRect): HTMLElement {
  const bell = document.createElement('button');
  bell.setAttribute(TOAST_BELL_ATTR, '');
  bell.getBoundingClientRect = () => r;
  document.body.append(bell);
  return bell;
}

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.classList.remove('reduce-motion');
  vi.restoreAllMocks();
});

describe('collapseTarget', () => {
  it('moves the card’s centre to the bell’s and shrinks it to the bell’s size', () => {
    const t = collapseTarget(rect(400, 700, 400, 44), rect(1300, 860, 28, 28));
    expect(t.dx).toBe(1314 - 600);
    expect(t.dy).toBe(874 - 722);
    expect(t.scale).toBeCloseTo(28 / 400);
  });

  it('never shrinks to nothing, nor grows', () => {
    expect(collapseTarget(rect(0, 0, 4000, 4000), rect(0, 0, 1, 1)).scale).toBe(0.04);
    expect(collapseTarget(rect(0, 0, 10, 10), rect(0, 0, 50, 50)).scale).toBe(1);
    expect(collapseTarget(rect(0, 0, 0, 0), rect(0, 0, 10, 10)).scale).toBe(1);
  });
});

describe('findToastBell', () => {
  it('finds the bell on screen, never one without a size or off it', () => {
    bellAt(rect(0, 0, 0, 0));
    bellAt(rect(0, window.innerHeight + 10, 28, 28));
    expect(findToastBell()).toBeNull();
    const shown = bellAt(rect(10, 10, 28, 28));
    expect(findToastBell()).toBe(shown);
  });
});

describe('collapseIntoBell', () => {
  const animated = () => {
    const card = document.createElement('div');
    card.getBoundingClientRect = () => rect(100, 100, 300, 44);
    let finish: () => void = () => {};
    const motion = { finished: new Promise<void>((done) => (finish = done)), cancel: vi.fn() };
    const animate = vi.fn(() => motion as unknown as Animation);
    card.animate = animate;
    return { card, animate, finish: () => finish() };
  };

  it('leaves the plain way with no bell, no animate or reduced motion', () => {
    const { card } = animated();
    expect(collapseIntoBell(card)).toBeNull();
    bellAt(rect(10, 10, 28, 28));
    // jsdom has no Web Animations.
    expect(collapseIntoBell(document.createElement('div'))).toBeNull();
    document.documentElement.classList.add('reduce-motion');
    expect(collapseIntoBell(card)).toBeNull();
  });

  it('runs over long towards the bell, then pulses the bell', async () => {
    const bell = bellAt(rect(10, 10, 28, 28));
    const pulse = vi.fn();
    bell.animate = pulse;
    const { card, animate, finish } = animated();
    expect(collapseIntoBell(card)).not.toBeNull();
    const [frames, timing] = animate.mock.calls[0] as unknown as [
      Keyframe[],
      KeyframeAnimationOptions,
    ];
    expect(timing.duration).toBe(TOAST_COLLAPSE_MS);
    expect(String(frames.at(-1)!.transform)).toContain('translate(');
    expect(frames.at(-1)!.opacity).toBe(0);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(pulse).toHaveBeenCalledOnce();
  });
});
