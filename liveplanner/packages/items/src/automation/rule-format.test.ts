import { describe, expect, it } from 'vitest';
import { RULE_CONDITIONS_FORMAT, RULE_STEPS_FORMAT, RULE_TRIGGER_FORMAT } from './rule-format';
import { AUTOMATION_TRIGGER_KINDS, type AutomationCondition, type AutomationStep } from './types';

// docs/specs/026-plan/automations.md "Agents and the CLI", "Describe a Rule": the format names every kind a rule may
// hold, so neither an agent nor the drafting model is left guessing at one. Typed records: a kind added to types.ts
// fails the build here until it is listed, and then this test until the format describes it.
const STEP_KINDS: Record<AutomationStep['kind'], true> = {
  move: true,
  set_field: true,
  clear_field: true,
  assign: true,
  add_label: true,
  remove_label: true,
  comment: true,
  flag: true,
  unflag: true,
  archive: true,
  create_card: true,
  email: true,
  set_type: true,
  set_colour: true,
  restore: true,
  copy_card: true,
  add_checklist: true,
  link_card: true,
  mention: true,
  resolve_threads: true,
  notify: true,
  if: true,
  for: true,
  ai: true,
  wait: true,
};
const CONDITION_KINDS: Record<AutomationCondition['kind'], true> = {
  type: true,
  column: true,
  field: true,
  who: true,
  saved_filter: true,
};

describe('the rule format', () => {
  it('describes every trigger kind', () => {
    for (const kind of AUTOMATION_TRIGGER_KINDS)
      expect(RULE_TRIGGER_FORMAT, kind).toContain(`"kind":"${kind}"`);
  });

  it('describes every step kind', () => {
    for (const kind of Object.keys(STEP_KINDS))
      expect(RULE_STEPS_FORMAT, kind).toContain(`"kind":"${kind}"`);
  });

  it('describes every condition kind', () => {
    for (const kind of Object.keys(CONDITION_KINDS))
      expect(RULE_CONDITIONS_FORMAT, kind).toContain(`"kind":"${kind}"`);
  });

  it('says which value each field kind takes, and which fields a rule never writes', () => {
    for (const words of ['a day', 'a number', 'a list', '{"text":"Yes"|"No"}', '{"text":person}'])
      expect(RULE_STEPS_FORMAT, words).toContain(words);
    expect(RULE_STEPS_FORMAT).toContain(
      'neither ever sets nor clears a Time Spent, Votes, Comments or Calculated field',
    );
  });
});
