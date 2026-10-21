import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/document';
import { typesOrphanedBy } from './board-delete';

// docs/specs/026-plan/plan-board.md "Deleting a board".
const board = (id: string, addTypes?: string[], archive = false) => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  planBoard: {
    title: id,
    columns: [{ id: 'c', name: 'C', status: 's' }],
    ...(addTypes ? { addTypes } : {}),
    ...(archive ? { archive: true } : {}),
  },
});
const tabs = (...boards: { tab: string; el: ReturnType<typeof board> }[]) =>
  ['a', 'b'].map((id) => ({
    id,
    name: id,
    elements: boards.filter((x) => x.tab === id).map((x) => x.el),
  })) as unknown as Tab[];
const all = ['task', 'bug', 'idea'];

describe('typesOrphanedBy', () => {
  it('names the types the deleted board shows that no other board does', () => {
    const t = tabs(
      { tab: 'a', el: board('x', ['task', 'bug']) },
      { tab: 'b', el: board('y', ['bug']) },
    );
    expect(typesOrphanedBy(t, 'a', new Set(['x']), all)).toEqual(['task']);
  });

  it('names every type for a board showing all, while no other board does', () => {
    const t = tabs({ tab: 'a', el: board('x') }, { tab: 'b', el: board('y', ['idea']) });
    expect(typesOrphanedBy(t, 'a', new Set(['x']), all)).toEqual(['task', 'bug']);
  });

  it('names none while another board shows every type, or an Archive board lists any card', () => {
    expect(
      typesOrphanedBy(
        tabs({ tab: 'a', el: board('x', ['task']) }, { tab: 'b', el: board('y') }),
        'a',
        new Set(['x']),
        all,
      ),
    ).toEqual([]);
    expect(
      typesOrphanedBy(
        tabs({ tab: 'a', el: board('x', ['task']) }, { tab: 'b', el: board('y', ['idea'], true) }),
        'a',
        new Set(['x']),
        all,
      ),
    ).toEqual([]);
  });

  it('names none for a delete that takes no board', () => {
    expect(
      typesOrphanedBy(tabs({ tab: 'a', el: board('x', ['task']) }), 'a', new Set(['z']), all),
    ).toEqual([]);
  });
});

describe('deleting a whole tab', () => {
  it('names the types its boards show that no board on another tab (or a dashboard) does', () => {
    const t = tabs(
      { tab: 'b', el: board('x', ['task', 'idea']) },
      { tab: 'a', el: board('y', ['task']) },
    );
    expect(typesOrphanedBy(t, 'b', new Set(['x']), all)).toEqual(['idea']);
    expect(typesOrphanedBy(t, 'a', new Set(['y']), all)).toEqual([]);
  });
});
