import { describe, expect, it } from 'vitest';
import type { AutomationRuleBody } from '@liveplanner/items';
import {
  actionCount,
  addAction,
  addCondition,
  addIfElse,
  canAddAction,
  canAddCondition,
  canMove,
  editPart,
  newRuleBody,
  nextRuleName,
  partAt,
  pathOf,
  sameBody,
  setBranchAction,
  setCondition,
  conditionAt,
  actionAt,
} from './rule-draft';

const base = (): AutomationRuleBody => ({
  ...newRuleBody('R', 'UTC'),
  conditions: [{ kind: 'type', types: ['task'] }],
  steps: [
    { kind: 'flag' },
    {
      kind: 'if',
      conditions: [{ kind: 'column', statuses: ['done'] }],
      then: [{ kind: 'archive' }],
      else: [],
    },
  ],
});

describe('nextRuleName', () => {
  it('takes New Rule, then the first free number, case aside', () => {
    expect(nextRuleName([])).toBe('New Rule');
    expect(nextRuleName(['new rule'])).toBe('New Rule 2');
    expect(nextRuleName(['New Rule', 'New Rule 2'])).toBe('New Rule 3');
  });
  it('falls back past the limit', () => {
    const names = ['New Rule', ...Array.from({ length: 60 }, (_, i) => `New Rule ${i + 2}`)];
    expect(nextRuleName(names)).toBe(`New Rule ${names.length + 1}`);
  });
});

describe('paths', () => {
  it('names every part as the api does, and reads a refusal path back', () => {
    const b = base();
    expect(pathOf({ part: 'trigger' })).toBe('trigger');
    expect(pathOf({ part: 'condition', index: 0 })).toBe('conditions.0');
    expect(pathOf({ part: 'condition', index: 0, ifStep: 1 })).toBe('steps.1.conditions.0');
    expect(pathOf({ part: 'branch', step: 1, side: 'then', index: 0 })).toBe('steps.1.then.0');
    expect(partAt(b, 'trigger.fields')).toEqual({ part: 'trigger' });
    expect(partAt(b, 'name')).toBeNull();
    expect(partAt(b, 'conditions.0.types')).toEqual({ part: 'condition', index: 0 });
    expect(partAt(b, 'conditions.9')).toBeNull();
    expect(partAt(b, 'steps.0.text')).toEqual({ part: 'step', index: 0 });
    expect(partAt(b, 'steps.1.then.0')).toEqual({
      part: 'branch',
      step: 1,
      side: 'then',
      index: 0,
    });
    expect(partAt(b, 'steps.1.conditions.0')).toEqual({ part: 'condition', index: 0, ifStep: 1 });
    expect(partAt(b, 'steps.1.else.3')).toEqual({ part: 'step', index: 1 });
    expect(partAt(b, 'steps.7')).toBeNull();
    expect(partAt(b, 'steps.x')).toBeNull();
    expect(partAt(b, 'other.0')).toBeNull();
  });
});

