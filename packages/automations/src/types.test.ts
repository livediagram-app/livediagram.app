import { describe, expect, it } from 'vitest';
import * as automations from './index';

describe('the pure entry', () => {
  it('names who a rule’s changes are by', () => {
    expect(automations.AUTOMATION_PERSON_ID).toBe('automation');
    expect(automations.AUTOMATION_COLOR).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('holds the same numbers for every app', () => {
    expect(automations.AUTOMATION_RULES_MAX).toBe(50);
    expect(automations.AUTOMATION_RUNS_PER_DAY).toBe(1000);
    expect(automations.AUTOMATION_QUEUE_MAX).toBe(500);
  });
});
