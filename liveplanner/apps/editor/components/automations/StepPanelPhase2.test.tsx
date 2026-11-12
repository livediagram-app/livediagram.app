// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Time triggers", "For Related Cards", "Assign in turn" and "Outgoing actions":
// each Phase 2 step's panel, from the time trigger's Every and At to a branch's related cards and its Trigger values.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import { newRuleBody, type RulePart } from './rule-draft';
import { StepPanel } from './StepPanel';
import { PlanWebhooksProvider, type PlanWebhooks } from './plan-webhooks';
import { freshTimeTrigger, withEvery } from './step-panels/TimeTriggerPanel';
import { cardFields } from './step-panels/BranchPanel';
import { outline, pickStep } from './test-fixtures';

afterEach(cleanup);

let latest: AutomationRuleBody;
function Panel({
  body,
  part,
  o = outline(),
  hooks,
}: {
  body: AutomationRuleBody;
  part: RulePart;
  o?: ReturnType<typeof outline>;
  hooks?: PlanWebhooks;
}) {
  const [b, setB] = useState(body);
  const panel = (
    <StepPanel
      body={b}
      part={part}
      onChange={(next) => {
        latest = next;
        setB(next);
      }}
      outline={o}
      faultPath={null}
      person="Ana Costa"
      now={Date.UTC(2026, 10, 11)}
      timeZone="Europe/London"
    />
  );
  return hooks ? <PlanWebhooksProvider value={hooks}>{panel}</PlanWebhooksProvider> : panel;
}
const body = (over: Partial<AutomationRuleBody> = {}) => ({
  ...newRuleBody('Wrap Up', 'UTC'),
  ...over,
});
const every = (name: string) =>
  within(screen.getByRole('group', { name: 'Every' })).getByRole('button', {
    name: new RegExp(`^${name}\\b`),
  });
const pick = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });

