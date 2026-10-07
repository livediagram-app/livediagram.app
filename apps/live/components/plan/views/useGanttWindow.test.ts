// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGanttWindow } from './useGanttWindow';

// docs/specs/026-plan/plan-views.md "Gantt Chart": the viewer's window, pinned while dates are dragged, and a pan
// that leaves no listeners behind.

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function setup(model: { from: number; to: number; today: number }) {
  const track = document.createElement('div');
  const axis = document.createElement('div');
  document.body.append(track, axis);
  track.getBoundingClientRect = () => new DOMRect(0, 0, 350, 200);
  const trackRef = { current: track };
  const axisRef = { current: axis };
  const hook = renderHook(
    ({ m }) => useGanttWindow({ model: m, trackRef, axisRef, interactive: true, ready: true }),
    { initialProps: { m: model } },
  );
  return { ...hook, axis };
}

describe('useGanttWindow', () => {
  it('follows the cards until pinned, then holds the window and scale', () => {
    const { result, rerender } = setup({ from: 100, to: 127, today: 110 });
    expect(result.current.view.from).toBe(100);
    expect(result.current.scale).toBe('month');
    // Unpinned, a change to the cards' dates moves the window with them.
    rerender({ m: { from: 90, to: 120, today: 110 } });
    expect(result.current.view.from).toBe(90);
    expect(result.current.scale).toBe('month');
    act(() => result.current.pin());
    // Pinned (a drag began), the window and scale stay put however the dates move.
    rerender({ m: { from: 40, to: 300, today: 110 } });
    expect(result.current.view.from).toBe(90);
    expect(result.current.scale).toBe('month');
  });

  it('leaves no window listeners behind when it goes mid-pan', () => {
    const { axis, unmount } = setup({ from: 100, to: 127, today: 110 });
    const removed = vi.spyOn(window, 'removeEventListener');
    axis.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 10, bubbles: true }));
    unmount();
    const gone = removed.mock.calls.map((c) => c[0]);
    expect(gone).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']));
  });
});
