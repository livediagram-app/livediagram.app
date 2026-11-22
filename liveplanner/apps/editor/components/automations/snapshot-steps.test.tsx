// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Snapshot steps", in the builder: the Snapshots group after Comments with the
// platform's two tiles, a Take Snapshot's name previewed, a Scheduled rule of them saying it runs once for the plan,
// and a snapshot gone named in Needs Attention and in a refusal's words.
import './test-kit';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AutomationRuleBody } from '@liveplanner/items';
import { RuleContextProvider } from '@liveworkspace/automations-ui/rule-context';
import { needsWords } from './needs-words';
import { PLAN_AUTOMATIONS_KIT } from './plan-kit';
import { REFUSAL_PICKS } from './plan-words';
import { PlanTriggerNote, TimeTriggerPanel } from './step-panels/TimeTriggerPanel';

afterEach(cleanup);

const weekly = { kind: 'scheduled' as const, every: 'week' as const, days: [1], at: '09:00' };
const body = (steps: AutomationRuleBody['steps']): AutomationRuleBody => ({
  name: 'Monday Reset',
  trigger: weekly,
  conditions: [],
  steps,
  chain: false,
  timeZone: 'UTC',
});
const revert = { kind: 'revert_snapshot', snapshot: 'sn1', name: 'Monday Start' } as const;
const take = { kind: 'take_snapshot', name: 'Weekly {{now.date}}' } as const;

describe('the Snapshots group', () => {
  it('stands after Comments, with Take Snapshot and Revert to Snapshot', () => {
    const groups = PLAN_AUTOMATIONS_KIT.kinds.actionGroups.map((g) => g.id);
    expect(groups.indexOf('snapshots')).toBe(groups.indexOf('comments') + 1);
    const group = PLAN_AUTOMATIONS_KIT.kinds.actionGroups.find((g) => g.id === 'snapshots')!;
    expect(group.kinds).toEqual(['take_snapshot', 'revert_snapshot']);
    const actions = PLAN_AUTOMATIONS_KIT.kinds.actions as Record<
      string,
      { name: string; top?: boolean; last?: boolean }
    >;
    expect(actions['take_snapshot']).toMatchObject({ name: 'Take Snapshot', top: true });
    expect(actions['revert_snapshot']).toMatchObject({ name: 'Revert to Snapshot', last: true });
  });

  it('previews a Take Snapshot’s name', () => {
    expect(PLAN_AUTOMATIONS_KIT.previewText?.(take)).toBe('Weekly {{now.date}}');
    expect(PLAN_AUTOMATIONS_KIT.previewText?.(revert)).toBeNull();
  });
});

describe('a Scheduled rule that runs for the plan', () => {
  it('says once for the plan, not the every-card warning, on its When card and in its panel', () => {
    render(<PlanTriggerNote body={body([revert])} compact />);
    expect(screen.getByText('Runs once for the plan, not for each card')).toBeTruthy();
    cleanup();
    render(<PlanTriggerNote body={body([{ kind: 'flag' }])} compact />);
    expect(screen.getByText('Runs on every card in the plan')).toBeTruthy();
    cleanup();
    render(<PlanTriggerNote body={{ ...body([revert]), trigger: { kind: 'card_created' } }} />);
    expect(document.body.textContent).toBe('');
    cleanup();
    render(
      <RuleContextProvider
        value={{ body: body([revert]), incoming: false, ruleId: null, hook: undefined, now: 0 }}
      >
        <TimeTriggerPanel
          trigger={weekly}
          onChange={() => {}}
          columns={[]}
          timeZone="UTC"
          conditions={0}
        />
      </RuleContextProvider>,
    );
    expect(document.querySelector('[data-callout="info"]')!.textContent).toContain(
      'Runs once for the plan, not for each card.',
    );
    expect(document.querySelector('[data-callout="warning"]')).toBeNull();
    cleanup();
    render(
      <RuleContextProvider
        value={{
          body: body([{ kind: 'flag' }]),
          incoming: false,
          ruleId: null,
          hook: undefined,
          now: 0,
        }}
      >
        <TimeTriggerPanel
          trigger={weekly}
          onChange={() => {}}
          columns={[]}
          timeZone="UTC"
          conditions={0}
        />
      </RuleContextProvider>,
    );
    expect(document.querySelector('[data-callout="warning"]')).not.toBeNull();
  });
});

describe('a snapshot gone', () => {
  it('names the snapshot by the name the step kept', () => {
    expect(needsWords([{ kind: 'snapshot', id: 'sn1', name: 'Monday Start' }])).toBe(
      'Snapshot “Monday Start” is gone',
    );
    expect(needsWords([{ kind: 'snapshot', id: 'sn1' }])).toBe('A snapshot is gone');
    expect(REFUSAL_PICKS['snapshot']).toBe('a snapshot');
  });
});
