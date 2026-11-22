import { describe, expect, it } from 'vitest';
import { planActions } from './plan-actions';
import { stepChip } from './sentence';
import { automationRuleSummary } from './summary';
import { readRuleBody } from './validate';
import { bug, ctxFor, ruleBody } from './test-fixtures';
import { itemTitle } from '../item';
import type { AutomationStep } from './types';

// A plan rule's steps in other apps (docs/specs/026-plan/automations.md "Steps in other apps"): checked as the shared
// kinds are, at the top level only; planned with their texts filled from the card; worded and summarised as every
// app words them.
const kb = {
  kind: 'kb_page',
  target: { app: 'liveknowledge', item: 'kb1', title: 'Docs' },
  title: 'Release: {{card.title}}',
  body: '{{card.title}} shipped',
} satisfies AutomationStep;

describe('a step in another app on a plan', () => {
  it('reads at the top level, its values checked against the trigger', () => {
    const r = readRuleBody(ruleBody({ steps: [kb] }));
    expect('body' in r && r.body.steps[0]).toMatchObject({
      kind: 'kb_page',
      title: 'Release: {{card.title}}',
    });
    const bad = readRuleBody(ruleBody({ steps: [{ ...kb, title: '{{nope}}' }] }));
    expect('path' in bad && bad.path).toBe('steps.0.title');
    const inIf = readRuleBody(
      ruleBody({ steps: [{ kind: 'if', conditions: [], then: [kb as never], else: [] }] }),
    );
    expect('path' in inIf).toBe(true);
  });

  it('plans with its texts filled from the card, beside the card’s own writes', () => {
    const r = planActions([{ kind: 'flag' }, kb], ctxFor(bug()));
    if ('failed' in r) throw new Error(r.failed);
    expect(r.cross).toEqual([
      {
        step: 1,
        filled: expect.objectContaining({ title: `Release: ${itemTitle(bug())}` }),
        line: 1,
      },
    ]);
    expect(r.lines[1]).toMatchObject({ kind: 'action', text: 'Write a Page in “Docs”' });
    const none = planActions([{ kind: 'flag' }], ctxFor(bug()));
    expect('cross' in none).toBe(false);
  });

  it('words its chip and its summary line as every app does', () => {
    expect(stepChip(kb, { types: [], statuses: new Map(), people: [] })).toBe(
      'Write a Page in “Docs”',
    );
    const summary = automationRuleSummary(
      {
        ...ruleBody({ steps: [kb] }),
        id: 'r1',
        enabled: true,
        made: { by: { id: 'p', name: 'Ana', color: '#000' }, at: 1 },
        edited: { by: { id: 'p', name: 'Ana', color: '#000' }, at: 1 },
      },
      { types: [], statuses: new Map([['done', 'Done']]), people: [] },
    );
    expect(summary.steps).toEqual([{ kind: 'kb_page', words: 'Write a Page in “Docs”' }]);
  });
});
