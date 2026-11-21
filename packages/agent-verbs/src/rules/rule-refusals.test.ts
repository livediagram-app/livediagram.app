import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/api-client';
import { createApiRefusal } from '../api-refusal';
import { TEST_PRODUCT, WORDED_PRODUCT } from '../testing/product';
import { createRuleRefusal } from './rule-refusals';

// liveworkspace/docs/specs/018-automations/automations.md "Who may do what": every refusal a rule call meets, in words
// that say what to do next; anything else is the product's shared refusals'.
const ruleRefusalOf = createRuleRefusal(TEST_PRODUCT, createApiRefusal(TEST_PRODUCT));
const refused = (status: number, body: unknown) =>
  ruleRefusalOf(new ApiError(status, JSON.stringify(body)));

describe('a rule refusal', () => {
  it('names the part of the rule at fault and the engine’s reason', () => {
    expect(
      refused(400, {
        error: 'automation_invalid',
        path: 'steps.0.to',
        message: 'steps.0.to must name one',
      }),
    ).toEqual({
      code: 'automation_invalid',
      message:
        'The api refused the rule (automation_invalid at steps.0.to): steps.0.to must name one. Fix that part and send the change again.',
    });
    expect(refused(400, { error: 'automation_value_unknown' })!.message).toMatch(
      /^The api refused the rule \(automation_value_unknown\)\. A \{\{value\}\}/,
    );
    for (const code of ['automation_condition_unsupported', 'automation_step_unsupported'])
      expect(refused(400, { error: code, path: 'steps.1' })!.message).toContain(
        `(${code} at steps.1)`,
      );
  });

  it('says who may work rules, and what a token never does', () => {
    expect(refused(403, { error: 'automations_need_editor' })!.message).toBe(
      'The api refused it (automations_need_editor): rules are an Editor’s of the whole sketch: this token’s person ' +
        'must be an Editor of the whole sketch (not through a link to one tab, a Participant or a Viewer). An ' +
        'Incoming Webhook’s secret is made and read only in the editor, never through a token.',
    );
    expect(refused(403, { error: 'read_only_token' })!.message).toContain('list_rules');
    expect(refused(403, { error: 'automation_needs_a_person' })!.message).toContain(
      'leave the revert_snapshot step out',
    );
    expect(refused(403, { error: 'automation_connection_needs_a_person' })!.message).toContain(
      'keep the connection the rule already has',
    );
  });

  it('words each limit and each missing thing', () => {
    const words: Record<string, RegExp> = {
      automation_snapshots_full: /more than 5 snapshots/,
      automation_name_taken: /1 to 60 characters/,
      automation_rules_full: /holds 50 rules/,
      automation_not_found: /list_rules lists the rules/,
      automation_not_manual: /Run by Hand rule/,
      automation_budget_spent: /1,000 runs today/,
      tab_not_found: /that tab is gone from the sketch/,
    };
    for (const [code, said] of Object.entries(words))
      expect(refused(409, { error: code })!.message).toMatch(said);
  });

  it('speaks the product’s word', () => {
    const worded = createRuleRefusal(WORDED_PRODUCT, () => null);
    expect(worded(new ApiError(409, '{"error":"automation_rules_full"}'))!.message).toContain(
      'the drawing holds',
    );
  });

  it('leaves anything else to the shared refusals, and a 5xx to throw', () => {
    expect(refused(410, { error: 'gone' })).toEqual({
      code: 'gone',
      message:
        'The api refused it: that sketch is in the Trash: restore it with restore_sketch first.',
    });
    expect(ruleRefusalOf(new ApiError(404, 'nope'))!.code).toBe('http_404');
    expect(refused(503, { error: 'automations_unavailable' })).toBeNull();
    expect(ruleRefusalOf(new Error('down'))).toBeNull();
  });
});
