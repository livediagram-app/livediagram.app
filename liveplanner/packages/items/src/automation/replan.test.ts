import { describe, expect, it } from 'vitest';
import type { Item } from '../item';
import { planActions } from './plan-actions';
import { replanAfter, type LivePlan } from './replan';
import { bug, ctxFor } from './test-fixtures';
import type { AutomationStep, AutomationStepLine } from './types';

// docs/specs/026-plan/automations.md "How a step runs" (Work Tracker 846): the steps after an AI step are planned again
// from the card it left, and the new plan takes the old one's place in the run.

const note = (): Item => ({ ...bug({ 'f-severity': undefined }), type: 'note' });
const suggest: AutomationStep = { kind: 'ai', task: 'card_type', set: true };
const hook = { kind: 'notify', via: 'webhook', webhook: 'wh1', text: 'Moved' } as const;

// The run as the runner lays it out: its trigger line, then the plan's lines.
function liveOf(steps: readonly AutomationStep[], card: Item): LivePlan {
  const planned = planActions(steps, ctxFor(card));
  const writes = 'failed' in planned ? planned.done : planned;
  const lines: AutomationStepLine[] = [{ kind: 'trigger', text: 'Sam moved it' }, ...planned.lines];
  return {
    lines,
    offset: 1,
    ai: [...(writes.ai ?? [])],
    sends: writes.sends,
    wait: 'wait' in writes ? writes.wait : undefined,
    failed: 'failed' in planned ? planned.failed : null,
    gone: 'failed' in planned ? planned.gone : undefined,
    turns: writes.turns,
  };
}

describe('replanAfter', () => {
  it('checks a Move after Suggest Card Type against the type the AI set', () => {
    const steps: AutomationStep[] = [suggest, { kind: 'move', status: 'done' }, hook];
    const live = liveOf(steps, note());
    // Planned ahead from the Note it was: the Move fails, and the message after it is never planned.
    expect(live.failed).toBe("A Note card can't go in Done");
    expect(live.sends).toEqual([]);
    const p = live.ai[0]!;
    // The AI set the type to Bug: the rest planned again from the card it left.
    const left = bug();
    const segment = replanAfter(
      live,
      p,
      planActions(steps, ctxFor(left), { from: p.step + 1, carry: p.carry }),
    );
    expect(live.failed).toBeNull();
    expect(segment.patch).toEqual({ set: { status: 'done' } });
    expect(live.lines.map((l) => l.text)).toEqual([
      'Sam moved it',
      'Suggest and Set Card Type',
      'Move to Done',
      'Send to Webhook',
    ]);
    // The message's line is the run's, past the AI step's.
    expect(live.sends).toMatchObject([{ step: 2, line: 2, text: 'Moved' }]);
  });

  it('puts a failure the new plan meets in place of a plan that held', () => {
    const steps: AutomationStep[] = [suggest, { kind: 'move', status: 'done' }];
    const live = liveOf(steps, bug());
    expect(live.failed).toBeNull();
    const p = live.ai[0]!;
    replanAfter(live, p, planActions(steps, ctxFor(note()), { from: 1, carry: p.carry }));
    expect(live.failed).toBe("A Note card can't go in Done");
    expect(live.lines.at(-1)).toMatchObject({ ok: false, text: "A Note card can't go in Done" });
  });

  it('replaces the later AI steps with the new plan’s, their lines shifted, and keeps the Wait it reaches', () => {
    const steps: AutomationStep[] = [
      suggest,
      {
        kind: 'if',
        conditions: [{ kind: 'type', types: ['bug'] }],
        then: [{ kind: 'flag' }],
        else: [],
      },
      suggest,
      { kind: 'wait', hours: 2 },
      { kind: 'flag' },
    ];
    const live = liveOf(steps, note());
    expect(live.ai.map((p) => p.line)).toEqual([0, 2]);
    const first = live.ai[0]!;
    const segment = replanAfter(
      live,
      first,
      planActions(steps, ctxFor(bug()), { from: 1, carry: first.carry }),
    );
    // The If now holds (a Bug), so its Flag joins the lines and the next AI step moves down one.
    expect(segment.patch).toEqual({ set: { flagged: true } });
    expect(live.ai).toHaveLength(2);
    expect(live.ai[1]).toMatchObject({ step: 2, line: 3 });
    expect(live.wait).toEqual({ hours: 2, from: 4 });
    expect(live.lines.slice(1).map((l) => l.text)).toEqual([
      'Suggest and Set Card Type',
      'Card Type is Bug (Bug)',
      'Flag',
      'Suggest and Set Card Type',
      'Wait 2 Hours',
    ]);
  });

  it('keeps a message planned before the AI step, and adds the new plan’s after it', () => {
    const steps: AutomationStep[] = [hook, suggest, hook];
    const live = liveOf(steps, bug());
    const p = live.ai[0]!;
    replanAfter(live, p, planActions(steps, ctxFor(bug()), { from: 2, carry: p.carry }));
    expect(live.sends.map((s) => [s.step, s.line])).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });

  it('carries the run’s counts, so a card made before the AI step still counts', () => {
    const steps: AutomationStep[] = [
      { kind: 'create_card', type: 'note', title: 'Follow up' },
      suggest,
      { kind: 'copy_card' },
    ];
    const live = liveOf(steps, bug());
    const p = live.ai[0]!;
    expect(p.carry).toEqual({ actions: 2, turns: 0, made: 1 });
    replanAfter(live, p, planActions(steps, ctxFor(bug()), { from: 2, carry: p.carry }));
    expect(live.failed).toBe('A run makes up to 1 card');
  });
});
