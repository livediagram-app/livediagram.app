// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withViewTransition } from './view-transition';

type Doc = { startViewTransition?: unknown };

afterEach(() => {
  delete (document as unknown as Doc).startViewTransition;
  document.documentElement.classList.remove('reduce-motion');
});

describe('withViewTransition', () => {
  it('runs the change inside a View Transition where the browser has them', () => {
    const start = vi.fn((cb: () => void) => cb());
    (document as unknown as Doc).startViewTransition = start;
    const change = vi.fn();
    withViewTransition(change);
    expect(start).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledOnce();
  });

  it('runs the change straight away without them', () => {
    const change = vi.fn();
    withViewTransition(change);
    expect(change).toHaveBeenCalledOnce();
  });

  it('runs the change straight away when motion is reduced', () => {
    const start = vi.fn();
    (document as unknown as Doc).startViewTransition = start;
    document.documentElement.classList.add('reduce-motion');
    const change = vi.fn();
    withViewTransition(change);
    expect(start).not.toHaveBeenCalled();
    expect(change).toHaveBeenCalledOnce();
  });
});
