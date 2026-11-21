import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_ERRORS,
  AUTOMATION_HOOK_ERRORS,
  type AutomationErrorBody,
  type AutomationListedRule,
} from './automations';

describe('the Automations error codes', () => {
  it('lists each code once, the two an item with no cards adds among them', () => {
    expect(new Set(AUTOMATION_ERRORS).size).toBe(AUTOMATION_ERRORS.length);
    expect(AUTOMATION_ERRORS).toContain('automation_needs_a_person');
    expect(AUTOMATION_ERRORS).toContain('automation_snapshots_full');
    expect(AUTOMATION_ERRORS).toContain('automations_need_editor');
    expect(new Set(AUTOMATION_HOOK_ERRORS).size).toBe(AUTOMATION_HOOK_ERRORS.length);
    expect(AUTOMATION_HOOK_ERRORS).toContain('webhook_unauthorized');
  });

  it('shapes a refusal and a listed rule over whatever rule an engine has', () => {
    const refusal: AutomationErrorBody = { error: 'automation_invalid', path: 'steps.0' };
    const listed: AutomationListedRule<{ id: string }, { kind: string }> = {
      id: 'r1',
      stats: { lastRunAt: null, runsThisWeek: 0, failuresInARow: 0 },
      needs: [],
      attention: [{ kind: 'tab' }],
    };
    expect(refusal.error).toBe('automation_invalid');
    expect(listed.attention).toHaveLength(1);
  });
});
