import { describe, expect, it } from 'vitest';
import { readAiDraft, type AiDraftContext } from './ai-draft';
import { needLine, ruleNeedItems } from './attention';
import { holdsSnapshotStep, ruleReverts, runsForPlan, runsWithoutCard } from './incoming';
import { planActions } from './plan-actions';
import { stepChip } from './sentence';
import { automationRuleSummary } from './summary';
import { picksLeft } from './templates';
import { bug, ctxFor, OUTLINE, ruleBody, SAM, ZONE } from './test-fixtures';
import type { AutomationStep, AutomationTrigger } from './types';
import { readRuleBody } from './validate';

// docs/specs/026-plan/automations.md "Snapshot steps": Take Snapshot and Revert to Snapshot on a plan, read with the
// shared readers, at the top level only and a revert last; a Scheduled rule of them runs once for the plan; planned
// after the card's writes, a take's name filled; worded, summarised, drafted and checked for a snapshot gone.
const take = { kind: 'take_snapshot', name: 'Weekly {{now.date}}' } satisfies AutomationStep;
const revert = {
  kind: 'revert_snapshot',
  snapshot: 'sn1',
  name: 'Monday Start',
} satisfies AutomationStep;
const weekly: AutomationTrigger = { kind: 'scheduled', every: 'week', days: [1], at: '09:00' };

const refusal = (body: unknown) => {
  const r = readRuleBody(body);
  if ('body' in r) throw new Error('read');
  return r;
};

describe('reading a snapshot step', () => {
  it('reads both at the top level, a take’s values checked', () => {
    const r = readRuleBody(ruleBody({ steps: [{ kind: 'flag' }, take, revert] }));
    expect('body' in r && r.body.steps).toEqual([{ kind: 'flag' }, take, revert]);
    expect(refusal(ruleBody({ steps: [{ ...take, name: '{{nope}}' }] })).path).toBe('steps.0.name');
  });

  it('refuses one in For Related Cards or If / Else', () => {
    const inFor = refusal(
      ruleBody({
        steps: [
          { kind: 'for', related: { kind: 'children' }, conditions: [], then: [take as never] },
        ],
      }),
    );
    expect(inFor.path).toMatch(/^steps\.0/);
    const inIf = refusal(
      ruleBody({ steps: [{ kind: 'if', conditions: [], then: [revert as never], else: [] }] }),
    );
    expect(inIf.path).toMatch(/^steps\.0/);
  });

  it('refuses a revert that is not the last step', () => {
    const r = refusal(ruleBody({ steps: [revert, { kind: 'flag' }] }));
    expect(r).toMatchObject({ error: 'automation_invalid', path: 'steps.0' });
    expect(r.message).toMatch(/last step/);
  });

  it('runs a Scheduled rule of them once for the plan, and refuses one per card', () => {
    const plan = ruleBody({ trigger: weekly, steps: [take, revert] });
    expect('body' in readRuleBody(plan)).toBe(true);
    expect(runsForPlan(plan)).toBe(true);
    const perCard = refusal(ruleBody({ trigger: weekly, steps: [{ kind: 'flag' }, take] }));
    expect(perCard).toMatchObject({ error: 'automation_invalid', path: 'steps.1' });
    expect(perCard.message).toMatch(/once for the plan/);
    const conditioned = ruleBody({
      trigger: weekly,
      conditions: [{ kind: 'flagged', flagged: true } as never],
      steps: [take],
    });
    expect(runsForPlan(conditioned)).toBe(false);
    const overdue = refusal(ruleBody({ trigger: { kind: 'overdue', at: '09:00' }, steps: [take] }));
    expect(overdue.path).toBe('steps.0');
  });

  it('knows a rule that holds one, and one that reverts', () => {
    expect(holdsSnapshotStep({ steps: [{ kind: 'flag' }] })).toBe(false);
    expect(holdsSnapshotStep({ steps: [take] })).toBe(true);
    expect(ruleReverts({ steps: [take] })).toBe(false);
    expect(ruleReverts({ steps: [take, revert] })).toBe(true);
    expect(runsWithoutCard({ conditions: [], steps: [take, revert] })).toBe(true);
    expect(runsForPlan(ruleBody({ steps: [take] }))).toBe(false);
  });
});

