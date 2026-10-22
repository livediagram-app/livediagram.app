// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { railShown } from '@/lib/photo-editor/rail-shown';
import { PHOTO_FRAME_WAIT_MS, usePhotoFraming } from './usePhotoFraming';

// docs/specs/031-photo/photo-pages.md "Working on a photo page": a photo page frames below its tools and the room under them.
let now = 0;
beforeEach(() => {
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  // A frame is a timer: the waiting loop yields between frames.
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (fn) => setTimeout(() => fn(now), 0) as unknown as number,
  );
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => clearTimeout(id));
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const chrome = () => {
  for (const attr of ['data-photo-rail', 'data-photo-options']) {
    const el = document.createElement('div');
    el.setAttribute(attr, '');
    document.body.append(el);
  }
};
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('a photo page’s framing', () => {
  it('waits for the rail and panel, frames once, and frames again when the person joins', async () => {
    const focusPage = vi.fn();
    const { rerender } = renderHook(
      ({ canEdit, canInspect }) => usePhotoFraming('pg', focusPage, canEdit, canInspect),
      { initialProps: { canEdit: false, canInspect: false } },
    );
    // A viewer has no rail: framed after the wait.
    await settle();
    expect(focusPage).not.toHaveBeenCalled();
    now = PHOTO_FRAME_WAIT_MS + 1;
    await settle();
    await settle();
    expect(focusPage).toHaveBeenCalledTimes(1);
    rerender({ canEdit: false, canInspect: false });
    await settle();
    expect(focusPage).toHaveBeenCalledTimes(1);

    // Joined: the rail and panel come, and the page frames beside them.
    now = 0;
    rerender({ canEdit: true, canInspect: true });
    await settle();
    expect(focusPage).toHaveBeenCalledTimes(1);
    chrome();
    await settle();
    await settle();
    expect(focusPage).toHaveBeenCalledTimes(2);
    expect(focusPage).toHaveBeenLastCalledWith('pg');
  });

  it('frames again when the rail first shows, the page in focus behind a Join prompt', async () => {
    const focusPage = vi.fn();
    renderHook(() => usePhotoFraming('pg', focusPage, true, true));
    now = PHOTO_FRAME_WAIT_MS + 1;
    await settle();
    await settle();
    expect(focusPage).toHaveBeenCalledTimes(1);
    now = 0;
    chrome();
    let unmount = () => {};
    act(() => {
      unmount = railShown.mount();
    });
    await settle();
    await settle();
    expect(focusPage).toHaveBeenCalledTimes(2);
    act(() => unmount());
    expect(railShown.get()).toBe(false);
  });

  it('frames on the next visit when a wait was cut short', async () => {
    const focusPage = vi.fn();
    const props: { page: string | null } = { page: 'pg' };
    const { rerender } = renderHook(({ page }) => usePhotoFraming(page, focusPage, true, true), {
      initialProps: props,
    });
    rerender({ page: null });
    chrome();
    rerender({ page: 'pg' });
    await settle();
    await settle();
    expect(focusPage).toHaveBeenCalledTimes(1);
  });
});

describe('a photo page’s framing, re-rendered', () => {
  it('is not put off by a new focusPage each render', async () => {
    const calls: string[] = [];
    chrome();
    const { rerender } = renderHook(
      ({ n }) => usePhotoFraming('pg', (id) => calls.push(`${id}:${n}`), true, true),
      { initialProps: { n: 0 } },
    );
    // Renders faster than frames: each brings a new function.
    for (let n = 1; n < 5; n++) rerender({ n });
    await settle();
    await settle();
    expect(calls).toEqual(['pg:4']);
  });
});
