// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_SELECTION_IDS } from '@livediagram/api-schema';
import type { Element, Tab } from '@livediagram/document';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { createOwnElementWrites, holdOwnWrites } from './own-element-writes';
import { WRITE_HOLD_MAX_MS } from './selection-write-hold';
import { usePresenceBroadcast } from './usePresenceBroadcast';

// Selection and tab focus reach every server-stored document's room, personal ones included, so
// peers see who holds what and the api can refuse an agent changeset on what a person holds
// (docs/specs/024-agents/agent-changesets.md "Rooms for personal documents", "Held elements"). The
// selection is read from the store, not the editor's render
// (docs/specs/008-canvas/blueprints/selection-store.md "Above the canvas").

function setup(
  over: { selectedId?: string | null; multi?: string[]; documentServerStored?: boolean } = {},
) {
  const send = vi.fn();
  const selection = createSelectionStore();
  selection.setSelection({
    selectedId: over.selectedId === undefined ? 'a' : over.selectedId,
    multiSelectedIds: new Set(over.multi ?? ['b', 'c']),
  });
  const view = renderHook(
    ({ activeId }) =>
      usePresenceBroadcast({
        hydrated: true,
        documentId: 'd1',
        documentServerStored: over.documentServerStored ?? true,
        selection,
        activeId,
        roomRef: { current: { send } as never },
      }),
    { initialProps: { activeId: 't1' } },
  );
  const ops = () => send.mock.calls.map((c) => (c[0] as { op: Record<string, unknown> }).op);
  const selects = () => ops().filter((op) => op.kind === 'select');
  return { selection, view, ops, selects };
}

describe('usePresenceBroadcast', () => {
  it('sends the whole selection and the tab focus on a personal document', () => {
    expect(setup().ops()).toEqual([
      { kind: 'select', elementId: 'a', tabId: 't1', elementIds: ['b', 'c', 'a'] },
      { kind: 'tab-focus', tabId: 't1' },
    ]);
  });

  it('sends a multi-selection with no primary element', () => {
    expect(setup({ selectedId: null }).ops()[0]).toEqual({
      kind: 'select',
      elementId: null,
      tabId: 't1',
      elementIds: ['b', 'c'],
    });
  });

  it(`caps the selection at ${MAX_SELECTION_IDS} ids`, () => {
    const many = Array.from({ length: MAX_SELECTION_IDS + 10 }, (_, i) => `e${i}`);
    const [select] = setup({ multi: many }).ops();
    expect((select!.elementIds as string[]).length).toBe(MAX_SELECTION_IDS);
  });

  it('sends nothing for a document without a room', () => {
    const { selection, ops } = setup({ documentServerStored: false });
    act(() => selection.setSelectedId('z'));
    expect(ops()).toEqual([]);
  });

  it('sends again on every change of the selection, the multi-selection included', () => {
    const { selection, selects } = setup({ selectedId: null, multi: [] });
    act(() => selection.setSelectedId('a'));
    act(() => selection.setSelection({ selectedId: null, multiSelectedIds: new Set(['a', 'b']) }));
    act(() => selection.setSelection({ selectedId: null, multiSelectedIds: new Set() }));
    expect(selects()).toEqual([
      { kind: 'select', elementId: null, tabId: 't1' },
      { kind: 'select', elementId: 'a', tabId: 't1', elementIds: ['a'] },
      { kind: 'select', elementId: null, tabId: 't1', elementIds: ['a', 'b'] },
      { kind: 'select', elementId: null, tabId: 't1' },
    ]);
  });

  // docs/specs/007-editor/editor-app.md "Held until the holder's change lands" (Work Tracker 659).
  describe('an element we let go of while our change to it has not landed', () => {
    const box = (id: string, x = 0) =>
      ({ id, type: 'shape', shape: 'square', x, y: 0, width: 10, height: 10 }) as Element;
    const tab = (...elements: Element[]): Tab => ({ id: 't1', name: 'T', elements });

    function holding() {
      vi.useFakeTimers();
      const send = vi.fn();
      const selection = createSelectionStore();
      selection.setSelection({ selectedId: 'a', multiSelectedIds: new Set(['b']) });
      const writing = {
        tabs: { current: [tab(box('a', 150), box('b'))] },
        baseline: { current: [tab(box('a'), box('b'))] },
        writes: createOwnElementWrites(),
      };
      const view = renderHook(() =>
        usePresenceBroadcast({
          hydrated: true,
          documentId: 'd1',
          documentServerStored: true,
          selection,
          activeId: 't1',
          roomRef: { current: { send } as never },
          writing,
        }),
      );
      const selects = () =>
        send.mock.calls
          .map((c) => (c[0] as { op: Record<string, unknown> }).op)
          .filter((op) => op.kind === 'select');
      return { selection, writing, view, selects };
    }
    afterEach(() => vi.useRealTimers());

    it('holds it until the save lands, then sends the selection without it', () => {
      const { selection, writing, selects } = holding();
      const release = holdOwnWrites(writing.writes, 't1', [{ kind: 'update', element: box('a') }]);
      act(() => selection.setSelection({ selectedId: null, multiSelectedIds: new Set() }));
      // `a` was moved and its save waits for the room: still held. `b` is as saved: let go.
      expect(selects().at(-1)).toEqual({
        kind: 'select',
        elementId: null,
        tabId: 't1',
        elementIds: ['a'],
      });
      // The save landed: the baseline has the move and the room has sequenced it.
      writing.baseline.current = writing.tabs.current;
      act(() => release());
      act(() => void vi.advanceTimersByTime(0));
      expect(selects().at(-1)).toEqual({ kind: 'select', elementId: null, tabId: 't1' });
      // Nothing more is held, so another release sends nothing.
      const sent = selects().length;
      act(() => holdOwnWrites(writing.writes, 't1', [])());
      act(() => void vi.advanceTimersByTime(0));
      expect(selects()).toHaveLength(sent);
    });

    it('keeps the selection and the held element apart, and a release that frees nothing sends nothing', () => {
      const { selection, writing, selects } = holding();
      act(() => selection.setSelection({ selectedId: 'b', multiSelectedIds: new Set() }));
      expect(selects().at(-1)).toEqual({
        kind: 'select',
        elementId: 'b',
        tabId: 't1',
        elementIds: ['b', 'a'],
      });
      const sent = selects().length;
      act(() => holdOwnWrites(writing.writes, 't1', [])());
      act(() => void vi.advanceTimersByTime(0));
      expect(selects()).toHaveLength(sent);
    });

    it(`holds it no longer than ${WRITE_HOLD_MAX_MS} ms, and stops listening when unmounted`, () => {
      const { selection, writing, view, selects } = holding();
      act(() => selection.setSelection({ selectedId: null, multiSelectedIds: new Set() }));
      expect(selects().at(-1)!.elementIds).toEqual(['a']);
      act(() => void vi.advanceTimersByTime(WRITE_HOLD_MAX_MS));
      expect(selects().at(-1)).toEqual({ kind: 'select', elementId: null, tabId: 't1' });
      act(() => selection.setSelection({ selectedId: 'a', multiSelectedIds: new Set() }));
      act(() => selection.setSelection({ selectedId: null, multiSelectedIds: new Set() }));
      view.unmount();
      expect(writing.writes.released.size).toBe(0);
    });
  });

  it('sends the selection again, with the new tab, on a tab switch', () => {
    const { view, selects } = setup();
    view.rerender({ activeId: 't2' });
    expect(selects().at(-1)).toEqual({
      kind: 'select',
      elementId: 'a',
      tabId: 't2',
      elementIds: ['b', 'c', 'a'],
    });
  });
});