describe('planning a snapshot step', () => {
  it('plans after the card’s writes, a take’s name filled, with its own line', () => {
    const r = planActions([{ kind: 'flag' }, take, revert], ctxFor(bug()));
    if ('failed' in r) throw new Error(r.failed);
    expect(r.snapshots).toEqual([
      { step: take, filled: expect.stringMatching(/^Weekly \d/), line: 1 },
      { step: revert, filled: '', line: 2 },
    ]);
    expect(r.lines[1]).toMatchObject({
      kind: 'action',
      text: 'Take Snapshot “Weekly {{now.date}}”',
    });
    expect(r.lines[2]).toMatchObject({ kind: 'action', text: 'Revert to “Monday Start”' });
    const none = planActions([{ kind: 'flag' }], ctxFor(bug()));
    expect('snapshots' in none && none.snapshots).toBeFalsy();
  });

  it('words its chip and its summary line', () => {
    const outline = { types: [], statuses: new Map([['done', 'Done']]), people: [] };
    expect(stepChip(take, outline)).toBe('Take Snapshot “Weekly {{now.date}}”');
    expect(stepChip({ kind: 'revert_snapshot', snapshot: '' }, outline)).toBe(
      'Revert to Snapshot (pick one)',
    );
    const by = { id: 'p', name: 'Ana', color: '#000' };
    const summary = automationRuleSummary(
      {
        ...ruleBody({ trigger: weekly, steps: [take, revert] }),
        id: 'r1',
        enabled: true,
        made: { by, at: 1 },
        edited: { by, at: 1 },
      },
      outline,
    );
    expect(summary.steps).toEqual([
      { kind: 'take_snapshot', words: 'Take Snapshot' },
      { kind: 'revert_snapshot', words: 'Revert to Snapshot' },
    ]);
  });
});

describe('a snapshot gone', () => {
  const rule = ruleBody({ trigger: weekly, steps: [revert] });

  it('needs attention by the name the step kept, only where the caller read the snapshots', () => {
    expect(ruleNeedItems(rule, OUTLINE)).toEqual([]);
    expect(ruleNeedItems(rule, { ...OUTLINE, snapshots: new Set(['sn1']) })).toEqual([]);
    const gone = ruleNeedItems(rule, { ...OUTLINE, snapshots: new Set() });
    expect(gone).toEqual([{ kind: 'snapshot', id: 'sn1', name: 'Monday Start' }]);
    expect(needLine(gone[0]!)).toBe('Snapshot “Monday Start” is gone');
    expect(needLine({ kind: 'snapshot', id: 'sn1' })).toBe('Snapshot sn1 is gone');
    const unnamed = ruleBody({
      trigger: weekly,
      steps: [{ kind: 'revert_snapshot', snapshot: 'sn9' }],
    });
    expect(ruleNeedItems(unnamed, { ...OUTLINE, snapshots: new Set() })).toEqual([
      { kind: 'snapshot', id: 'sn9' },
    ]);
  });
});

describe('Describe a Rule', () => {
  const CTX: AiDraftContext = {
    prompt: 'Every Monday at 9, snapshot the plan as Weekly and then put it back to the start',
    names: { statuses: OUTLINE.statuses, types: [], people: [SAM], tabs: [] },
    timeZone: ZONE,
    rules: [],
  };

  it('writes both, leaving the snapshot for the person to pick', () => {
    const out = readAiDraft(
      {
        outcome: 'rule',
        rule: {
          name: 'Monday Reset',
          trigger: weekly,
          conditions: [],
          steps: [
            { kind: 'take_snapshot', name: `Weekly ${'x'.repeat(200)}` },
            { kind: 'revert_snapshot', snapshot: 'made-up', name: 'Start' },
          ],
        },
      },
      CTX,
    );
    if (!('body' in out)) throw new Error(JSON.stringify(out));
    expect(out.body.steps[0]).toMatchObject({ kind: 'take_snapshot' });
    expect((out.body.steps[0] as { name: string }).name.length).toBeLessThanOrEqual(120);
    expect(out.body.steps[1]).toEqual({ kind: 'revert_snapshot', snapshot: '' });
    expect(out.picks).toContainEqual({ path: 'steps.1', pick: 'snapshot' });
    // The pick stays until one is picked.
    expect(picksLeft(out.body, out.picks)).toContainEqual({ path: 'steps.1', pick: 'snapshot' });
    const picked = {
      ...out.body,
      steps: [out.body.steps[0]!, { kind: 'revert_snapshot', snapshot: 'sn1' } as AutomationStep],
    };
    expect(picksLeft(picked, out.picks).some((p) => p.pick === 'snapshot')).toBe(false);
  });

  it('passes a draft with no revert as it came', () => {
    const out = readAiDraft(
      {
        outcome: 'rule',
        rule: { name: 'Weekly', trigger: weekly, conditions: [], steps: [take] },
      },
      CTX,
    );
    expect('body' in out && out.picks).toEqual([]);
    expect(readAiDraft({ outcome: 'off_topic' }, CTX)).not.toHaveProperty('body');
  });
});
