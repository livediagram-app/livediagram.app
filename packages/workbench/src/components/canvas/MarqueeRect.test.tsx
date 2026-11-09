// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createStateStore } from '../../lib/state-store';
import { MarqueeRect, type MarqueeState } from './MarqueeRect';

// Each editor's docs/specs/008-canvas/canvas-performance.md "A sweep moves one layer": the rectangle stays in the
// page between sweeps, so a sweep adds and removes no element.
afterEach(cleanup);

describe('MarqueeRect', () => {
  it('keeps one element through a sweep, hidden between sweeps', () => {
    const store = createStateStore<MarqueeState | null>(null);
    const { container } = render(<MarqueeRect store={store} stroke="red" fill="pink" />);
    const idle = container.querySelector<HTMLElement>('[data-marquee]')!;
    expect(idle.hidden).toBe(true);

    act(() => store.set({ startX: 50, startY: 40, currentX: 10, currentY: 100 }));
    const sweeping = container.querySelector<HTMLElement>('[data-marquee]')!;
    expect(sweeping).toBe(idle);
    expect(sweeping.hidden).toBe(false);
    expect(sweeping.style.transform).toBe('translate(10px, 40px)');
    expect(sweeping.style.width).toBe('40px');
    expect(sweeping.style.height).toBe('60px');

    act(() => store.set(null));
    expect(container.querySelector('[data-marquee]')).toBe(idle);
    expect(idle.hidden).toBe(true);
  });
});
