// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The rule builder": a step panel shows what the rule holds even when the plan no
// longer has it (a deleted column, Form tab, field, card type or person), so it can be seen and unpicked, rather than
// hiding the pick or showing the select's first choice.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import type {
  AutomationCondition,
  AutomationRuleBody,
  AutomationTrigger,
} from '@liveplanner/items';
import { newRuleBody, type RulePart } from './rule-draft';
import { StepPanel } from './StepPanel';
import { outline } from './test-fixtures';

afterEach(cleanup);

let latest: AutomationRuleBody;
function Panel({ body, part }: { body: AutomationRuleBody; part: RulePart }) {
  const [b, setB] = useState(body);
  return (
    <StepPanel
      body={b}
      part={part}
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
const withTrigger = (trigger: AutomationTrigger) => ({ ...newRuleBody('R', 'UTC'), trigger });
const withCondition = (c: AutomationCondition) => ({
  ...newRuleBody('R', 'UTC'),
  conditions: [c],
});
const TRIGGER: RulePart = { part: 'trigger' };
const CONDITION: RulePart = { part: 'condition', index: 0 };
const select = (name: string) => screen.getByRole<HTMLSelectElement>('combobox', { name });

describe('a pick the plan no longer has', () => {
  it('stays a pressed chip under Card Moved, and unpicking it clears it', () => {
    render(<Panel body={withTrigger({ kind: 'card_moved', to: ['gone-col'] })} part={TRIGGER} />);
    const chip = screen.getByRole('button', { name: 'A column no longer here' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    // The hint says what an empty pick means, so it stays hidden while the gone column is picked.
    expect(screen.queryByText('None picked: to any column.')).toBeNull();
    fireEvent.click(chip);
    expect(latest.trigger).toEqual({ kind: 'card_moved', to: [] });
    expect(screen.getByText('None picked: to any column.')).toBeTruthy();
  });

  it('keeps a deleted column in Card Created and Column Over Limit', () => {
    render(
      <Panel body={withTrigger({ kind: 'card_created', status: 'gone-col' })} part={TRIGGER} />,
    );
    expect(select('In Column').value).toBe('gone-col');
    expect(select('In Column').selectedOptions[0]!.textContent).toBe('A column no longer here');
    // Above the plan's own columns, where every panel keeps its gone pick.
    expect(select('In Column').options[1]!.textContent).toBe('A column no longer here');
    cleanup();
    render(
      <Panel
        body={withTrigger({ kind: 'column_limit', status: 'gone-col', limit: 5 })}
        part={TRIGGER}
      />,
    );
    expect(select('Column').value).toBe('gone-col');
    expect(select('Column').selectedOptions[0]!.textContent).toBe('A column no longer here');
    expect(select('Column').options[0]!.textContent).toBe('A column no longer here');
  });

  it('keeps a deleted Form tab under Form Response', () => {
    render(
      <Panel body={withTrigger({ kind: 'form_response', formTab: 't-gone' })} part={TRIGGER} />,
    );
    expect(select('Form').value).toBe('t-gone');
    expect(select('Form').selectedOptions[0]!.textContent).toBe('A form no longer here');
    expect(select('Form').options[1]!.textContent).toBe('A form no longer here');
  });

  it('names Field Changed’s gone field, and a built-in field no type lists by its name', () => {
    render(
      <Panel
        body={withTrigger({ kind: 'field_changed', fields: ['f-gone', 'flagged'] })}
        part={TRIGGER}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'A field no longer here' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByRole('button', { name: 'Flagged' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('shows a gone person under Someone Mentioned and Who Did It, each group its own', () => {
    render(<Panel body={withTrigger({ kind: 'mentioned', people: ['u-gone'] })} part={TRIGGER} />);
    expect(screen.getByRole('button', { name: 'Someone No Longer Here' })).toBeTruthy();
    cleanup();
    render(
      <Panel
        body={withCondition({ kind: 'who', who: [{ role: 'editor' }, { person: 'u-gone' }] })}
        part={CONDITION}
      />,
    );
    // Only the People group holds the gone person; the Roles group shows no stray chip for it.
    expect(screen.getAllByRole('button', { name: 'Someone No Longer Here' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Someone No Longer Here' }));
    expect(latest.conditions[0]).toEqual({ kind: 'who', who: [{ role: 'editor' }] });
    fireEvent.click(screen.getByRole('button', { name: 'An Editor' }));
    expect(latest.conditions[0]).toEqual({ kind: 'who', who: [] });
  });

  it('shows a gone card type and column under the Card Type and Column conditions', () => {
    render(<Panel body={withCondition({ kind: 'type', types: ['t-gone'] })} part={CONDITION} />);
    expect(screen.getByRole('button', { name: 'A card type no longer here' })).toBeTruthy();
    cleanup();
    render(
      <Panel body={withCondition({ kind: 'column', statuses: ['gone-col'] })} part={CONDITION} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'A column no longer here' }));
    expect(latest.conditions[0]).toEqual({ kind: 'column', statuses: [] });
  });
});

describe('Set Field from another field the plan no longer has', () => {
  it('keeps the gone field shown under From Field', () => {
    render(
      <Panel
        body={{
          ...newRuleBody('R', 'UTC'),
          steps: [{ kind: 'set_field', field: 'due', value: { from: 'f-gone' } }],
        }}
        part={{ part: 'step', index: 0 }}
      />,
    );
    expect(select('From Field').value).toBe('f-gone');
    expect(select('From Field').selectedOptions[0]!.textContent).toBe('A field no longer here');
  });
});

describe('Create Card in a column the plan no longer has', () => {
  it('keeps the gone column shown', () => {
    render(
      <Panel
        body={{
          ...newRuleBody('R', 'UTC'),
          steps: [{ kind: 'create_card', type: 'task', title: 'Check', status: 'gone-col' }],
        }}
        part={{ part: 'step', index: 0 }}
      />,
    );
    expect(select('Column').value).toBe('gone-col');
    expect(select('Column').selectedOptions[0]!.textContent).toBe('A column no longer here');
  });
});
