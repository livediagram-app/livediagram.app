// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const react = vi.hoisted(() => ({
  startTransition: vi.fn((scope: () => void) => scope()),
  addTransitionType: vi.fn(),
}));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal()), ...react }));

import { startTypedTransition } from './view-transition';

// docs/specs/003-system-architecture/react-state-and-effects.md "Animating a state change"
afterEach(() => {
  vi.clearAllMocks();
  document.documentElement.classList.remove('reduce-motion');
});

describe('startTypedTransition', () => {
  it('runs the change in a transition named by its type', () => {
    const change = vi.fn(() => expect(react.addTransitionType).toHaveBeenCalledWith('start-mode'));
    startTypedTransition('start-mode', change);
    expect(react.startTransition).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledOnce();
  });

  it('runs the change plainly under reduced motion, so no View Transition starts', () => {
    document.documentElement.classList.add('reduce-motion');
    const change = vi.fn();
    startTypedTransition('start-mode', change);
    expect(change).toHaveBeenCalledOnce();
    expect(react.startTransition).not.toHaveBeenCalled();
    expect(react.addTransitionType).not.toHaveBeenCalled();
  });
});
