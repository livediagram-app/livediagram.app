// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MAX_SELECTION_IDS } from '@livediagram/api-schema';
import { createSelectionStore } from '@/lib/selection-store';
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