describe('a time trigger', () => {
  it('starts Scheduled on weekdays at 9:00, names the time zone, and warns with no conditions', () => {
    render(<Panel body={body()} part={{ part: 'trigger' }} />);
    pickStep('scheduled');
    expect(latest.trigger).toEqual({ kind: 'scheduled', every: 'weekday', at: '09:00' });
    expect(document.querySelector('[data-time-zone]')!.textContent).toBe(
      'Times are Europe/London.',
    );
    expect(document.querySelector('[data-every-card]')!.textContent).toContain(
      'Runs on every card in the plan',
    );
    pick('At', '17:45');
    expect(latest.trigger).toMatchObject({ at: '17:45' });
  });

  it('picks Every: a week with its day chips, a month with its day', () => {
    render(<Panel body={body()} part={{ part: 'trigger' }} />);
    pickStep('scheduled');
    fireEvent.click(every('Week'));
    expect(latest.trigger).toEqual({ kind: 'scheduled', every: 'week', days: [1], at: '09:00' });
    fireEvent.click(screen.getByRole('button', { name: 'Fri' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sun' }));
    expect(latest.trigger).toMatchObject({ days: [0, 1, 5] });
    fireEvent.click(every('Month'));
    expect(latest.trigger).toEqual({
      kind: 'scheduled',
      every: 'month',
      dayOfMonth: 1,
      at: '09:00',
    });
    pick('On the', '31');
    expect(latest.trigger).toMatchObject({ dayOfMonth: 31 });
    expect(
      within(screen.getByRole('combobox', { name: 'On the' })).getByRole('option', {
        name: '22nd',
      }),
    ).toBeTruthy();
    fireEvent.click(every('Day'));
    expect(latest.trigger).toEqual({ kind: 'scheduled', every: 'day', at: '09:00' });
  });

  it('takes Due In’s days and Overdue’s time, and drops the warning once a condition is there', () => {
    render(
      <Panel
        body={body({ conditions: [{ kind: 'type', types: ['task'] }] })}
        part={{ part: 'trigger' }}
      />,
    );
    pickStep('due_in');
    expect(latest.trigger).toEqual({ kind: 'due_in', days: 2, at: '09:00' });
    pick('Days Before It’s Due', '30');
    expect(latest.trigger).toMatchObject({ days: 30 });
    expect(document.querySelector('[data-every-card]')).toBeNull();
    pickStep('overdue');
    expect(latest.trigger).toEqual({ kind: 'overdue', at: '09:00' });
    expect(document.querySelector('[data-time-zone]')!.textContent).toContain(
      'on the day after the card was due',
    );
  });

  it('starts and switches its forms purely', () => {
    expect(freshTimeTrigger('overdue')).toEqual({ kind: 'overdue', at: '09:00' });
    expect(withEvery({ kind: 'scheduled', every: 'week', days: [3], at: '09:00' }, 'week')).toEqual(
      { kind: 'scheduled', every: 'week', days: [3], at: '09:00' },
    );
    expect(
      withEvery({ kind: 'scheduled', every: 'month', dayOfMonth: 9, at: '09:00' }, 'month'),
    ).toMatchObject({ dayOfMonth: 9 });
  });
});

describe('Assign', () => {
  it('assigns People in Turn, in the order picked, each removable', () => {
    render(
      <Panel
        body={body({ steps: [{ kind: 'assign', to: { trigger: true } }] })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    pick('Assign To', 'rotate');
    expect(latest.steps[0]).toEqual({ kind: 'assign', to: { rotate: [] } });
    expect(screen.getByText('Pick at least 2 people.', { exact: false })).toBeTruthy();
    pick('Add Person', 'u-marco');
    pick('Add Person', 'u-ana');
    expect(latest.steps[0]).toEqual({ kind: 'assign', to: { rotate: ['u-marco', 'u-ana'] } });
    const chips = screen.getByRole('list', { name: 'People in turn' });
    expect(
      within(chips)
        .getAllByRole('listitem')
        .map((c) => c.textContent),
    ).toEqual(['1Marco Ruiz', '2Ana Costa']);
    expect(screen.getByText(/Each run assigns the next person/)).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Add Person' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Marco Ruiz' }));
    expect(latest.steps[0]).toEqual({ kind: 'assign', to: { rotate: ['u-ana'] } });
  });

  it('offers nobody behind a time trigger', () => {
    render(
      <Panel
        body={body({
          trigger: { kind: 'overdue', at: '09:00' },
          steps: [{ kind: 'assign', to: { nobody: true } }],
        })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    const options = within(screen.getByRole('combobox', { name: 'Assign To' }))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).not.toContain('The Person Who Triggered It');
    expect(options).toContain('People in Turn');
  });
});

describe('For Related Cards', () => {
  const branch = (related: object) =>
    body({
      steps: [{ kind: 'for', related, conditions: [], then: [{ kind: 'comment', text: '' }] }],
    } as Partial<AutomationRuleBody>);

  it('picks which related cards, a Card field for linked ones, and a board’s saved filter', () => {
    render(<Panel body={branch({ kind: 'blocked_by' })} part={{ part: 'step', index: 0 }} />);
    expect(screen.getByText('The cards this card is blocked by.')).toBeTruthy();
    pick('For Each', 'linked');
    expect(latest.steps[0]).toMatchObject({ related: { kind: 'linked' } });
    expect(screen.getByRole('combobox', { name: 'Through' })).toHaveProperty('value', '');
    pick('For Each', 'saved_filter');
    expect(latest.steps[0]).toMatchObject({
      related: { kind: 'saved_filter', tab: 't-board', filter: 'f1' },
    });
    pick('For Each', 'children');
    expect(latest.steps[0]).toMatchObject({ related: { kind: 'children' } });
    expect(screen.getByText(/up to 10 actions/)).toBeTruthy();
  });

  it('keeps a Card field no longer there readable', () => {
    render(
      <Panel body={branch({ kind: 'linked', field: 'gone' })} part={{ part: 'step', index: 0 }} />,
    );
    expect(screen.getByRole('option', { name: 'A field no longer here' })).toBeTruthy();
    pick('Through', '');
    expect(latest.steps[0]).toMatchObject({ related: { kind: 'linked' } });
  });

  it('offers the Trigger values inside the branch alone', () => {
    render(
      <Panel
        body={branch({ kind: 'children' })}
        part={{ part: 'branch', step: 0, side: 'then', index: 0 }}
      />,
    );
    const values = screen.getByRole('group', { name: 'Insert a Value into Comment' });
    for (const name of ['Trigger Title', 'Trigger Number', 'Trigger Link'])
      expect(within(values).getByRole('button', { name })).toBeTruthy();
    fireEvent.click(within(values).getByRole('button', { name: 'Trigger Title' }));
    expect(latest.steps[0]).toMatchObject({ then: [{ text: '{{trigger.title}}' }] });
    // A branch holds no Create Card.
    fireEvent.click(document.querySelector('[data-change-step]')!);
    expect(document.querySelector('[data-picker-tile="set_field"]')).toBeTruthy();
    expect(document.querySelector('[data-picker-tile="create_card"]')).toBeNull();
    cleanup();
    render(
      <Panel
        body={body({ steps: [{ kind: 'comment', text: '' }] })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Trigger Title' })).toBeNull();
  });

  it('lists the plan’s Card fields once each', () => {
    const o = outline();
    const types = [
      {
        ...o.types[0]!,
        fields: [...o.types[0]!.fields, 'cf1'],
        custom: [{ id: 'cf1', label: 'Depends On', kind: 'card' as const }],
      },
      {
        ...o.types[0]!,
        id: 'other',
        fields: [...o.types[0]!.fields, 'cf1'],
        custom: [{ id: 'cf1', label: 'Depends On', kind: 'card' as const }],
      },
    ];
    expect(cardFields({ types })).toEqual([{ id: 'cf1', name: 'Depends On' }]);
  });
});

describe('an outgoing action', () => {
  const hooks = (over: Partial<PlanWebhooks> = {}): PlanWebhooks => ({
    status: 'ready',
    webhooks: [
      { id: 'w1', name: 'Launch Channel', kind: 'slack', pausedAt: null },
      { id: 'w4', name: 'Team Room', kind: 'teams', pausedAt: null },
    ] as never,
    load: vi.fn(),
    retry: vi.fn(),
    openDialog: vi.fn(),
    ...over,
  });

  it('switches between Webhook, Slack and Teams, keeping the message, and saves the webhook’s name', () => {
    const h = hooks();
    render(
      <Panel
        body={body({
          steps: [{ kind: 'notify', via: 'slack', webhook: '', text: 'Shipped {{card.title}}' }],
        })}
        part={{ part: 'step', index: 0 }}
        hooks={h}
      />,
    );
    expect(h.load).toHaveBeenCalled();
    pickStep('notify_teams');
    expect(latest.steps[0]).toMatchObject({
      via: 'teams',
      text: 'Shipped {{card.title}}',
      webhook: '',
    });
    pick('Webhook', 'w4');
    expect(latest.steps[0]).toMatchObject({ webhook: 'w4', name: 'Team Room' });
    expect(screen.getByText(/To Team Room/)).toBeTruthy();
  });

  it('says a webhook it names is no longer here, and offers one when the plan has none of the kind', () => {
    render(
      <Panel
        body={body({
          steps: [{ kind: 'notify', via: 'webhook', webhook: 'gone', name: 'Old', text: 'x' }],
        })}
        part={{ part: 'step', index: 0 }}
        hooks={hooks()}
      />,
    );
    expect(screen.getByRole('option', { name: /No Longer Here/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a Webhook…' })).toBeTruthy();
  });

  it('says it is reading while the list loads', () => {
    render(
      <Panel
        body={body({ steps: [{ kind: 'notify', via: 'slack', webhook: '', text: 'x' }] })}
        part={{ part: 'step', index: 0 }}
        hooks={hooks({ status: 'loading', webhooks: [] })}
      />,
    );
    expect(screen.getByRole('option', { name: 'Loading webhooks…' })).toBeTruthy();
  });
});
