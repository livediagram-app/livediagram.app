// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinnedArrow, createShape, type Element } from '@livediagram/document';
import { DRAG_PREVIEW_MAX_ELEMENTS } from '@livediagram/api-schema';
import { clearLocalPreview, resetDragPreviewForTests, setLocalPreview } from '@/lib/drag-preview';
import { DRAG_PREVIEW_SEND_MS, useDragPreviewBroadcast } from './useDragPreviewBroadcast';

// docs/specs/008-canvas/drag-preview.md "Live movement for collaborators": the dragger's preview goes to
// the room as presence, at most every 33 ms, geometry only, then an end message.

const a = { ...createShape('square', 0, 0), id: 'a', label: 'secret' };
const b = { ...createShape('square', 400, 0), id: 'b' };
const ab = { ...createPinnedArrow('a', 'e', 'b', 'w'), id: 'ab' };
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
    act(() => vi.advanceTimersByTime(DRAG_PREVIEW_SEND_MS));
    expect(ops(sent).at(-1)).toEqual({
      kind: 'drag-preview',
      tabId: 't',
      patches: [{ id: 'a', x: 30, y: 0, width: a.width, height: a.height }],
    });
    act(() => clearLocalPreview());
    expect(ops(sent).at(-1)).toEqual({ kind: 'drag-preview', tabId: 't', end: true });
  });

  it("sends an arrow's geometry only", () => {
    const sent = setup();
    const bent = { ...ab, curveOffset: { dx: 0, dy: 30 }, label: 'not sent' };
    act(() => setLocalPreview('t', [a, b, bent], doc));
    expect(ops(sent)).toEqual([
      {
        kind: 'drag-preview',
        tabId: 't',
        patches: [{ id: 'ab', from: ab.from, to: ab.to, curveOffset: { dx: 0, dy: 30 } }],
      },
    ]);
  });

  it('sends nothing for a gesture too large to preview, nor in a document nobody shares', () => {
    const many = Array.from({ length: DRAG_PREVIEW_MAX_ELEMENTS + 1 }, (_, i) => ({
      ...createShape('square', i, 0),
      id: `e${i}`,
    }));
    const sent = setup();
    act(() =>
      setLocalPreview(
        't',
        many.map((el) => ({ ...el, y: 9 })),
        many,
      ),
    );
    expect(sent).toEqual([]);
    const quiet = setup(false);
    act(() => setLocalPreview('t', [{ ...a, x: 10 }, b, ab], doc));
    expect(quiet).toEqual([]);
  });
});
