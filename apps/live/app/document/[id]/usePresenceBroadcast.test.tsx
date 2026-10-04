// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MAX_SELECTION_IDS } from '@livediagram/api-schema';
import { usePresenceBroadcast } from './usePresenceBroadcast';

// Selection and tab focus reach every server-stored document's room, personal ones included, so
// the api can refuse an agent changeset on what a person holds
// (docs/specs/024-agents/agent-changesets.md "Rooms for personal documents", "Held elements").

function render(over: Partial<Parameters<typeof usePresenceBroadcast>[0]> = {}) {
  const send = vi.fn();
  renderHook(() =>
    usePresenceBroadcast({
      hydrated: true,
      documentId: 'd1',
      documentServerStored: true,
      selectedId: 'a',
      multiSelectedIds: new Set(['b', 'c']),
      activeId: 't1',
      roomRef: { current: { send } as never },
      ...over,
    }),
  );
  return send.mock.calls.map((c) => (c[0] as { op: Record<string, unknown> }).op);
}

describe('usePresenceBroadcast', () => {
  it('sends the whole selection and the tab focus on a personal document', () => {
    expect(render()).toEqual([
      { kind: 'select', elementId: 'a', tabId: 't1', elementIds: ['b', 'c', 'a'] },
      { kind: 'tab-focus', tabId: 't1' },
    ]);
  });

  it('sends a multi-selection with no primary element', () => {
    expect(render({ selectedId: null })[0]).toEqual({
      kind: 'select',
      elementId: null,
      tabId: 't1',
      elementIds: ['b', 'c'],
    });
  });

  it(`caps the selection at ${MAX_SELECTION_IDS} ids`, () => {
    const many = new Set(Array.from({ length: MAX_SELECTION_IDS + 10 }, (_, i) => `e${i}`));
    const [select] = render({ multiSelectedIds: many });
    expect((select!.elementIds as string[]).length).toBe(MAX_SELECTION_IDS);
  });

  it('sends nothing for a document without a room', () => {
    expect(render({ documentServerStored: false })).toEqual([]);
  });
});
