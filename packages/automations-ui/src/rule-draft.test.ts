// The rule the builder holds (blueprint ui.md "The draft"), over open kinds: names, counts and caps, paths, and every
// edit, at the rule's top level and inside a step that holds steps of its own (an If / Else, an app's branch).
import { describe, expect, it } from 'vitest';
import type { AutomationKind } from '@liveworkspace/automations';
import {
  NEW_RULE_NAME,
  actionAt,
  actionCount,
  addAction,
  addCondition,
  addIfElse,
  addStep,
  bodyOf,
  canAddAction,
  canAddAi,
  canAddCondition,
  canAddOutgoing,
  canAddWait,
  canDuplicate,
  canMove,
  conditionAt,
  editPart,
  holderOf,
  isTopOnly,
  newRuleBody,
  nextRuleName,
  partAt,
  pathOf,
  sameBody,
  samePart,
  setBranchAction,
  setCondition,
  setStep,
  sideOf,
  type RulePart,
} from './rule-draft';
import type { RuleBody } from './types';

const k = (kind: string, more: object = {}): AutomationKind => ({ kind, ...more });
const IF = (
  then: AutomationKind[] = [],
  other: AutomationKind[] = [],
  conditions: AutomationKind[] = [],
) => k('if', { conditions, then, else: other });
const FOR = (then: AutomationKind[] = [], conditions: AutomationKind[] = []) =>
  k('for', { conditions, then });
const rule = (over: Partial<RuleBody> = {}): RuleBody => ({
  ...newRuleBody('Rule', 'UTC', k('made')),
  ...over,
});
const many = (n: number, kind = 'act') => Array.from({ length: n }, () => k(kind));

describe('a new rule', () => {
  it('is named the first New Rule not taken, any case', () => {
    expect(nextRuleName([])).toBe(NEW_RULE_NAME);
    expect(nextRuleName(['new rule ', 'New Rule 2'])).toBe('New Rule 3');
    const taken = [NEW_RULE_NAME, ...Array.from({ length: 50 }, (_, i) => `New Rule ${i + 2}`)];
    expect(nextRuleName(taken)).toBe('New Rule 52');
  });

  it('starts on the app’s trigger, with nothing else, off its stamps', () => {
    const body = newRuleBody('R', 'Europe/London', k('made'));
    expect(body).toEqual({
      name: 'R',
      trigger: { kind: 'made' },
      conditions: [],
      steps: [],
      chain: false,
      timeZone: 'Europe/London',
    });
    const listed = { ...body, id: 'r1', enabled: true };
    expect(bodyOf(listed)).toEqual(body);
    expect(sameBody(listed, body)).toBe(true);
    expect(sameBody(body, { ...body, chain: true })).toBe(false);
  });
});

