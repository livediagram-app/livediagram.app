import { describe, expect, it } from 'vitest';
import { starterRulesAskOf } from './starter-rules-ask';

// docs/specs/026-plan/plan-templates.md "Starter rules": a create names a template with starter rules, in the
// person's time zone; none for a Sheet template, a blank plan or no template.
describe('starterRulesAskOf', () => {
  it('asks for a template with starter rules, in this browser’s time zone', () => {
    expect(starterRulesAskOf('kanban')).toEqual({
      template: 'kanban',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it('asks for none otherwise', () => {
    expect(starterRulesAskOf('budget-planner')).toBeUndefined();
    expect(starterRulesAskOf(null)).toBeUndefined();
    expect(starterRulesAskOf(undefined)).toBeUndefined();
  });
});
