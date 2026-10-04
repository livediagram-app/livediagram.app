// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createSelectionStore } from '@/lib/selection-store';
import { usePresenceBroadcast } from './usePresenceBroadcast';

// docs/specs/007-editor/live-app.md: peers learn our selection (the badge and the selection lock) and the
// tab we are on. The selection is read from the store, not from the editor's render
// (docs/specs/008-canvas/blueprints/selection-store.md "Above the canvas").

function setup(shared = true) {
  const send = vi.fn();
  const selection = createSelectionStore();
  const roomRef = { current: { send } } as never;
  const view = renderHook(
    ({ activeId }) =>
      usePresenceBroadcast({
        hydrated: true,
        documentId: 'd',
        documentShareable: shared,
        documentTeamId: null,
        selection,
        activeId,
        roomRef,
      }),
    { initialProps: { activeId: 't1' } },
  );
  const selects = () =>
    send.mock.calls
      .map(([m]) => m.op)
      .filter((op) => op.kind === 'select')
      .map((op) => `${op.elementId}@${op.tabId}`);
  return { selection, selects, view };
}

describe('usePresenceBroadcast', () => {
  it('sends the selection once the room is open, then on every change of the selected element', () => {
    const { selection, selects } = setup();
    expect(selects()).toEqual(['null@t1']);

    act(() => selection.setSelectedId('a'));
    act(() => selection.setSelectedId(null));

    expect(selects()).toEqual(['null@t1', 'a@t1', 'null@t1']);
  });

  it('does not send for a change of the multi-selection alone', () => {
    const { selection, selects } = setup();
    act(() => selection.setMultiSelectedIds(new Set(['a', 'b'])));
    expect(selects()).toEqual(['null@t1']);
  });

  it('sends again, with the new tab, on a tab switch', () => {
    const { selection, selects, view } = setup();
    act(() => selection.setSelectedId('a'));
    view.rerender({ activeId: 't2' });
    expect(selects().at(-1)).toBe('a@t2');
  });

  it('sends nothing for a document that is not shared', () => {
    const { selection, selects } = setup(false);
    act(() => selection.setSelectedId('a'));
    expect(selects()).toEqual([]);
  });
});
