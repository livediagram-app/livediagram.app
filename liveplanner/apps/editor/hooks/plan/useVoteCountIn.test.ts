// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup } from '@liveplanner/items';
import { useVoteCountIn } from './useVoteCountIn';

// docs/specs/012-collaboration/session-tools.md "Count In": the open tab's boards' Votes fields.
const poll = {
  ...ITEM_TYPES[1],
  id: 'poll',
  fields: ['title', 'votes', 'f-pri'],
  custom: [{ id: 'f-pri', label: 'Priority Vote', kind: 'votes' as const }],
};
// A board that takes every type.
const board = {
  id: 'b',
  type: 'shape',
  shape: 'plan-board',
  planBoard: { ...presetSetup('kanban'), addTypes: undefined },
};
let elements: unknown[] = [];

vi.mock('@/app/project/[id]/EditorContext', () => ({
  useEditorContext: () => ({
    activeTab: { elements },
    plan: { context: { types: [...ITEM_TYPES, poll] } },
  }),
}));

describe('useVoteCountIn', () => {
  it('offers the Votes fields of the types the tab’s boards take, none without a board', () => {
    elements = [board, { id: 't', type: 'text' }];
    expect(renderHook(() => useVoteCountIn()).result.current).toEqual([
      { id: 'votes', label: 'Votes' },
      { id: 'f-pri', label: 'Priority Vote' },
    ]);
    elements = [];
    expect(renderHook(() => useVoteCountIn()).result.current).toEqual([]);
  });
});
