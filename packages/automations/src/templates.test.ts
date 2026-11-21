import { describe, expect, it } from 'vitest';
import { ruleSummary, SUMMARY_AI_STEP, looksLikeAddress } from './summary';
import { partAt, picksLeft, type AutomationTemplate } from './templates';
import type { AutomationKind, AutomationRuleBody } from './types';

type Step = AutomationKind & { then?: AutomationKind[]; tab?: string };
const body: AutomationRuleBody<AutomationKind, AutomationKind, Step> = {
  name: 'Nightly Reset',
  trigger: { kind: 'scheduled' },
  conditions: [{ kind: 'tab' }],
  steps: [{ kind: 'snapshot' }, { kind: 'each', then: [{ kind: 'add_tab' }] }],
  chain: false,
  timeZone: 'UTC',
};
const lists = (step: Step, list: string) => (list === 'then' ? step.then : undefined);

describe('a template', () => {
  it('builds a rule over the item it opens in, with what is left to pick', () => {
    const template: AutomationTemplate<'nightly', 'upkeep', { timeZone: string }> = {
      id: 'nightly',
      name: 'Nightly Reset',
      description: 'Every night, take a snapshot.',
      category: 'upkeep',
      build: (item) => ({ body: { ...body, timeZone: item.timeZone }, picks: [] }),
    };
    expect(template.build({ timeZone: 'Europe/London' }).body.timeZone).toBe('Europe/London');
  });

  it('finds the part a path names', () => {
    expect(partAt(body, 'trigger')).toEqual({ kind: 'scheduled' });
    expect(partAt(body, 'conditions.0')).toEqual({ kind: 'tab' });
    expect(partAt(body, 'steps.0')).toEqual({ kind: 'snapshot' });
    expect(partAt(body, 'steps.9')).toBeUndefined();
    expect(partAt(body, 'steps.9.then.0', lists)).toBeUndefined();
    expect(partAt(body, 'steps.1.then.0', lists)).toEqual({ kind: 'add_tab' });
    expect(partAt(body, 'steps.1.else.0', lists)).toBeUndefined();
    // With no lists to walk, a step's inside names nothing.
    expect(partAt(body, 'steps.1.then.0')).toBeUndefined();
  });

  it('keeps the picks whose slot is still empty, dropping one whose part is gone', () => {
    const picks = [
      { path: 'steps.0', pick: 'name' as const },
      { path: 'steps.1.then.0', pick: 'tab' as const },
      { path: 'steps.7', pick: 'tab' as const },
    ];
    const stillEmpty = (part: unknown, pick: 'name' | 'tab') =>
      pick === 'tab' && (part as Step).tab === undefined;
    expect(picksLeft(body, picks, stillEmpty, lists)).toEqual([picks[1]]);
  });
});

describe('a rule’s summary', () => {
  it('is the rule’s own id, name and state around the app’s words', () => {
    const words = {
      trigger: 'Every Day at 9:00',
      picks: false,
      conditions: ['Tab is Roadmap'],
      steps: [{ kind: 'ai', words: SUMMARY_AI_STEP }],
    };
    const rule = {
      id: 'r1',
      name: 'Nightly Reset',
      enabled: true,
      made: { by: { name: 'Ana Costa', id: 'u1' }, at: 5 },
      secret: 'never leaves',
    };
    expect(ruleSummary(rule, words)).toEqual({
      id: 'r1',
      name: 'Nightly Reset',
      on: true,
      paused: false,
      ...words,
      made: { by: 'Ana Costa', at: 5 },
    });
    expect(
      ruleSummary({ ...rule, enabled: false, paused: { reason: 'x', at: 1 } }, words),
    ).toMatchObject({ on: false, paused: true });
  });

  it('tells a value that reads as an address', () => {
    expect(looksLikeAddress('ana@example.com')).toBe(true);
    expect(looksLikeAddress('https://x.example')).toBe(true);
    expect(looksLikeAddress('High')).toBe(false);
  });
});
