// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { DRAG_PREVIEW_MAX_ELEMENTS, DRAG_PREVIEW_MAX_RIDE_IDS } from '@livehuddle/api-schema';
import {
  clearLocalPreview,
  overlayBetween,
  resetDragPreviewForTests,
  setLocalPreview,
} from '@/lib/drag-preview';
import {
  DRAG_PREVIEW_RIDE_IDS_MS,
  DRAG_PREVIEW_SEND_MS,
  rideOf as rideOfOverlay,
  useDragPreviewBroadcast,
} from './useDragPreviewBroadcast';

// docs/specs/008-canvas/drag-preview.md "Live movement for collaborators": the dragger's preview goes to
// the room as presence, at most every 33 ms, geometry only, then an end message.

const a = { ...createShape('square', 0, 0), id: 'a', label: 'secret' };
const b = { ...createShape('square', 400, 0), id: 'b' };
// A stored (retired) arrow between them: a drag never writes it.
const ab = {
  id: 'ab',
  type: 'arrow',
  from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
  to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
} as Element;
const doc: Element[] = [a, b, ab];

function setup(live = true) {
  const sent: unknown[] = [];
  const roomRef = { current: { send: (msg: unknown) => sent.push(msg) } };
  renderHook(() => useDragPreviewBroadcast({ roomRef, live, activeId: 't' }));
  return sent;
}
const ops = (sent: unknown[]) => sent.map((m) => (m as { op: unknown }).op);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  resetDragPreviewForTests();
});

describe('useDragPreviewBroadcast', () => {
  it('sends the changed geometry, throttled, then the end', () => {
    const sent = setup();
    act(() => setLocalPreview('t', [{ ...a, x: 10 }, b, ab], doc));
    act(() => setLocalPreview('t', [{ ...a, x: 20 }, b, ab], doc));
    act(() => setLocalPreview('t', [{ ...a, x: 30 }, b, ab], doc));
    expect(ops(sent)).toEqual([
      {
        kind: 'drag-preview',
        tabId: 't',
        patches: [{ id: 'a', x: 10, y: 0, width: a.width, height: a.height }],
      },
    ]);
    act(() => {
      vi.advanceTimersByTime(DRAG_PREVIEW_SEND_MS);
    });
    expect(ops(sent).at(-1)).toEqual({
      kind: 'drag-preview',
      tabId: 't',
      patches: [{ id: 'a', x: 30, y: 0, width: a.width, height: a.height }],
    });
    act(() => clearLocalPreview());
    expect(ops(sent).at(-1)).toEqual({ kind: 'drag-preview', tabId: 't', end: true });
  });

  it('sends nothing for a large gesture that does not only move, nor in a document nobody shares', () => {
    const many = Array.from({ length: DRAG_PREVIEW_MAX_ELEMENTS + 1 }, (_, i) => ({
      ...createShape('square', i, 0),
      id: `e${i}`,
    }));
    const sent = setup();
    act(() =>
      setLocalPreview(
        't',
        many.map((el) => ({ ...el, width: 9 })),
        many,
      ),
    );
    expect(sent).toEqual([]);
    const quiet = setup(false);
    act(() => setLocalPreview('t', [{ ...a, x: 10 }, b, ab], doc));
    expect(quiet).toEqual([]);
  });
});

