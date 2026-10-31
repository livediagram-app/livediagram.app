// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNearViewport } from './useNearViewport';

// Below-the-fold work waits until its element comes near (a landing section's request, the footer's Community link).

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref);
  return <div ref={ref}>{near ? 'near' : 'far'}</div>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useNearViewport', () => {
  it('answers near at once where IntersectionObserver is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Probe />);
    expect(screen.getByText('near')).toBeTruthy();
  });

  it('latches near on the first intersection and stops observing', () => {
    let fire: (entries: { isIntersecting: boolean }[]) => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof fire) {
          fire = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    render(<Probe />);
    expect(screen.getByText('far')).toBeTruthy();
    act(() => fire([{ isIntersecting: false }]));
    expect(screen.getByText('far')).toBeTruthy();
    act(() => fire([{ isIntersecting: true }]));
    expect(screen.getByText('near')).toBeTruthy();
    expect(disconnect).toHaveBeenCalled();
  });
});
