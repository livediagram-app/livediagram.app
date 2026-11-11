// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The rule builder", "For Related Cards", "Outgoing actions" and "Audit Trail": a
// branch's card with its own steps inset under it and its own add buttons, an outgoing action's card and its place in
// Add Action, a time rule's When card, the marks a template leaves, and a branch's lines in a run.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationOutgoing, AutomationRuleBody } from '@liveplanner/items';
import { newRuleBody } from './rule-draft';
import { RuleSteps, type StepsActions } from './RuleSteps';
import { RunSteps } from './RunSteps';
import { nextRunWords } from './run-words';
import { outline } from './test-fixtures';

afterEach(cleanup);

const actions = (): StepsActions => ({
  select: vi.fn(),
  edit: vi.fn(),
  addCondition: vi.fn(),
  addAction: vi.fn(),
  addIfElse: vi.fn(),
  addBranch: vi.fn(),
});
const body = (over: Partial<AutomationRuleBody> = {}): AutomationRuleBody => ({
  ...newRuleBody('R', 'UTC'),
  ...over,
});
const slack: AutomationOutgoing = {
  kind: 'notify',
  via: 'slack',
  webhook: 'w1',
  name: 'Launch Channel',
  text: 'Shipped {{card.title}}',
};
const steps = (b: AutomationRuleBody, a = actions(), picks?: ReadonlyMap<string, string>) =>
  render(
    <RuleSteps
      body={b}
      outline={outline()}
      selected={null}
      fault={null}
      actions={a}
      picks={picks}
    />,
  );
const menuNames = () => screen.getAllByRole('menuitem').map((m) => m.textContent);

describe('the steps, in Phase 2', () => {
  it('draws a branch as For each, its own steps inset under it with their own add buttons', () => {
    const a = actions();
    steps(
      body({
        steps: [
          {
            kind: 'for',
            related: { kind: 'blocked_by' },
            conditions: [{ kind: 'type', types: ['task'] }],
            then: [{ kind: 'comment', text: 'Unblocked by {{trigger.title}}' }],
          },
        ],
      }),
      a,
    );
    const branch = document.querySelector('[data-branch-step]') as HTMLElement;
    expect(branch.textContent).toContain('For each');
    expect(branch.textContent).toContain('Blocked By');
    const inner = within(branch);
    expect(inner.getByText('If')).toBeTruthy();
    expect(inner.getByText('Then')).toBeTruthy();
    expect(branch.textContent).toContain('trigger.title');
    // Its Add Action leaves out Create Card and the outgoing actions.
    fireEvent.click(inner.getByRole('button', { name: 'Add Action' }));
    expect(menuNames()).not.toContain('Create Card');
    expect(menuNames()).not.toContain('Post to Slack');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Flag' }));
    expect(a.addAction).toHaveBeenCalledWith('flag', { step: 0, side: 'then' });
    fireEvent.click(inner.getByRole('button', { name: 'Add Condition' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Card Type' }));
    expect(a.addCondition).toHaveBeenCalledWith('type', 0);
  });

  it('says what an empty branch waits for', () => {
    steps(
      body({ steps: [{ kind: 'for', related: { kind: 'children' }, conditions: [], then: [] }] }),
    );
    expect(screen.getByText('Add an action to run on each one.')).toBeTruthy();
  });

  it('offers + For Related Cards and the outgoing actions at the top, until the rule holds 5', () => {
    const a = actions();
    steps(body({ steps: [slack] }), a);
    expect(screen.getByText('Shipped')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'For Related Cards' }));
    expect(a.addBranch).toHaveBeenCalled();
    const add = screen.getAllByRole('button', { name: 'Add Action' }).at(-1)!;
    fireEvent.click(add);
    expect(menuNames()).toEqual(
      expect.arrayContaining(['Send to Webhook', 'Post to Slack', 'Post to Microsoft Teams']),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Post to Microsoft Teams' }));
    expect(a.addAction).toHaveBeenCalledWith('notify_teams');
    cleanup();
    steps(body({ steps: Array.from({ length: 5 }, () => slack) }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Action' }).at(-1)!);
    expect(menuNames()).not.toContain('Post to Slack');
  });

  it('warns on a time rule’s When card while it has no conditions', () => {
    steps(body({ trigger: { kind: 'scheduled', every: 'weekday', at: '09:00' } }));
    const when = document.querySelector('[data-step-card]')!;
    expect(when.textContent).toContain('Weekday at 9:00');
    expect(when.querySelector('[data-every-card]')!.textContent).toBe(
      'Runs on every card in the plan',
    );
    cleanup();
    steps(
      body({
        trigger: { kind: 'overdue', at: '09:00' },
        conditions: [{ kind: 'type', types: ['idea'] }],
      }),
    );
    expect(document.querySelector('[data-every-card]')).toBeNull();
    expect(screen.getByText('For cards where')).toBeTruthy();
  });

  it('marks a step a template left to pick', () => {
    steps(
      body({ steps: [{ ...slack, webhook: '' }] }),
      actions(),
      new Map([['steps.0', 'Pick a webhook']]),
    );
    const marked = document.querySelector('[data-pick]')!;
    expect(marked.textContent).toContain('Pick a webhook');
  });
});

describe('a run’s lines, in Phase 2', () => {
  it('marks a branch’s line and insets each related card’s lines under it', () => {
    render(
      <RunSteps
        steps={[
          { kind: 'trigger', text: 'moved the card to Done' },
          {
            kind: 'branch',
            ok: false,
            text: 'For each Child Card: on 2 related cards, failed on #13',
            cards: 2,
          },
          { kind: 'action', ok: true, text: '#12 Removed the label blocked' },
          { kind: 'condition', ok: false, text: '#13 Flagged is not so' },
          { kind: 'action', ok: true, text: 'Queued for Launch Channel' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[1]!.textContent).toContain('Branch, failed: ');
    expect(items[2]!.hasAttribute('data-run-related')).toBe(true);
    expect(items[3]!.hasAttribute('data-run-related')).toBe(true);
    expect(items[4]!.hasAttribute('data-run-related')).toBe(false);
    expect(within(items[2]!).getByText('#12')).toBeTruthy();
    cleanup();
    render(
      <RunSteps
        steps={[
          {
            kind: 'branch',
            ok: true,
            text: 'For each Blocked By Card: on 0 related cards',
            cards: 0,
          },
        ]}
      />,
    );
    expect(screen.getByRole('listitem').textContent).toContain('Branch: ');
  });
});

describe('nextRunWords', () => {
  const now = new Date(2026, 10, 11, 8, 0).getTime();
  it('says today, tomorrow, a weekday within the week, else the date', () => {
    expect(nextRunWords(new Date(2026, 10, 11, 9, 0).getTime(), now)).toBe('Today 9:00');
    expect(nextRunWords(new Date(2026, 10, 12, 9, 15).getTime(), now)).toBe('Tomorrow 9:15');
    expect(nextRunWords(new Date(2026, 10, 16, 9, 0).getTime(), now)).toBe('Mon 9:00');
    expect(nextRunWords(new Date(2026, 11, 12, 17, 30).getTime(), now)).toBe('12 Dec 17:30');
  });
});