describe('a very large move', () => {
  const N = DRAG_PREVIEW_MAX_ELEMENTS + 10;
  const many = Array.from({ length: N }, (_, i) => ({
    ...createShape('square', i * 10, 0),
    id: `e${i}`,
  }));
  const board: Element[] = [...many];
  const moved = (dx: number, dy: number, { resized = -1, skip = -1 } = {}) => [
    ...many.map((el, i) =>
      i === skip
        ? el
        : i === resized
          ? { ...el, x: el.x + dx, y: el.y + dy, width: 1 }
          : { ...el, x: el.x + dx, y: el.y + dy },
    ),
  ];
  type Ride = { dx: number; dy: number; ids?: string[]; patches: { id: string }[] };
  const rideOf = (op: unknown) => (op as { ride: Ride }).ride;

  it('sends one offset with the riding ids, and the patches of what does not ride', () => {
    const sent = setup();
    act(() => setLocalPreview('t', moved(5, 3, { resized: 2 }), board));
    const [op] = ops(sent);
    expect(op).not.toHaveProperty('patches');
    const ride = rideOf(op);
    expect(ride).toMatchObject({ dx: 5, dy: 3 });
    expect(ride.ids).toHaveLength(N - 1);
    expect(ride.ids).not.toContain('e2');
    expect(ride.patches.map((p) => p.id)).toEqual(['e2']);
  });

  it('names the ids again only when they change or a second has passed', () => {
    const sent = setup();
    act(() => setLocalPreview('t', moved(5, 3), board));
    act(() => {
      vi.advanceTimersByTime(DRAG_PREVIEW_SEND_MS);
    });
    act(() => setLocalPreview('t', moved(6, 3), board));
    expect(rideOf(ops(sent).at(-1))).toEqual({ dx: 6, dy: 3, patches: [] });
    act(() => {
      vi.advanceTimersByTime(DRAG_PREVIEW_SEND_MS);
    });
    act(() => setLocalPreview('t', moved(7, 3, { skip: 0 }), board));
    expect(rideOf(ops(sent).at(-1)).ids).toHaveLength(N - 1);
    act(() => {
      vi.advanceTimersByTime(DRAG_PREVIEW_RIDE_IDS_MS);
    });
    act(() => setLocalPreview('t', moved(8, 3, { skip: 0 }), board));
    expect(rideOf(ops(sent).at(-1)).ids).toHaveLength(N - 1);
    // The gesture ends; the next one names its ids on its first message.
    act(() => clearLocalPreview('landed'));
    act(() => {
      vi.advanceTimersByTime(DRAG_PREVIEW_SEND_MS);
    });
    act(() => setLocalPreview('t', moved(1, 1), board));
    expect(rideOf(ops(sent).at(-1)).ids).toHaveLength(N);
  });

  it('names the ids again after a gesture that shrank to patches grows back', () => {
    const sent = setup();
    act(() => setLocalPreview('t', moved(5, 3), board));
    act(() => {
      vi.advanceTimersByTime(DRAG_PREVIEW_SEND_MS);
    });
    act(() => setLocalPreview('t', [{ ...many[0]!, x: 99 }, ...many.slice(1)], board));
    expect(ops(sent).at(-1)).toHaveProperty('patches');
    act(() => {
      vi.advanceTimersByTime(DRAG_PREVIEW_SEND_MS);
    });
    act(() => setLocalPreview('t', moved(5, 3), board));
    expect(rideOf(ops(sent).at(-1)).ids).toHaveLength(N);
  });
});

describe('rideOf', () => {
  it('rides the offset most elements share and patches the rest, or nothing when nothing rides', () => {
    const els = Array.from({ length: 5 }, (_, i) => ({
      ...createShape('square', i, 0),
      id: `e${i}`,
    }));
    const next = els.map((el, i) => ({ ...el, x: el.x + (i < 3 ? 4 : 9) }));
    const overlay = overlayBetween('t', next, els);
    const ride = rideOfOverlay(overlay, els)!;
    expect(ride.offset).toEqual({ dx: 4, dy: 0 });
    expect(ride.ids).toEqual(['e0', 'e1', 'e2']);
    expect(ride.patches.map((p) => p.id)).toEqual(['e3', 'e4']);
    const resized = overlayBetween(
      't',
      els.map((el) => ({ ...el, width: 1 })),
      els,
    );
    expect(rideOfOverlay(resized, els)).toBeNull();
  });

  it('sends nothing when the rest are too many to patch, or the ids too many to name', () => {
    const count = DRAG_PREVIEW_MAX_ELEMENTS * 2 + 2;
    const els = Array.from({ length: count }, (_, i) => ({
      ...createShape('square', i, 0),
      id: `e${i}`,
    }));
    // Half ride one offset, half another: the rest are more than a patch each may carry.
    const split = els.map((el, i) => ({ ...el, x: el.x + (i % 2 ? 4 : 9) }));
    expect(rideOfOverlay(overlayBetween('t', split, els), els)).toBeNull();
    const huge = Array.from({ length: DRAG_PREVIEW_MAX_RIDE_IDS + 1 }, (_, i) => ({
      ...createShape('square', i, 0),
      id: `h${i}`,
    }));
    const all = huge.map((el) => ({ ...el, x: el.x + 1 }));
    expect(rideOfOverlay(overlayBetween('t', all, huge), huge)).toBeNull();
  });
});

describe('the end message', () => {
  it('says the gesture landed when the preview was committed, not when it was cancelled', () => {
    const sent = setup();
    act(() => setLocalPreview('t', [{ ...a, x: 10 }, b, ab], doc));
    act(() => clearLocalPreview('landed'));
    expect(ops(sent).at(-1)).toEqual({ kind: 'drag-preview', tabId: 't', end: true, landed: true });
    act(() => {
      vi.advanceTimersByTime(DRAG_PREVIEW_SEND_MS);
    });
    act(() => setLocalPreview('t', [{ ...a, x: 20 }, b, ab], doc));
    act(() => clearLocalPreview('cancelled'));
    expect(ops(sent).at(-1)).toEqual({ kind: 'drag-preview', tabId: 't', end: true });
  });
});
