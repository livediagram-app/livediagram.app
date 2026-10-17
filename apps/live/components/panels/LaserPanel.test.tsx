// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LASER_CONFIG, laserLifetimeMs, type LaserConfig } from '@/lib/laser-config';
import { LaserPanel } from './LaserPanel';

// The panel's chrome is MovablePanel's own (tested there): here, only the preview.
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

// docs/specs/008-canvas/laser-panel.md "The settings": the preview holds still, and a setting changed draws the sweep
// across once.
describe('the Laser Panel preview', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const panel = (config: LaserConfig) => (
    <LaserPanel
      config={config}
      onChange={vi.fn()}
      selfColour="#22c55e"
      position={null}
      onMoveTo={vi.fn()}
    />
  );
  const state = () =>
    document.querySelector('[data-laser-preview]')!.getAttribute('data-laser-preview');
  const strokes = () => document.querySelectorAll('[data-laser-preview] svg *').length;

  it('shows the whole stroke at rest and runs no frame loop', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    render(panel(DEFAULT_LASER_CONFIG));
    expect(state()).toBe('still');
    expect(strokes()).toBeGreaterThan(0);
    act(() => vi.advanceTimersByTime(10_000));
    expect(raf).not.toHaveBeenCalled();
    expect(state()).toBe('still');
  });

  it('plays the sweep once when a setting changes, then rests again', () => {
    const { rerender } = render(panel(DEFAULT_LASER_CONFIG));
    const bold: LaserConfig = { ...DEFAULT_LASER_CONFIG, width: 'bold' };
    rerender(panel(bold));
    act(() => vi.advanceTimersByTime(50));
    expect(state()).toBe('playing');
    act(() => vi.advanceTimersByTime(laserLifetimeMs(bold)));
    expect(state()).toBe('still');
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    act(() => vi.advanceTimersByTime(10_000));
    expect(raf).not.toHaveBeenCalled();
  });

  it('never plays with reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    const { rerender } = render(panel(DEFAULT_LASER_CONFIG));
    rerender(panel({ ...DEFAULT_LASER_CONFIG, trail: 'long' }));
    act(() => vi.advanceTimersByTime(50));
    expect(state()).toBe('still');
  });
});
