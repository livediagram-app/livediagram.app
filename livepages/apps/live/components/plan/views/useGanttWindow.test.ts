// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGanttWindow } from './useGanttWindow';

// docs/specs/026-plan/plan-views.md "Gantt Chart": the viewer's window, pinned while dates are dragged, and a pan
// that leaves no listeners behind.

afterEach(() => {
  // A pan that ended without a click leaves its swallow waiting: spend it so the next test starts clean.
  window.dispatchEvent(new MouseEvent('click'));
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function setup(model: { from: number; to: number; today: number }) {
  const track = document.createElement('div');
  const axis = document.createElement('div');
  const handle = document.createElement('span');
  handle.setAttribute('data-gantt-handle', 'to');
  const draw = document.createElement('span');
  draw.setAttribute('data-gantt-draw', '');
  track.append(axis, handle, draw);
  document.body.append(track);
  track.getBoundingClientRect = () => new DOMRect(0, 0, 350, 200);
  const trackRef = { current: track };
  const hook = renderHook(
    ({ m }) => useGanttWindow({ model: m, trackRef, interactive: true, ready: true }),
    { initialProps: { m: model } },
  );
  return { ...hook, track, axis, handle, draw };
}

const press = (el: Element, x = 100) =>
  act(() => {
    el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: x, bubbles: true }));
  });
const moveTo = (x: number) =>
  act(() => {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x }));
  });
const release = () =>
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup'));
  });

describe('useGanttWindow', () => {
  // A month window over 350 px is 10 px a day.
  it('pans when the timeline body is dragged, earlier to the right and later to the left', () => {
    const { result, track } = setup({ from: 100, to: 127, today: 110 });
    press(track);
    moveTo(150);
    expect(result.current.view.from).toBe(95);
    moveTo(20);
    expect(result.current.view.from).toBe(108);
    release();
    expect(result.current.view.from).toBe(108);
  });

  it('pans from the axis strip too', () => {
    const { result, axis } = setup({ from: 100, to: 127, today: 110 });
    press(axis);
    moveTo(70);
    release();
    expect(result.current.view.from).toBe(103);
  });

  it('keeps a press that stays within the slop a click: no pan, the click still lands', () => {
    const { result, track } = setup({ from: 100, to: 127, today: 110 });
    const clicked = vi.fn();
    track.addEventListener('click', clicked);
    press(track);
    moveTo(102);
    release();
    track.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(result.current.view.from).toBe(100);
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('swallows the click a pan ends in, so it opens no card', () => {
    const { track } = setup({ from: 100, to: 127, today: 110 });
    const clicked = vi.fn();
    track.addEventListener('click', clicked);
    press(track);
    moveTo(160);
    release();
    track.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).not.toHaveBeenCalled();
  });

  it('leaves a bar handle and a row that draws dates to themselves', () => {
    const { result, handle, draw } = setup({ from: 100, to: 127, today: 110 });
    for (const el of [handle, draw]) {
      press(el);
      moveTo(200);
      release();
    }
    expect(result.current.view.from).toBe(100);
  });

  it('keeps a body press from the canvas', () => {
    const { track } = setup({ from: 100, to: 127, today: 110 });
    const canvas = vi.fn();
    document.body.addEventListener('pointerdown', canvas);
    press(track);
    release();
    expect(canvas).not.toHaveBeenCalled();
  });

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
