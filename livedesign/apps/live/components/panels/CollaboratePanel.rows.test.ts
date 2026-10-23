import { describe, expect, it } from 'vitest';
import {
  createElementAction,
  createShape,
  type BoxedElement,
  type ElementAction,
} from '@livedesign/design';
import { actionRowsFromElements } from './CollaboratePanel';
import { rowsFor } from './collaborate/collaborate-model';

// Every action on the tab is a row (docs/specs/012-collaboration/assigned-actions.md §5), read through
// elementActions. The bug this pins: an action completed then reopened never came back.

const mk = (name: string, status: 'open' | 'done' = 'open'): ElementAction => ({
  ...createElementAction({
    name,
    description: '',
    assignee: { userId: 'u', name: 'Sam' },
    teamId: null,
    assigner: { id: 'x', name: 'Priya' },
  }),
  status,
});

const box = (id: string, action: ElementAction): BoxedElement => ({
  ...createShape('square', 0, 0),
  id,
  action,
});

const openNames = (els: BoxedElement[]) =>
  rowsFor('open', 'all', [], actionRowsFromElements(els, null)).map((r) =>
    r.kind === 'action' ? r.action.actionName : null,
  );

describe('actionRowsFromElements', () => {
  it('lists each element’s action, one row each, keyed by action id', () => {
    const a = mk('First');
    const b = mk('Second');
    const rows = actionRowsFromElements([box('one', a), box('two', b)], null);
    expect(rows.map((r) => [r.elementId, r.actionId])).toEqual(
      expect.arrayContaining([
        ['one', a.id],
        ['two', b.id],
      ]),
    );
  });

  it('keeps a completed-then-reopened action listed (Open, Resolved, Open)', () => {
    const a = mk('First');
    expect(openNames([box('one', a)])).toEqual(['First']);
    const done = box('one', { ...a, status: 'done' });
    expect(openNames([done])).toEqual([]);
    expect(rowsFor('resolved', 'all', [], actionRowsFromElements([done], null)).length).toBe(1);
    expect(openNames([box('one', { ...a, status: 'open' })])).toEqual(['First']);
  });
});