describe('changes', () => {
  it('adds conditions and actions, to the rule and to an If / Else, answering the new part', () => {
    let b = base();
    let r = addCondition(b, { kind: 'who', who: [] });
    expect(r.part).toEqual({ part: 'condition', index: 1 });
    r = addCondition(r.body, { kind: 'who', who: [] }, 1);
    expect(r.part).toEqual({ part: 'condition', index: 1, ifStep: 1 });
    r = addAction(r.body, { kind: 'unflag' }, { step: 1, side: 'else' });
    expect(r.part).toEqual({ part: 'branch', step: 1, side: 'else', index: 0 });
    r = addAction(r.body, { kind: 'unflag' });
    expect(r.part).toEqual({ part: 'step', index: 2 });
    r = addIfElse(r.body);
    expect(r.part).toEqual({ part: 'step', index: 3 });
    b = r.body;
    expect(actionCount(b.steps)).toBe(4);
    expect(canAddAction(b)).toBe(true);
    expect(canAddCondition(Array.from({ length: 10 }))).toBe(false);
    // An add aimed at a step that is no If / Else changes nothing.
    expect(addCondition(b, { kind: 'who', who: [] }, 0).body).toBe(b);
    expect(addAction(b, { kind: 'flag' }, { step: 0, side: 'then' }).body).toBe(b);
  });

  it('sets a condition and a branch action in place', () => {
    const b = base();
    const c = setCondition(b, { part: 'condition', index: 0 }, { kind: 'type', types: ['bug'] });
    expect(conditionAt(c, { part: 'condition', index: 0 })).toEqual({
      kind: 'type',
      types: ['bug'],
    });
    const d = setCondition(
      b,
      { part: 'condition', index: 0, ifStep: 1 },
      { kind: 'column', statuses: ['todo'] },
    );
    expect(conditionAt(d, { part: 'condition', index: 0, ifStep: 1 })).toEqual({
      kind: 'column',
      statuses: ['todo'],
    });
    expect(conditionAt(b, { part: 'condition', index: 0, ifStep: 0 })).toBeUndefined();
    const e = setBranchAction(
      b,
      { part: 'branch', step: 1, side: 'then', index: 0 },
      { kind: 'flag' },
    );
    expect(actionAt(e, { part: 'branch', step: 1, side: 'then', index: 0 })).toEqual({
      kind: 'flag',
    });
    expect(actionAt(b, { part: 'branch', step: 0, side: 'then', index: 0 })).toBeUndefined();
    expect(sameBody(b, base())).toBe(true);
    expect(sameBody(b, e)).toBe(false);
  });

  it('moves, duplicates and deletes every kind of part', () => {
    const b = base();
    expect(canMove(b, { part: 'step', index: 0 }, 'up')).toBe(false);
    expect(canMove(b, { part: 'step', index: 0 }, 'down')).toBe(true);
    expect(canMove(b, { part: 'trigger' }, 'down')).toBe(false);
    expect(canMove(b, { part: 'condition', index: 0, ifStep: 1 }, 'down')).toBe(false);
    expect(canMove(b, { part: 'branch', step: 1, side: 'then', index: 0 }, 'up')).toBe(false);
    expect(canMove(b, { part: 'condition', index: 0, ifStep: 0 }, 'down')).toBe(false);
    expect(canMove(b, { part: 'branch', step: 0, side: 'then', index: 0 }, 'down')).toBe(false);

    const down = editPart(b, { part: 'step', index: 0 }, 'down');
    expect(down.body.steps[1]).toEqual({ kind: 'flag' });
    expect(down.part).toEqual({ part: 'step', index: 1 });
    expect(editPart(b, { part: 'step', index: 0 }, 'up').part).toEqual({ part: 'step', index: 0 });
    const dup = editPart(b, { part: 'condition', index: 0 }, 'duplicate');
    expect(dup.body.conditions).toHaveLength(2);
    expect(dup.part).toEqual({ part: 'condition', index: 1 });
    expect(editPart(b, { part: 'condition', index: 0 }, 'delete')).toEqual({
      body: { ...b, conditions: [] },
      part: null,
    });
    const ifDel = editPart(b, { part: 'condition', index: 0, ifStep: 1 }, 'delete');
    expect(ifDel.body.steps[1]).toMatchObject({ conditions: [] });
    expect(editPart(b, { part: 'condition', index: 0, ifStep: 1 }, 'duplicate').part).toEqual({
      part: 'condition',
      index: 1,
      ifStep: 1,
    });
    const br = editPart(b, { part: 'branch', step: 1, side: 'then', index: 0 }, 'duplicate');
    expect(br.body.steps[1]).toMatchObject({ then: [{ kind: 'archive' }, { kind: 'archive' }] });
    expect(
      editPart(b, { part: 'branch', step: 1, side: 'then', index: 0 }, 'delete').part,
    ).toBeNull();
    expect(editPart(b, { part: 'trigger' }, 'delete')).toEqual({
      body: b,
      part: { part: 'trigger' },
    });
    expect(editPart(b, { part: 'branch', step: 0, side: 'then', index: 0 }, 'delete')).toEqual({
      body: b,
      part: null,
    });
    expect(editPart(b, { part: 'condition', index: 0, ifStep: 0 }, 'delete')).toEqual({
      body: b,
      part: null,
    });
  });
});