describe('counts and caps', () => {
  it('counts the actions inside a holder, and none for a Wait', () => {
    expect(actionCount([k('a'), k('wait'), IF([k('a')], [k('b'), k('c')]), FOR([k('a')])])).toBe(5);
  });

  it('holds 20 actions a rule, and a branch its own most', () => {
    expect(canAddAction(rule({ steps: many(19) }))).toBe(true);
    expect(canAddAction(rule({ steps: many(20) }))).toBe(false);
    const body = rule({ steps: [FOR(many(3)), IF(many(3))] });
    expect(canAddAction(body, 0, 3)).toBe(false);
    expect(canAddAction(body, 0, 4)).toBe(true);
    expect(canAddAction(body, 0)).toBe(true);
    // An If / Else has no cap of its own.
    expect(canAddAction(body, 1, 3)).toBe(true);
    expect(canAddAction(body, 9, 3)).toBe(true);
  });

  it('holds 5 message steps, 3 AI steps, 3 Waits and 10 conditions', () => {
    expect(canAddOutgoing(rule({ steps: many(4, 'notify') }))).toBe(true);
    expect(canAddOutgoing(rule({ steps: many(5, 'notify') }))).toBe(false);
    expect(canAddAi(rule({ steps: many(2, 'ai') }))).toBe(true);
    expect(canAddAi(rule({ steps: many(3, 'ai') }))).toBe(false);
    expect(canAddWait(rule({ steps: many(2, 'wait') }))).toBe(true);
    expect(canAddWait(rule({ steps: many(3, 'wait') }))).toBe(false);
    expect(canAddCondition(many(9))).toBe(true);
    expect(canAddCondition(many(10))).toBe(false);
    expect([k('notify'), k('ai'), k('wait'), k('act')].map(isTopOnly)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
});

describe('paths', () => {
  const body = rule({
    conditions: [k('c0')],
    steps: [k('s0'), IF([k('t0')], [k('e0')], [k('ic0')]), FOR([k('f0')])],
  });

  it('names each part as the api does, and reads one back', () => {
    const parts: [RulePart, string][] = [
      [{ part: 'trigger' }, 'trigger'],
      [{ part: 'condition', index: 0 }, 'conditions.0'],
      [{ part: 'condition', index: 0, ifStep: 1 }, 'steps.1.conditions.0'],
      [{ part: 'step', index: 2 }, 'steps.2'],
      [{ part: 'branch', step: 1, side: 'else', index: 0 }, 'steps.1.else.0'],
    ];
    for (const [part, path] of parts) {
      expect(pathOf(part)).toBe(path);
      expect(partAt(body, path)).toEqual(part);
    }
    // A refusal's longer path names the part it sits in.
    expect(partAt(body, 'steps.0.text')).toEqual({ part: 'step', index: 0 });
    expect(partAt(body, 'steps.1.then.0.text')).toEqual({
      part: 'branch',
      step: 1,
      side: 'then',
      index: 0,
    });
    expect(partAt(body, 'steps.2.then.0')).toEqual({
      part: 'branch',
      step: 2,
      side: 'then',
      index: 0,
    });
    // A branch has no Else; a list's end, a rule's name and anything unknown name no step inside.
    expect(partAt(body, 'steps.2.else.0')).toEqual({ part: 'step', index: 2 });
    expect(partAt(body, 'steps.1.then.5')).toEqual({ part: 'step', index: 1 });
    expect(partAt(body, 'steps.1.conditions.5')).toEqual({ part: 'step', index: 1 });
    expect(partAt(body, 'name')).toBeNull();
    expect(partAt(body, 'conditions.4')).toBeNull();
    expect(partAt(body, 'steps.9')).toBeNull();
    expect(partAt(body, 'steps.x')).toBeNull();
    expect(partAt(body, 'chain')).toBeNull();
    expect(partAt(body, 'other.0')).toBeNull();
  });

  it('tells two parts alike by their paths', () => {
    expect(samePart({ part: 'step', index: 1 }, { part: 'step', index: 1 })).toBe(true);
    expect(samePart({ part: 'step', index: 1 }, { part: 'condition', index: 1 })).toBe(false);
    expect(samePart(null, { part: 'trigger' })).toBe(false);
    expect(samePart({ part: 'trigger' }, null)).toBe(false);
  });

  it('reads a condition, an action and the holder a part sits in', () => {
    expect(conditionAt(body, { part: 'condition', index: 0 })).toEqual(k('c0'));
    expect(conditionAt(body, { part: 'condition', index: 0, ifStep: 1 })).toEqual(k('ic0'));
    expect(conditionAt(body, { part: 'condition', index: 0, ifStep: 0 })).toBeUndefined();
    expect(actionAt(body, { part: 'branch', step: 1, side: 'else', index: 0 })).toEqual(k('e0'));
    expect(actionAt(body, { part: 'branch', step: 2, side: 'else', index: 0 })).toBeUndefined();
    expect(actionAt(body, { part: 'branch', step: 0, side: 'then', index: 0 })).toBeUndefined();
    expect(holderOf(body, { part: 'branch', step: 2, side: 'then', index: 0 })?.kind).toBe('for');
    expect(holderOf(body, { part: 'condition', index: 0, ifStep: 1 })?.kind).toBe('if');
    expect(holderOf(body, { part: 'condition', index: 0 })).toBeUndefined();
    expect(holderOf(body, { part: 'step', index: 0 })).toBeUndefined();
    expect(holderOf(body, { part: 'branch', step: 0, side: 'then', index: 0 })).toBeUndefined();
    expect(holderOf(body, null)).toBeUndefined();
    const held = holderOf(body, { part: 'branch', step: 1, side: 'then', index: 0 })!;
    expect(sideOf(held, 'then')).toEqual([k('t0')]);
    expect(sideOf(held, 'else')).toEqual([k('e0')]);
  });
});

describe('writing and adding', () => {
  const body = rule({
    conditions: [k('c0')],
    steps: [k('s0'), IF([k('t0')], [k('e0')], [k('ic0')]), FOR([k('f0')])],
  });

  it('replaces a condition, a step and an action inside a holder', () => {
    expect(setCondition(body, { part: 'condition', index: 0 }, k('new')).conditions).toEqual([
      k('new'),
    ]);
    expect(
      conditionAt(setCondition(body, { part: 'condition', index: 0, ifStep: 1 }, k('new')), {
        part: 'condition',
        index: 0,
        ifStep: 1,
      }),
    ).toEqual(k('new'));
    // A step that holds none is left as it is.
    expect(setCondition(body, { part: 'condition', index: 0, ifStep: 0 }, k('new'))).toBe(body);
    expect(setStep(body, 0, k('new')).steps[0]).toEqual(k('new'));
    const elsePart = { part: 'branch', step: 1, side: 'else', index: 0 } as const;
    expect(actionAt(setBranchAction(body, elsePart, k('new')), elsePart)).toEqual(k('new'));
    const forPart = { part: 'branch', step: 2, side: 'then', index: 0 } as const;
    expect(actionAt(setBranchAction(body, forPart, k('new')), forPart)).toEqual(k('new'));
    // A branch takes only Then.
    expect(setBranchAction(body, { ...forPart, side: 'else' }, k('new')).steps[2]).toEqual(
      body.steps[2],
    );
  });

  it('adds a condition to the rule or to a holder, answering its part', () => {
    expect(addCondition(body, k('c1'))).toMatchObject({
      body: { conditions: [k('c0'), k('c1')] },
      part: { part: 'condition', index: 1 },
    });
    const inIf = addCondition(body, k('ic1'), 1);
    expect(inIf.part).toEqual({ part: 'condition', index: 1, ifStep: 1 });
    expect(conditionAt(inIf.body, { part: 'condition', index: 1, ifStep: 1 })).toEqual(k('ic1'));
    expect(addCondition(body, k('x'), 0)).toEqual({
      body,
      part: { part: 'condition', index: 0, ifStep: 0 },
    });
  });

  it('adds a step at the end, or an action into a holder’s list; a step of the top level alone stays there', () => {
    expect(addAction(body, k('new')).part).toEqual({ part: 'step', index: 3 });
    const inElse = addAction(body, k('new'), { step: 1, side: 'else' });
    expect(inElse.part).toEqual({ part: 'branch', step: 1, side: 'else', index: 1 });
    expect(actionAt(inElse.body, { part: 'branch', step: 1, side: 'else', index: 1 })).toEqual(
      k('new'),
    );
    expect(addAction(body, k('new'), { step: 2, side: 'then' }).part).toEqual({
      part: 'branch',
      step: 2,
      side: 'then',
      index: 1,
    });
    // A branch has no Else list to add to; a step that holds none takes nothing.
    expect(addAction(body, k('new'), { step: 2, side: 'else' }).part).toMatchObject({ index: 0 });
    expect(addAction(body, k('new'), { step: 0, side: 'then' }).body).toBe(body);
    expect(addAction(body, k('notify'), { step: 1, side: 'then' }).part).toEqual({
      part: 'step',
      index: 3,
    });
    expect(addAction(body, k('own'), { step: 1, side: 'then' }, true).part).toEqual({
      part: 'step',
      index: 3,
    });
    expect(addStep(body, FOR()).part).toEqual({ part: 'step', index: 3 });
    expect(addIfElse(body).body.steps[3]).toEqual(IF());
  });
});

describe('Move Up, Move Down, Duplicate, Delete', () => {
  const body = rule({
    conditions: [k('c0'), k('c1')],
    steps: [k('s0'), IF([k('t0'), k('t1')], [], [k('ic0'), k('ic1')]), FOR([k('f0')])],
  });

  it('says which way a part may move', () => {
    expect(canMove(body, { part: 'trigger' }, 'up')).toBe(false);
    expect(canMove(body, { part: 'trigger' }, 'down')).toBe(false);
    expect(canMove(body, { part: 'condition', index: 0 }, 'down')).toBe(true);
    expect(canMove(body, { part: 'condition', index: 1, ifStep: 1 }, 'down')).toBe(false);
    expect(canMove(body, { part: 'condition', index: 0, ifStep: 0 }, 'down')).toBe(false);
    expect(canMove(body, { part: 'step', index: 2 }, 'up')).toBe(true);
    expect(canMove(body, { part: 'branch', step: 1, side: 'then', index: 0 }, 'down')).toBe(true);
    expect(canMove(body, { part: 'branch', step: 0, side: 'then', index: 0 }, 'down')).toBe(false);
  });

  it('edits a condition, at the rule’s level and inside a holder', () => {
    const top = { part: 'condition', index: 0 } as const;
    expect(editPart(body, top, 'down')).toMatchObject({
      body: { conditions: [k('c1'), k('c0')] },
      part: { part: 'condition', index: 1 },
    });
    expect(editPart(body, top, 'up').part).toEqual(top);
    expect(editPart(body, top, 'delete')).toMatchObject({
      body: { conditions: [k('c1')] },
      part: null,
    });
    const held = { part: 'condition', index: 1, ifStep: 1 } as const;
    const moved = editPart(body, held, 'up');
    expect(moved.part).toEqual({ part: 'condition', index: 0, ifStep: 1 });
    expect(conditionAt(moved.body, { part: 'condition', index: 0, ifStep: 1 })).toEqual(k('ic1'));
    expect(editPart(body, held, 'delete').part).toBeNull();
    expect(editPart(body, { part: 'condition', index: 0, ifStep: 0 }, 'delete')).toEqual({
      body,
      part: null,
    });
  });

  it('edits a step and an action inside a holder; the trigger never moves', () => {
    expect(editPart(body, { part: 'trigger' }, 'delete')).toEqual({
      body,
      part: { part: 'trigger' },
    });
    const dup = editPart(body, { part: 'step', index: 0 }, 'duplicate');
    expect(dup.part).toEqual({ part: 'step', index: 1 });
    expect(dup.body.steps.slice(0, 2)).toEqual([k('s0'), k('s0')]);
    expect(dup.body.steps[1]).not.toBe(dup.body.steps[0]);
    expect(editPart(body, { part: 'step', index: 0 }, 'delete').part).toBeNull();
    const inside = { part: 'branch', step: 1, side: 'then', index: 0 } as const;
    const moved = editPart(body, inside, 'down');
    expect(moved.part).toEqual({ ...inside, index: 1 });
    expect(actionAt(moved.body, { ...inside, index: 1 })).toEqual(k('t0'));
    expect(editPart(body, inside, 'delete').part).toBeNull();
    expect(editPart(body, { part: 'branch', step: 2, side: 'else', index: 0 }, 'delete')).toEqual({
      body,
      part: null,
    });
    expect(editPart(body, { part: 'branch', step: 0, side: 'then', index: 0 }, 'up')).toEqual({
      body,
      part: null,
    });
  });

  it('offers Duplicate while it fits', () => {
    expect(canDuplicate(body, { part: 'trigger' })).toBe(false);
    expect(canDuplicate(body, { part: 'condition', index: 0 })).toBe(true);
    expect(canDuplicate(rule({ conditions: many(10) }), { part: 'condition', index: 0 })).toBe(
      false,
    );
    expect(canDuplicate(body, { part: 'branch', step: 2, side: 'then', index: 0 }, 1)).toBe(false);
    expect(canDuplicate(body, { part: 'branch', step: 2, side: 'then', index: 0 }, 2)).toBe(true);
    expect(canDuplicate(body, { part: 'branch', step: 1, side: 'then', index: 0 })).toBe(true);
    expect(canDuplicate(body, { part: 'step', index: 9 })).toBe(false);
    expect(canDuplicate(rule({ steps: many(5, 'notify') }), { part: 'step', index: 0 })).toBe(
      false,
    );
    expect(canDuplicate(rule({ steps: many(3, 'ai') }), { part: 'step', index: 0 })).toBe(false);
    expect(canDuplicate(rule({ steps: many(3, 'wait') }), { part: 'step', index: 0 })).toBe(false);
    // An If / Else doubles every action it holds.
    expect(canDuplicate(rule({ steps: [IF(many(10))] }), { part: 'step', index: 0 })).toBe(true);
    expect(canDuplicate(rule({ steps: [IF(many(11))] }), { part: 'step', index: 0 })).toBe(false);
  });
});
