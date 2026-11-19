// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFlatBillboards } from './useFlatBillboards';

// docs/specs/008-canvas/canvas-performance.md "A still Space does nothing" (Work Tracker 1257): the passes that keep the
// overlay's text sharp run only while something moves, and sleep once a pass finds every card where it was.
describe('useFlatBillboards', () => {
  const frames: FrameRequestCallback[] = [];
  const flush = () => {
    const due = frames.splice(0);
    for (const f of due) f(0);
  };
  afterEach(() => {
    vi.restoreAllMocks();
    frames.length = 0;
    document.body.replaceChildren();
  });

  const view = () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((f) => frames.push(f));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const root = document.createElement('div');
    root.setAttribute('data-space-view', '');
    const camera = document.createElement('div');
    camera.setAttribute('data-space-stage', '');
    const overlay = document.createElement('div');
    overlay.setAttribute('data-space-stage', '');
    overlay.setAttribute('data-space-overlay', '');
    const world = document.createElement('div');
    const card = document.createElement('div');
    card.setAttribute('data-space-billboard', '');
    world.append(card);
    overlay.append(world);
    root.append(camera, overlay);
    document.body.append(root);
    return { world, card, ref: { current: world } };
  };

  it('places the cards, passes once more, then sleeps until something under it changes', async () => {
    const { world, card, ref } = view();
    const { unmount } = renderHook(() => useFlatBillboards(ref, 1));
    expect(frames).toHaveLength(1);
    // The first pass places the card, so it looks again next frame.
    flush();
    expect(card.style.getPropertyValue('--space-flat-scale')).not.toBe('');
    // Its own writes wake it once (a mutation); that pass finds nothing moved.
    await Promise.resolve();
    flush();
    await Promise.resolve();
    flush();
    expect(frames).toHaveLength(0);
    // Still: no frames at all.
    await Promise.resolve();
    expect(frames).toHaveLength(0);
    // A new card under the overlay wakes it.
    world.append(Object.assign(document.createElement('div'), { className: 'x' }));
    await Promise.resolve();
    expect(frames).toHaveLength(1);
    // Waking twice before the frame asks for one frame.
    world.append(document.createElement('div'));
    await Promise.resolve();
    expect(frames).toHaveLength(1);
    unmount();
  });

  it('keeps passing while the camera is mid-move', () => {
    const { ref } = view();
    const moving = vi.fn(() => [{} as Animation]);
    const camera = document.querySelector<HTMLElement>(
      '[data-space-stage]:not([data-space-overlay])',
    )!;
    camera.getAnimations = moving;
    renderHook(() => useFlatBillboards(ref, 1));
    flush();
    flush();
    expect(frames).toHaveLength(1);
    moving.mockReturnValue([]);
    flush();
    expect(frames).toHaveLength(0);
  });

  it('does nothing outside the 3D view', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((f) => frames.push(f));
    const world = document.createElement('div');
    document.body.append(world);
    renderHook(() => useFlatBillboards({ current: world }, 1));
    flush();
    expect(frames).toHaveLength(0);
  });
});
