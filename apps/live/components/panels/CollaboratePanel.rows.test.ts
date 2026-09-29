import { describe, expect, it } from 'vitest';
import {
  createElementAction,
  createShape,
  type BoxedElement,
  type ElementAction,
} from '@livediagram/document';
import { actionRowsFromElements } from './CollaboratePanel';
import { rowsFor } from './collaborate/collaborate-model';

// Every action on the tab is a row (docs/specs/012-collaboration/assigned-actions.md §5), read through
// elementActions: an Action panel card's list (docs/specs/012-collaboration/action-panel.md) and an ordinary
// element's single action alike. The bug this pins: a card's rows vanished
// once its list lived in `actions`, so an action completed then reopened
// never came back.

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

const card = (actions: ElementAction[]): BoxedElement =>
  ({ ...createShape('action-card', 0, 0), id: 'card', actions }) as unknown as BoxedElement;

const openIds = (els: BoxedElement[]) =>
  rowsFor('open', 'all', [], actionRowsFromElements(els, null)).map((r) =>
    r.kind === 'action' ? r.action.actionName : null,
  );

describe('actionRowsFromElements', () => {
  it('lists every action on a card, one row each, keyed by action id', () => {
    const a = mk('First');
    const b = mk('Second');
    const rows = actionRowsFromElements([card([a, b])], null);
    expect(rows.map((r) => [r.elementId, r.actionId])).toEqual(
      expect.arrayContaining([
        ['card', a.id],
        ['card', b.id],
      ]),
    );
  });

  it('keeps a completed-then-reopened card action listed (Open, Resolved, Open)', () => {
    const a = mk('First');
    expect(openIds([card([a])])).toEqual(['First']);
    const done = card([{ ...a, status: 'done' }]);
    expect(openIds([done])).toEqual([]);
    expect(rowsFor('resolved', 'all', [], actionRowsFromElements([done], null)).length).toBe(1);
    expect(openIds([card([{ ...a, status: 'open' }])])).toEqual(['First']);
  });

  it('still lists a legacy single `action` on a card or a plain element', () => {
    const legacyCard = {
      ...createShape('action-card', 0, 0),
      id: 'old',
      action: mk('Legacy'),
    } as unknown as BoxedElement;
    const plain = { ...createShape('square', 0, 0), id: 'sq', action: mk('Plain') } as BoxedElement;
    expect(
      actionRowsFromElements([legacyCard, plain], null)
        .map((r) => r.actionName)
        .sort(),
    ).toEqual(['Legacy', 'Plain']);
  });
});
