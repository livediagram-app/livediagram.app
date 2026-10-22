// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPEN_MS, QUESTION_FLIP, growBetween, leaveThen } from './question-motion';

// The builder's question motion (docs/specs/030-forms/forms.md "Building a form").

let reduce = false;
vi.mock('@/lib/motion-preference', () => ({ prefersReducedMotion: () => reduce }));
afterEach(() => {
  reduce = false;
  vi.useRealTimers();
});

describe('QUESTION_FLIP', () => {
  it('measures against the column, and grows a new question in once', () => {
    const root = document.createElement('div');
    root.setAttribute('data-flip-root', '');
    const node = document.createElement('div');
    root.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    node.getBoundingClientRect = () => ({ top: 160 }) as DOMRect;
    const flip = QUESTION_FLIP;
    expect(flip.measure!(node)).toBe(160);
    root.append(node);
    expect(flip.measure!(node)).toBe(60);
    flip.onEnter!(node);
    expect(node.classList.contains('form-q-enter')).toBe(true);
    node.dispatchEvent(new Event('animationend'));
    expect(node.classList.contains('form-q-enter')).toBe(false);
  });
});

describe('leaveThen', () => {
  it('plays the leave, then deletes once, on its end or after it', () => {
    vi.useFakeTimers();
    const node = document.createElement('div');
    const done = vi.fn();
    leaveThen(node, done);
    expect(node.classList.contains('form-q-leave')).toBe(true);
    expect(done).not.toHaveBeenCalled();
    node.dispatchEvent(new Event('animationend'));
    vi.advanceTimersByTime(500);
    expect(done).toHaveBeenCalledTimes(1);
    const late = vi.fn();
    leaveThen(document.createElement('div'), late);
    vi.advanceTimersByTime(500);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('deletes at once under reduced motion or with no card', () => {
    const done = vi.fn();
    leaveThen(null, done);
    reduce = true;
    leaveThen(document.createElement('div'), done);
    expect(done).toHaveBeenCalledTimes(2);
  });
});

describe('growBetween', () => {
  const card = (height: number) => {
    const node = document.createElement('div');
    Object.defineProperty(node, 'offsetHeight', { value: height });
    node.animate = vi.fn(() => ({}) as Animation);
    return node;
  };

  it('grows a question from its last height to its new one, clipped', () => {
    const node = card(288);
    expect(growBetween(node, 179)).not.toBeNull();
    expect(node.animate).toHaveBeenCalledWith(
      [
        { height: '179px', overflow: 'hidden' },
        { height: '288px', overflow: 'hidden' },
      ],
      expect.objectContaining({ duration: OPEN_MS }),
    );
  });

  it('plays nothing under reduced motion, or when the height did not change', () => {
    const node = card(288);
    expect(growBetween(node, 288)).toBeNull();
    reduce = true;
    expect(growBetween(node, 179)).toBeNull();
    expect(node.animate).not.toHaveBeenCalled();
  });

  it('keeps within the motion budget', () => {
    expect(OPEN_MS).toBeLessThanOrEqual(250);
  });
});
