import { describe, expect, it } from 'vitest';
import { itemRuleFormat } from '@liveworkspace/automations/item';
import { WORDED_PRODUCT } from '../testing/product';
import { KINDS, RULES } from '../testing/rules';
import { createRuleTools } from './rule-tools';

// liveworkspace/docs/specs/018-automations/automations.md "Agents": list_rules and change_rules in a product's words
// and id key, the rule format they describe read off that product's kinds.
const { listRules, changeRules } = createRuleTools(RULES, 'sketchId');
const changes = changeRules.input.shape.changes;

// A rule as list_rules' `rule` answers it, written back.
const read = {
  id: 'r1',
  enabled: true,
  made: { by: 'Ana Costa', at: '2026-11-01T09:00:00.000Z' },
  edited: { by: 'Ana Costa', at: '2026-11-02T09:00:00.000Z' },
  name: 'Comments by email',
  trigger: { kind: 'comment_added' },
  conditions: [],
  steps: [{ kind: 'email', to: { owner: true }, subject: 's', body: 'b' }],
  chain: false,
  timeZone: 'Europe/London',
};

describe('the rule tools', () => {
  it('are named, worded and keyed as the product has them', () => {
    expect(listRules.mcp.tool).toBe('list_rules');
    expect(listRules.behaviour).toBe('read');
    expect(changeRules.mcp.tool).toBe('change_rules');
    expect(changeRules.behaviour).toBe('destructive');
    expect(listRules.summary).toBe('List a sketch’s Automations rules');
    expect(Object.keys(listRules.mcpShapes.input)).toEqual(['sketchId', 'rule', 'runs', 'limit']);
    expect(Object.keys(changeRules.mcpShapes.input)).toEqual(['sketchId', 'changes']);
    expect(listRules.mcpShapes.input.sketchId.description).toBe('The sketch (from find_sketches).');
    const worded = createRuleTools({ ...RULES, product: WORDED_PRODUCT }, 'drawingId');
    expect(worded.changeRules.summary).toBe('Change a drawing’s Automations rules');
  });

  it('spell out the product’s triggers, conditions, steps and values', () => {
    const format = itemRuleFormat(KINDS);
    const schema = JSON.stringify(changeRules.input.toJSONSchema());
    for (const part of [format.trigger, format.conditions, format.steps])
      expect(schema).toContain(JSON.stringify(part).slice(1, 60));
    expect(schema).toContain('comment_added');
    // Spelled out once, on add's rule: set and test point at it, so the tool's schema stays small.
    const once = (part: string) => schema.split(JSON.stringify(part).slice(1, 60)).length - 1;
    expect([once(format.trigger), once(format.conditions), once(format.steps)]).toEqual([1, 1, 1]);
    expect(schema).not.toContain('a version is');
    const own = createRuleTools({ ...RULES, naming: 'a version is its id.' }, 'sketchId');
    expect(JSON.stringify(own.changeRules.input.toJSONSchema())).toContain('a version is its id.');
  });

  it('take a rule read back by add, set and test, and refuse a key a rule never holds', () => {
    expect(changes.safeParse([{ op: 'add', rule: read }]).success).toBe(true);
    expect(changes.safeParse([{ op: 'set', ...read, rule: 'r1' }]).success).toBe(true);
    expect(changes.safeParse([{ op: 'test', rule: read, tab: 'Overview' }]).success).toBe(true);
    expect(changes.safeParse([{ op: 'run', rule: 'r1' }]).success).toBe(true);
    expect(changes.safeParse([{ op: 'add', rule: { ...read, colour: 'red' } }]).success).toBe(
      false,
    );
    expect(changes.safeParse([{ op: 'run', rule: 'r1', card: '#12' }]).success).toBe(false);
  });

  it('refuse a trigger the product lacks, and more than 20 changes', () => {
    const add = (kind: string) => [{ op: 'add', rule: { name: 'x', trigger: { kind } } }];
    expect(changes.safeParse(add('card_moved')).success).toBe(false);
    expect(changes.safeParse(add('manual')).success).toBe(true);
    const many = Array.from({ length: 21 }, () => ({ op: 'off', rule: 'r1' }));
    expect(changes.safeParse(many).success).toBe(false);
  });
});
