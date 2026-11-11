import { describe, expect, it } from 'vitest';
import type { AutomationAction, AutomationRuleBody } from '@liveplanner/items';
import {
  actionAt,
  addAction,
  addBranch,
  addCondition,
  canAddAction,
  canAddOutgoing,
  canDuplicate,
  canMove,
  conditionAt,
  editPart,
  holderOf,
  newRuleBody,
  partAt,
  setBranchAction,
  setCondition,
  sideOf,
} from './rule-draft';
import { defaultStep } from './step-defaults';
import { outline } from './test-fixtures';

// docs/specs/026-plan/automations.md "For Related Cards" and "Outgoing actions": a branch holds its own conditions
// and up to 10 actions; an outgoing action sits at the top level, 5 a rule.
const flag: AutomationAction = { kind: 'flag' };
const base = (over: Partial<AutomationRuleBody> = {}): AutomationRuleBody => ({
  ...newRuleBody('R', 'UTC'),
  ...over,
});

describe('a For Related Cards branch', () => {
  it('is added on the cards it is blocked by, and takes its own conditions and actions', () => {
    let { body, part } = addBranch(base());
    expect(body.steps[0]).toEqual({
      kind: 'for',
      related: { kind: 'blocked_by' },
      conditions: [],
      then: [],
    });
    expect(part).toEqual({ part: 'step', index: 0 });
    ({ body, part } = addCondition(body, { kind: 'type', types: ['task'] }, 0));
    expect(part).toEqual({ part: 'condition', index: 0, ifStep: 0 });
    expect(partAt(body, 'steps.0.conditions.0')).toEqual(part);
    expect(conditionAt(body, part as never)).toEqual({ kind: 'type', types: ['task'] });
    body = setCondition(body, part as never, { kind: 'type', types: ['idea'] });
    ({ body, part } = addAction(body, flag, { step: 0, side: 'then' }));
    expect(part).toEqual({ part: 'branch', step: 0, side: 'then', index: 0 });
    expect(partAt(body, 'steps.0.then.0')).toEqual(part);
    expect(actionAt(body, part as never)).toEqual(flag);
    expect(holderOf(body, part)?.kind).toBe('for');
    body = setBranchAction(body, part as never, { kind: 'archive' });
    expect(body.steps[0]).toMatchObject({
      conditions: [{ types: ['idea'] }],
      then: [{ kind: 'archive' }],
    });
    // A branch has no Else: adding there, setting there and reading there change nothing.
    expect(sideOf(body.steps[0] as never, 'else')).toBeUndefined();
    expect(addAction(body, flag, { step: 0, side: 'else' }).body.steps[0]).toMatchObject({
      then: [{ kind: 'archive' }],
    });
  });

  it('moves, duplicates and deletes inside the branch', () => {
    let body = base({
      steps: [
        {
          kind: 'for',
          related: { kind: 'children' },
          conditions: [],
          then: [flag, { kind: 'archive' }],
        },
      ],
    });
    const at = { part: 'branch', step: 0, side: 'then', index: 0 } as const;
    expect(canMove(body, at, 'up')).toBe(false);
    expect(canMove(body, at, 'down')).toBe(true);
    ({ body } = editPart(body, at, 'down'));
    expect(body.steps[0]).toMatchObject({ then: [{ kind: 'archive' }, flag] });
    expect(canDuplicate(body, at)).toBe(true);
    ({ body } = editPart(body, at, 'delete'));
    expect(body.steps[0]).toMatchObject({ then: [flag] });
  });

  it('holds 10 actions at most, inside the rule’s 20', () => {
    const ten = Array.from({ length: 10 }, () => flag);
    const body = base({
      steps: [{ kind: 'for', related: { kind: 'children' }, conditions: [], then: ten }],
    });
    expect(canAddAction(body, 0)).toBe(false);
    expect(canAddAction(body)).toBe(true);
    expect(canDuplicate(body, { part: 'branch', step: 0, side: 'then', index: 0 })).toBe(false);
    expect(canDuplicate(body, { part: 'step', index: 0 })).toBe(true);
    const full = base({ steps: [...body.steps, ...ten] });
    expect(canDuplicate(full, { part: 'step', index: 0 })).toBe(false);
  });
});

describe('an outgoing action', () => {
  const notify = defaultStep('notify_slack', outline());
  it('starts with no webhook and the card’s title and link', () => {
    expect(notify).toEqual({
      kind: 'notify',
      via: 'slack',
      webhook: '',
      text: '{{card.title}} {{card.url}}',
    });
  });

  it('always goes at the top level, 5 a rule', () => {
    const inIf = base({ steps: [{ kind: 'if', conditions: [], then: [], else: [] }] });
    const added = addAction(inIf, notify, { step: 0, side: 'then' });
    expect(added.part).toEqual({ part: 'step', index: 1 });
    const five = base({ steps: Array.from({ length: 5 }, () => notify) });
    expect(canAddOutgoing(five)).toBe(false);
    expect(canDuplicate(five, { part: 'step', index: 0 })).toBe(false);
    expect(canAddOutgoing(base({ steps: [notify] }))).toBe(true);
  });

  it('never duplicates a trigger, or a step no longer there', () => {
    expect(canDuplicate(base(), { part: 'trigger' })).toBe(false);
    expect(canDuplicate(base(), { part: 'step', index: 3 })).toBe(false);
    expect(canDuplicate(base(), { part: 'condition', index: 0 })).toBe(true);
  });
});
