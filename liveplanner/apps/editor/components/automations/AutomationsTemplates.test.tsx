// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The Automations screen" (Templates, Empty, Paused) and "Outgoing actions": the
// gallery under the empty list and on its own tab, New Rule's menu, a template opening the builder unsaved and off
// with its picks marked, a time rule's Next, Fix Webhook, and an outgoing action's webhook picker.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import { AutomationsDialog, templateStart } from './AutomationsDialog';
import type { AutomationsTarget } from './AutomationsContext';
import { forgetAutomations } from './use-automations';
import { ANA, NOW, outline, pickerTile, rule, run } from './test-fixtures';

const client = vi.hoisted(() => ({
  listAutomations: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  toggleRule: vi.fn(),
  listRuns: vi.fn(),
}));
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  ...client,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));
const listWebhooks = vi.hoisted(() => vi.fn());
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({
  indexClient: { listWebhooks },
}));
vi.mock('@liveworkspace/workbench/components/dialogs/ItemWebhooksDialog', () => ({
  ItemWebhooksDialog: ({
    open,
    onClose,
    title,
  }: {
    open: boolean;
    onClose: () => void;
    title: string;
  }) =>
    open ? (
      <div role="dialog" aria-label={`Webhooks for ${title}`}>
        <button type="button" onClick={onClose}>
          Close Webhooks
        </button>
      </div>
    ) : null,
}));

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const o = outline();
const plan = {
  types: o.types,
  statusNames: o.statuses,
  statusPhases: o.phases,
  people: o.people,
  items: o.items,
  self: ANA,
  openItem: vi.fn(),
  planTabs: () => [],
} as unknown as PlanContextValue;

const WEBHOOKS = [
  { id: 'w1', name: 'Launch Channel', kind: 'slack', pausedAt: null },
  { id: 'w2', name: 'Old Channel', kind: 'slack', pausedAt: NOW },
  { id: 'w3', name: 'Ops Service', kind: 'json', pausedAt: null },
];

function list(rules = [rule()]) {
  client.listAutomations.mockResolvedValue({ rules, runsToday: 3, runsPerDay: 1000 });
}

function Harness({
  initial = { view: 'rules' },
  signedIn = true,
}: {
  initial?: AutomationsTarget;
  signedIn?: boolean;
}) {
  const [target, setTarget] = useState(initial);
  return (
    <PlanProvider value={plan}>
      <AutomationsDialog
        scope={SCOPE}
        target={target}
        onTarget={setTarget}
        onClose={() => {}}
        planName="Launch Plan"
        signedIn={signedIn}
      />
    </PlanProvider>
  );
}

const cards = () => [...document.querySelectorAll('[data-step-card]')];

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
  client.listRuns.mockResolvedValue({ runs: [run()] });
  listWebhooks.mockResolvedValue({ webhooks: WEBHOOKS });
});
afterEach(cleanup);

