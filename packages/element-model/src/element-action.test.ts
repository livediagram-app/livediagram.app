import { describe, expect, it } from 'vitest';
import {
  ACTION_CARD_MAX,
  ACTION_STATUS_LABELS,
  capElementActions,
  createElementAction,
  elementActions,
  isClosedAction,
  isOpenAction,
  type ElementAction,
} from './element-action';

// docs/specs/012-collaboration/assigned-actions.md. Each product's own test reads the actions through its
// comments.ts (an undo keeps them); these read the shared module alone.
const action = (over: Partial<ElementAction> = {}): ElementAction => ({
  ...createElementAction({
    name: 'Write the brief',
    description: '',
    assignee: { userId: 'u1', name: 'Sam' },
    teamId: null,
    assigner: { id: 'u2', name: 'Alex' },
  }),
  ...over,
});

describe('createElementAction', () => {
  it('starts open, stamped now, with the assigner denormalised', () => {
    const before = Date.now();
    const a = action();
    expect(a.status).toBe('open');
    expect(a.assignerId).toBe('u2');
    expect(a.assignerName).toBe('Alex');
    expect(a.createdAt).toBeGreaterThanOrEqual(before);
    expect(a.updatedAt).toBe(a.createdAt);
    expect(a.id).not.toBe(action().id);
  });
});

describe('elementActions', () => {
  it('reads a list, a lone action as a one-item list, or none', () => {
    const a = action();
    const b = action();
    expect(elementActions({ actions: [a, b] })).toEqual([a, b]);
    expect(elementActions({ action: a })).toEqual([a]);
    expect(elementActions({})).toEqual([]);
  });
});

describe('capElementActions', () => {
  it('trims a list past the cap and hands back the same array when none is', () => {
    const many = Array.from({ length: ACTION_CARD_MAX + 3 }, () => action());
    const within = [{ actions: [action()] }, { label: 'no actions' }];
    expect(capElementActions(within)).toBe(within);
    const [capped] = capElementActions([{ actions: many }]);
    expect(capped!.actions).toHaveLength(ACTION_CARD_MAX);
  });
});

describe('isOpenAction and isClosedAction', () => {
  it('tells an open action from a done or dropped one', () => {
    expect(isOpenAction(action())).toBe(true);
    expect(isOpenAction(action({ status: 'done' }))).toBe(false);
    expect(isOpenAction(undefined)).toBe(false);
    expect(isClosedAction({ status: 'wont-do' })).toBe(true);
    expect(isClosedAction({ status: 'open' })).toBe(false);
  });

  it('labels every status', () => {
    expect(ACTION_STATUS_LABELS).toEqual({ open: 'Open', done: 'Done', 'wont-do': 'Won’t Do' });
  });
});
