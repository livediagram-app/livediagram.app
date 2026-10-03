// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livediagram/document';
import { resetDragPreviewForTests, subscribeDragPreview } from '@/lib/drag-preview';
import { renderHook } from '@testing-library/react';
import { useDragPreview } from '@/lib/drag-preview';
import {
  PEER_PREVIEW_EXPIRY_MS,
  endPeerDragPreview,
  prunePeerDragPreviews,
  receivePeerDragPreview,
  resetPeerDragPreviewsForTests,
} from './peer-drag-previews';

// docs/specs/008-canvas/drag-preview.md "Live movement for collaborators".

const a = createShape('square', 0, 0);
const doc = [a];
const role = (r: string | undefined) => () => r;
const drawn = () => renderHook(() => useDragPreview('t', doc)).result.current;
const move = (x: number) => ({
  kind: 'drag-preview' as const,
  tabId: 't',
  patches: [{ id: a.id, x }],
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  resetPeerDragPreviewsForTests();
  resetDragPreviewForTests();
});

describe("a collaborator's drag preview", () => {
  it('is drawn from an editor', () => {
    receivePeerDragPreview('p1', move(90), role('edit'));
    expect((drawn()?.changed.get(a.id) as { x: number }).x).toBe(90);
  });

  it('is ignored from anyone who may only view, or whose role is unknown', () => {
    receivePeerDragPreview('p1', move(90), role('view'));
    receivePeerDragPreview('p2', move(90), role(undefined));
    expect(drawn()).toBeNull();
  });

  it('ends on the end message', () => {
    receivePeerDragPreview('p1', move(90), role('edit'));
    receivePeerDragPreview('p1', { kind: 'drag-preview', tabId: 't', end: true }, role('edit'));
    expect(drawn()).toBeNull();
  });

  it('ends when the real change arrives from the dragger', () => {
    receivePeerDragPreview('p1', move(90), role('edit'));
    endPeerDragPreview('p1');
    expect(drawn()).toBeNull();
  });

  it('expires when the dragger goes quiet, and not while they keep sending', () => {
    receivePeerDragPreview('p1', move(90), role('edit'));
    vi.advanceTimersByTime(PEER_PREVIEW_EXPIRY_MS - 100);
    receivePeerDragPreview('p1', move(95), role('edit'));
    vi.advanceTimersByTime(PEER_PREVIEW_EXPIRY_MS - 100);
    expect(drawn()).not.toBeNull();
    vi.advanceTimersByTime(100);
    expect(drawn()).toBeNull();
  });

  it('goes with a dragger who leaves', () => {
    receivePeerDragPreview('p1', move(90), role('edit'));
    receivePeerDragPreview('p2', move(50), role('edit'));
    prunePeerDragPreviews(new Set(['p2']));
    expect((drawn()?.changed.get(a.id) as { x: number }).x).toBe(50);
  });

  it('drops a malformed op whole', () => {
    let changes = 0;
    const off = subscribeDragPreview(() => (changes += 1));
    receivePeerDragPreview(
      'p1',
      { kind: 'drag-preview', tabId: 't', patches: [{ id: a.id, x: 'far' }] } as never,
      role('edit'),
    );
    receivePeerDragPreview('p1', { kind: 'drag-preview', patches: [] } as never, role('edit'));
    off();
    expect(changes).toBe(0);
    expect(drawn()).toBeNull();
  });
});
