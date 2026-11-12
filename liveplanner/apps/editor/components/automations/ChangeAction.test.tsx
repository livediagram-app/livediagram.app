// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The rule builder", "Time triggers": Change the Action to Assign on a rule with
// nobody behind its trigger starts on the plan's first person, as + Add Action does, never on whoever triggered it
// (which the api refuses for a time rule or an incoming webhook).
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import type { AutomationRuleBody, AutomationTrigger } from '@liveplanner/items';
import { newRuleBody } from './rule-draft';
import { StepPanel } from './StepPanel';
import { startAction } from './step-defaults';
import { ANA, outline, pickStep } from './test-fixtures';

afterEach(cleanup);

let latest: AutomationRuleBody;
function Panel({ trigger }: { trigger: AutomationTrigger }) {
  const [b, setB] = useState<AutomationRuleBody>({
    ...newRuleBody('R', 'UTC'),
    trigger,
    steps: [{ kind: 'flag' }],
  });
  return (
    <StepPanel
      body={b}
      part={{ part: 'step', index: 0 }}
      onChange={(next) => {
        latest = next;
        setB(next);
      }}
      outline={outline()}
      faultPath={null}
      person="Ana Costa"
      now={Date.UTC(2026, 10, 11)}
      timeZone="Europe/London"
    />
  );
}

describe('Change the Action to Assign', () => {
  it('starts on the plan’s first person on a time rule', () => {
    render(<Panel trigger={{ kind: 'scheduled', every: 'weekday', at: '09:00' }} />);
    pickStep('assign');
    expect(latest.steps[0]).toEqual({ kind: 'assign', to: { person: ANA.id } });
  });

  it('starts on whoever triggered it when someone did', () => {
    render(<Panel trigger={{ kind: 'card_created' }} />);
    pickStep('assign');
    expect(latest.steps[0]).toEqual({ kind: 'assign', to: { trigger: true } });
  });

  it('starts on nobody when a personless plan has no one in it', () => {
    expect(startAction('assign', outline({ people: [] }), true)).toEqual({
      kind: 'assign',
      to: { nobody: true },
    });
    expect(startAction('flag', outline(), true)).toEqual({ kind: 'flag' });
  });
});
