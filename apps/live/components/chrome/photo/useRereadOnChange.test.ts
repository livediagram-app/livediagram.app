// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import { REREAD_DELAY_MS, useRereadOnChange } from './useRereadOnChange';

// A box that is moved, resized or drawn is read again (spec/139 Phase 9):
// 8 seconds after the LAST change, every changed box in one batch.

const box = (id: number, over: Partial<DetectedSticky> = {}): DetectedSticky => ({
  id,
  kind: 'domain-event',
  size: 'square',
  x: 10 * id,
  y: 10,
  w: 50,
  h: 50,
  row: 0,
  order: id,
  confidence: 1,
  ...over,
});

const detected = [box(0), box(1), box(2)];

function setup(skip: (id: number) => boolean = () => false) {
  const onReread = vi.fn();
  const view = renderHook(
    ({ boxes }: { boxes: DetectedSticky[] }) =>
      useRereadOnChange({ boxes, initial: detected, skip, onReread }),
    { initialProps: { boxes: detected } },
  );
  return { onReread, set: (boxes: DetectedSticky[]) => view.rerender({ boxes }), view };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useRereadOnChange', () => {
  it('reads nothing when nothing changed', () => {
    const h = setup();
    vi.advanceTimersByTime(REREAD_DELAY_MS * 2);
    expect(h.onReread).not.toHaveBeenCalled();
  });

  it('reads a moved box once, 8 seconds after the change', () => {
    const h = setup();
    h.set([box(0, { x: 99 }), box(1), box(2)]);
    vi.advanceTimersByTime(REREAD_DELAY_MS - 1);
    expect(h.onReread).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(h.onReread).toHaveBeenCalledTimes(1);
    expect(h.onReread.mock.calls[0]![0].map((b: DetectedSticky) => b.id)).toEqual([0]);
    vi.advanceTimersByTime(REREAD_DELAY_MS * 2);
    expect(h.onReread).toHaveBeenCalledTimes(1);
  });

  it('waits for the LAST change, and batches every changed box', () => {
    const h = setup();
    h.set([box(0, { x: 99 }), box(1), box(2)]);
    vi.advanceTimersByTime(REREAD_DELAY_MS - 1000);
    h.set([box(0, { x: 99 }), box(1, { w: 80 }), box(2)]);
    vi.advanceTimersByTime(REREAD_DELAY_MS - 1);
    expect(h.onReread).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(h.onReread.mock.calls[0]![0].map((b: DetectedSticky) => b.id)).toEqual([0, 1]);
  });

  it('does not read a box put back where it was read', () => {
    const h = setup();
    h.set([box(0, { x: 99 }), box(1), box(2)]);
    h.set(detected);
    vi.advanceTimersByTime(REREAD_DELAY_MS);
    expect(h.onReread).not.toHaveBeenCalled();
  });

  it('reads a box the author drew', () => {
    const h = setup();
    h.set([...detected, box(-1, { x: 400 })]);
    vi.advanceTimersByTime(REREAD_DELAY_MS);
    expect(h.onReread.mock.calls[0]![0].map((b: DetectedSticky) => b.id)).toEqual([-1]);
  });

  it('never re-reads a box whose words the author typed', () => {
    const h = setup((id) => id === 0);
    h.set([box(0, { x: 99 }), box(1), box(2)]);
    vi.advanceTimersByTime(REREAD_DELAY_MS);
    expect(h.onReread).not.toHaveBeenCalled();
  });

  it('does not re-read a box whose kind alone changed', () => {
    const h = setup();
    h.set([box(0, { kind: 'command' }), box(1), box(2)]);
    vi.advanceTimersByTime(REREAD_DELAY_MS);
    expect(h.onReread).not.toHaveBeenCalled();
  });

  it('reads a box again only when it changes again', () => {
    const h = setup();
    h.set([box(0, { x: 99 }), box(1), box(2)]);
    vi.advanceTimersByTime(REREAD_DELAY_MS);
    h.set([box(0, { x: 99, kind: 'command' }), box(1), box(2)]);
    vi.advanceTimersByTime(REREAD_DELAY_MS);
    expect(h.onReread).toHaveBeenCalledTimes(1);
    h.set([box(0, { x: 120 }), box(1), box(2)]);
    vi.advanceTimersByTime(REREAD_DELAY_MS);
    expect(h.onReread).toHaveBeenCalledTimes(2);
  });

  it('drops a pending re-read when the review closes', () => {
    const h = setup();
    h.set([box(0, { x: 99 }), box(1), box(2)]);
    h.view.unmount();
    vi.advanceTimersByTime(REREAD_DELAY_MS);
    expect(h.onReread).not.toHaveBeenCalled();
  });
});
