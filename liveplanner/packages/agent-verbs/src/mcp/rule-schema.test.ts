import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { changeRulesShape } from './rule-schema';

// docs/specs/026-plan/automations.md "A rule read back writes back": a body copied from list_rules' rule is taken by
// add, set and test, its id, enabled and stamps accepted (and ignored by the engine); any other key is still refused.
const changes = z.object(changeRulesShape).shape.changes;

const read = {
  id: 'r1',
  enabled: true,
  made: { by: 'Ana Costa', at: '2026-11-01T09:00:00.000Z' },
  edited: { by: 'Ana Costa', at: '2026-11-02T09:00:00.000Z' },
  name: 'Done stamp',
  trigger: { kind: 'card_moved', to: ['Done'] },
  conditions: [],
  steps: [{ kind: 'add_label', label: 'shipped' }],
  chain: false,
  timeZone: 'Europe/London',
};

describe('change_rules changes', () => {
  it('takes a rule read back by add, set and test', () => {
    expect(changes.safeParse([{ op: 'add', rule: read }]).success).toBe(true);
    expect(changes.safeParse([{ op: 'set', ...read, rule: 'Done stamp' }]).success).toBe(true);
    expect(changes.safeParse([{ op: 'test', rule: read, card: '#12' }]).success).toBe(true);
  });

  it('still refuses a key a rule never holds', () => {
    const parsed = changes.safeParse([{ op: 'add', rule: { ...read, colour: 'red' } }]);
    expect(parsed.success).toBe(false);
  });
});