describe('the Templates gallery', () => {
  it('sits under the empty list with its copy, and its chips narrow the tiles', async () => {
    list([]);
    render(<Harness />);
    const empty = await screen.findByText('No Rules Yet');
    expect(empty.closest('[data-rules-empty]')!.textContent).toContain(
      'moving, assigning, labelling and telling people about cards',
    );
    const tiles = () => document.querySelectorAll('[data-template]');
    expect(tiles()).toHaveLength(22);
    const chips = screen.getByRole('group', { name: 'Template categories' });
    expect(
      within(chips)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['All', 'Status', 'Assigning', 'Due Dates', 'Forms', 'Telling People', 'AI']);
    fireEvent.click(within(chips).getByRole('button', { name: 'Due Dates' }));
    expect(
      within(chips).getByRole('button', { name: 'Due Dates' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect([...tiles()].map((t) => t.getAttribute('data-template'))).toEqual([
      'overdue-nudge',
      'due-soon',
      'due-on-start',
    ]);
    fireEvent.click(within(chips).getByRole('button', { name: 'All' }));
    expect(tiles()).toHaveLength(22);
  });

  it('opens a template in the builder, unsaved and off, named uniquely, tracking its id', async () => {
    list([rule({ name: 'Overdue Nudge' })]);
    client.createRule.mockImplementation((_s: unknown, body: AutomationRuleBody) =>
      Promise.resolve({ rule: rule({ ...body, id: 'r9' }) }),
    );
    render(<Harness initial={{ view: 'templates' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Overdue Nudge/ }));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AutomationTemplate.overdue-nudge');
    expect(await screen.findByRole('textbox', { name: 'Rule name' })).toHaveProperty(
      'value',
      'Overdue Nudge 2',
    );
    // Unsaved: no On / Off chip until it is saved.
    expect(screen.queryByRole('switch', { name: /On|Off/ })).toBeNull();
    expect(cards()[0]!.textContent).toContain('Every');
    expect(cards()[0]!.textContent).toContain('Weekday at 9:00');
    expect(cards()[1]!.textContent).toContain('For cards where');
    fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
    await waitFor(() => expect(client.createRule).toHaveBeenCalled());
    expect(client.createRule.mock.calls[0]![1]).toMatchObject({
      name: 'Overdue Nudge 2',
      trigger: { kind: 'scheduled', every: 'weekday', at: '09:00' },
      timeZone: expect.any(String),
    });
  });

  it('marks what a template left to pick until it is picked', async () => {
    list([]);
    render(<Harness initial={{ view: 'rule', ruleId: null, template: 'shipped-to-slack' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    const marked = () => [...document.querySelectorAll('[data-pick]')].map((c) => c.textContent);
    expect(marked().some((t) => t?.includes('Pick a label'))).toBe(true);
    expect(marked().some((t) => t?.includes('Pick a webhook'))).toBe(true);
    const slack = cards().find((c) => c.textContent?.includes('Pick a webhook'))!;
    fireEvent.click(within(slack as HTMLElement).getAllByRole('button')[0]!);
    const picker = await screen.findByRole('combobox', { name: 'Webhook' });
    await waitFor(() =>
      expect(within(picker).getByRole('option', { name: 'Launch Channel' })).toBeTruthy(),
    );
    // Only the plan's Slack webhooks, a paused one said so.
    expect(within(picker).queryByRole('option', { name: 'Ops Service' })).toBeNull();
    expect(within(picker).getByRole('option', { name: 'Old Channel (Paused)' })).toBeTruthy();
    fireEvent.change(picker, { target: { value: 'w1' } });
    expect(marked().some((t) => t?.includes('Pick a webhook'))).toBe(false);
    expect(listWebhooks).toHaveBeenCalledTimes(1);
  });

  it('opens Start From a Template from New Rule’s menu, and a Blank Rule from it too', async () => {
    list();
    render(<Harness />);
    await screen.findByText('Done Means Wrapped Up');
    const header = screen.getAllByRole('button', { name: /New Rule/ })[0]!;
    fireEvent.click(header);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Start From a Template' }));
    expect(screen.getByRole('tab', { name: 'Templates' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('heading', { name: 'All Templates' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /New Rule/ })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Blank Rule' }));
    expect(await screen.findByRole('textbox', { name: 'Rule name' })).toHaveProperty(
      'value',
      'New Rule',
    );
  });

  it('shows the tiles but opens none once the plan holds its 50 rules', async () => {
    list(Array.from({ length: 50 }, (_, i) => rule({ id: `r${i}`, name: `Rule ${i}` })));
    render(<Harness initial={{ view: 'templates' }} />);
    expect(await screen.findByText(/This plan has 50 rules/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Overdue Nudge/ })).toHaveProperty('disabled', true);
  });
});

describe('building a time rule', () => {
  it('starts Assign on a person, not whoever triggered it, and adds a branch from its button', async () => {
    list();
    render(<Harness />);
    await screen.findByText('Done Means Wrapped Up');
    fireEvent.click(screen.getByRole('tab', { name: 'Templates' }));
    fireEvent.click(screen.getByRole('button', { name: /Due Soon Reminder/ }));
    await screen.findByRole('textbox', { name: 'Rule name' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Action' }).at(-1)!);
    fireEvent.click(pickerTile('assign')!);
    expect(screen.getByRole('combobox', { name: 'Assign To' })).toHaveProperty(
      'value',
      'person:u-ana',
    );
    fireEvent.click(screen.getByRole('button', { name: 'For Related Cards' }));
    expect(screen.getByRole('combobox', { name: 'For Each' })).toHaveProperty(
      'value',
      'blocked_by',
    );
  });
});

describe('templateStart', () => {
  it('builds over the plan, naming the rule uniquely; an unknown id builds nothing', () => {
    const got = templateStart(
      'stamp-finish',
      o,
      [{ id: 'r1', name: 'Stamp the Finish Date' }],
      'UTC',
    );
    expect(got!.body.name).toBe('Stamp the Finish Date 2');
    expect(got!.body.trigger).toEqual({ kind: 'card_moved', to: ['done'] });
    expect(templateStart('nope' as never, o, [], 'UTC')).toBeNull();
  });
});

describe('the Rules list in Phase 2', () => {
  it('says a time rule’s next moment, and offers Fix Webhook on a rule a webhook paused', async () => {
    list([
      rule({
        trigger: { kind: 'scheduled', every: 'weekday', at: '09:00' },
        stats: { lastRunAt: null, runsThisWeek: 0, failuresInARow: 0, nextAt: NOW + 3_600_000 },
      }),
      rule({
        id: 'r2',
        name: 'Ship It',
        enabled: false,
        paused: { reason: 'Launch Channel answered 410 Gone.', at: 1, webhook: 'w1' },
      }),
    ]);
    render(<Harness />);
    expect(await screen.findByText(/Next: /)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fix Webhook' }));
    expect(screen.getByRole('dialog', { name: 'Webhooks for Launch Plan' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close Webhooks' }));
    expect(screen.queryByRole('dialog', { name: 'Webhooks for Launch Plan' })).toBeNull();
  });
});

describe('an outgoing action', () => {
  async function openSlackStep(signedIn = true) {
    list([
      rule({
        steps: [
          {
            kind: 'notify',
            via: 'slack',
            webhook: 'w1',
            name: 'Launch Channel',
            text: 'Shipped {{card.title}}',
          },
        ],
      }),
    ]);
    render(<Harness initial={{ view: 'rule', ruleId: 'r1' }} signedIn={signedIn} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    const step = cards().find((c) => c.textContent?.includes('Launch Channel'))!;
    fireEvent.click(within(step as HTMLElement).getAllByRole('button')[0]!);
  }

  it('reads the plan’s webhooks once, and reads them again after Add a Webhook…', async () => {
    await openSlackStep();
    const picker = await screen.findByRole('combobox', { name: 'Webhook' });
    await waitFor(() => expect(picker).toHaveProperty('value', 'w1'));
    expect(listWebhooks).toHaveBeenCalledWith('p1', null);
    fireEvent.click(screen.getByRole('button', { name: 'Add a Webhook…' }));
    expect(screen.getByRole('dialog', { name: 'Webhooks for Launch Plan' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close Webhooks' }));
    });
    expect(listWebhooks).toHaveBeenCalledTimes(2);
  });

  it('offers Try Again when the list would not load', async () => {
    listWebhooks.mockRejectedValueOnce(new Error('offline'));
    await openSlackStep();
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('combobox', { name: 'Webhook' })).toBeTruthy();
    expect(listWebhooks).toHaveBeenCalledTimes(2);
  });

  it('tells a guest webhooks are an account’s, and reads nothing', async () => {
    await openSlackStep(false);
    expect(await screen.findByText(/only someone signed in can pick one/)).toBeTruthy();
    expect(listWebhooks).not.toHaveBeenCalled();
  });
});
