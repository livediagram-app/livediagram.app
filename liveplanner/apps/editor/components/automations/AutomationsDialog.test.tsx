// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The Automations screen": the Rules list in every state, the Audit Trail, and the
// rule builder's save, refusal, discard and test, with the api client mocked.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import { AutomationsDialog } from './AutomationsDialog';
import type { AutomationsTarget } from './AutomationsContext';
import { forgetAutomations } from './use-automations';
import { ANA, outline, rule, run } from './test-fixtures';

const client = vi.hoisted(() => ({
  listAutomations: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  toggleRule: vi.fn(),
  duplicateRule: vi.fn(),
  deleteRule: vi.fn(),
  testRule: vi.fn(),
  runRule: vi.fn(),
  listRuns: vi.fn(),
}));
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  ...client,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const toast = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const { AutomationRefusal } = await import('./automations-client');

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const o = outline();
const openItem = vi.fn();
const plan = {
  types: o.types,
  statusNames: o.statuses,
  people: o.people,
  items: o.items,
  self: ANA,
  openItem,
  planTabs: () => [],
} as unknown as PlanContextValue;

function list(rules = [rule()]) {
  client.listAutomations.mockResolvedValue({ rules, runsToday: 142, runsPerDay: 1000 });
}

function Harness({
  initial = { view: 'rules' },
  onClose = () => {},
}: {
  initial?: AutomationsTarget;
  onClose?: () => void;
}) {
  const [target, setTarget] = useState(initial);
  return (
    <PlanProvider value={plan}>
      <AutomationsDialog scope={SCOPE} target={target} onTarget={setTarget} onClose={onClose} />
    </PlanProvider>
  );
}
const wrap = (node: ReactNode) => render(<>{node}</>);

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
  client.listRuns.mockResolvedValue({ runs: [run()] });
});
afterEach(cleanup);

describe('the Rules list', () => {
  it('loads, then shows each rule with its switch, sentence, last run and week, and the meter', async () => {
    list();
    wrap(<Harness />);
    expect(screen.getByRole('status', { name: 'Loading rules' })).toBeTruthy();
    const row = await screen.findByText('Done Means Wrapped Up');
    const li = row.closest('li')!;
    expect(within(li).getByRole('switch', { name: 'Done Means Wrapped Up' })).toBeTruthy();
    expect(li.textContent).toContain('38 runs');
    expect(screen.getByRole('tab', { name: 'Rules · 1' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe(
      '142 of 1,000 runs today',
    );
  });

  it('shows the empty state, whose New Rule opens the builder', async () => {
    list([]);
    wrap(<Harness />);
    expect(await screen.findByText('No Rules Yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Learn about automations' })).toBeTruthy();
    fireEvent.click(
      within(document.querySelector('[data-rules-empty]')!).getByRole('button', {
        name: /New Rule/,
      }),
    );
    expect(await screen.findByRole('textbox', { name: 'Rule name' })).toHaveProperty(
      'value',
      'New Rule',
    );
  });

  it('says when only an Editor may see rules, and offers Try Again after a failed read', async () => {
    client.listAutomations.mockRejectedValueOnce(
      new AutomationRefusal(403, { error: 'automations_need_editor' }),
    );
    wrap(<Harness />);
    expect(await screen.findByText('Only an Editor Can See Rules')).toBeTruthy();
    cleanup();
    forgetAutomations();
    client.listAutomations.mockRejectedValueOnce(new Error('offline'));
    wrap(<Harness />);
    list();
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Done Means Wrapped Up')).toBeTruthy();
  });

  it('shows a paused rule’s reason with Resume, and a rule needing attention', async () => {
    list([
      rule({ paused: { reason: 'the webhook answered 410 Gone.', at: 1 }, enabled: false }),
      rule({ id: 'r2', name: 'Triage', needs: ['the column Review'] }),
    ]);
    client.toggleRule.mockResolvedValue({ rule: rule() });
    wrap(<Harness />);
    expect(await screen.findByText(/the webhook answered 410 Gone/)).toBeTruthy();
    expect(screen.getByText(/Needs Attention/).closest('p,div')!.textContent).toContain(
      'the column Review',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(client.toggleRule).toHaveBeenCalledWith(SCOPE, 'r1', true));
    expect(track).toHaveBeenCalledWith('Plan', 'Toggled', 'AutomationOn');
  });

  it('turns a rule off from its switch', async () => {
    list();
    client.toggleRule.mockResolvedValue({ rule: rule({ enabled: false }) });
    wrap(<Harness />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Done Means Wrapped Up' }));
    await waitFor(() => expect(client.toggleRule).toHaveBeenCalledWith(SCOPE, 'r1', false));
    expect(track).toHaveBeenCalledWith('Plan', 'Toggled', 'AutomationOff');
  });

  it('narrows by search and filters, and says so with Clear when nothing matches', async () => {
    list([
      rule(),
      rule({ id: 'r2', name: 'Escalate', trigger: { kind: 'manual' }, enabled: false }),
    ]);
    wrap(<Harness />);
    await screen.findByText('Escalate');
    fireEvent.change(screen.getByRole('combobox', { name: 'On or off' }), {
      target: { value: 'off' },
    });
    expect(screen.queryByText('Done Means Wrapped Up')).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a rule' }), {
      target: { value: 'zzz' },
    });
    expect(screen.queryByText('Escalate')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search and Filters' }));
    expect(screen.getByText('Escalate')).toBeTruthy();
    expect(screen.getByText('Done Means Wrapped Up')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Trigger' }), {
      target: { value: 'manual' },
    });
    expect(screen.queryByText('Done Means Wrapped Up')).toBeNull();
  });

  it('duplicates and deletes from the ⋯ menu, Delete asking first', async () => {
    list();
    client.duplicateRule.mockResolvedValue({
      rule: rule({ id: 'r9', name: 'Done Means Wrapped Up 2' }),
    });
    client.deleteRule.mockResolvedValue(undefined);
    wrap(<Harness />);
    const more = await screen.findByRole('button', { name: 'More for Done Means Wrapped Up' });
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(await screen.findByText('Done Means Wrapped Up 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'More for Done Means Wrapped Up' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Rule' }));
    await waitFor(() => expect(client.deleteRule).toHaveBeenCalledWith(SCOPE, 'r1'));
    expect(track).toHaveBeenCalledWith('Plan', 'Deleted', 'AutomationRule');
  });

  it('toasts a change the api refused', async () => {
    list();
    client.duplicateRule.mockRejectedValue(
      new AutomationRefusal(409, { error: 'automation_rules_full', message: 'Full.' }),
    );
    wrap(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'More for Done Means Wrapped Up' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Full.'));
  });
});

describe('the Audit Trail', () => {
  it('opens on a rule’s runs from its menu, expands a run to its steps, and opens its card', async () => {
    list();
    const onClose = vi.fn();
    wrap(<Harness onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: 'More for Done Means Wrapped Up' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Audit Trail' }));
    await waitFor(() =>
      expect(client.listRuns).toHaveBeenCalledWith(
        SCOPE,
        expect.objectContaining({ rule: 'r1', limit: 200 }),
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Expand run' }));
    expect(screen.getByText('Removed the label blocked')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Card' }));
    expect(onClose).toHaveBeenCalled();
    expect(openItem).toHaveBeenCalledWith('i48');
  });

  it('shows a failed run’s reason, an empty log, and a filter matching nothing', async () => {
    list();
    client.listRuns.mockResolvedValueOnce({
      runs: [run({ result: 'failed', reason: 'Slack said no.' })],
    });
    wrap(<Harness initial={{ view: 'runs' }} />);
    expect(await screen.findByText('Slack said no.')).toBeTruthy();
    client.listRuns.mockResolvedValue({ runs: [] });
    fireEvent.change(screen.getByRole('combobox', { name: 'Result' }), {
      target: { value: 'failed' },
    });
    expect(await screen.findByRole('button', { name: /Clear/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Clear/ }));
    expect(await screen.findByText('No Runs Yet')).toBeTruthy();
  });

  it('offers Try Again when the log would not load', async () => {
    list();
    client.listRuns.mockRejectedValueOnce(new Error('offline'));
    wrap(<Harness initial={{ view: 'runs' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Done Means Wrapped Up', { selector: 'span' })).toBeTruthy();
  });
});

describe('the rule builder', () => {
  it('builds a new rule, adds an action, saves it and tracks the create', async () => {
    list([]);
    client.createRule.mockImplementation((_s: unknown, body: AutomationRuleBody) =>
      Promise.resolve({ rule: rule({ ...body, id: 'r5' }) }),
    );
    wrap(<Harness initial={{ view: 'rule', ruleId: null }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Action' }).at(-1)!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Flag' }));
    expect(screen.getByText('Flags the card. Nothing else to set.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
    await waitFor(() => expect(client.createRule).toHaveBeenCalled());
    expect(client.createRule.mock.calls[0]![1]).toMatchObject({
      name: 'New Rule',
      steps: [{ kind: 'flag' }],
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Created', 'AutomationRule');
  });

  it('marks the step a refusal names and selects it', async () => {
    list([rule({ steps: [{ kind: 'comment', text: '{{nope}}' }] })]);
    client.updateRule.mockRejectedValue(
      new AutomationRefusal(400, { error: 'automation_value_unknown', path: 'steps.0.text' }),
    );
    wrap(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    const name = await screen.findByRole('textbox', { name: 'Rule name' });
    fireEvent.change(name, { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Insert a Value'),
    );
    expect(document.querySelector('[data-fault]')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Comment' })).toBeTruthy();
  });

  it('asks Discard Changes? before leaving with unsaved changes', async () => {
    list();
    wrap(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    const name = await screen.findByRole('textbox', { name: 'Rule name' });
    fireEvent.change(name, { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Automations' }));
    expect(screen.getByText('Discard Changes?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }));
    expect(screen.getByRole('textbox', { name: 'Rule name' })).toHaveProperty('value', 'Changed');
    fireEvent.click(screen.getByRole('button', { name: 'Automations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }));
    expect(await screen.findByRole('tab', { name: 'Rules · 1' })).toBeTruthy();
  });

  it('moves, duplicates and deletes a step from its menu, and keeps Rule Details closed', async () => {
    list([rule({ steps: [{ kind: 'flag' }, { kind: 'archive' }] })]);
    wrap(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    expect(screen.getByRole('button', { name: 'Rule Details' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'More for Flag' }));
    expect(screen.getByRole('menuitem', { name: 'Move Up' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move Down' }));
    const chips = () =>
      [...document.querySelectorAll('[data-step-card]')].map((c) => c.textContent);
    expect(chips()[1]).toContain('Archive');
    fireEvent.click(screen.getByRole('button', { name: 'More for Flag' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(chips().filter((t) => t?.includes('Flag'))).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'More for Flag' })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(chips().filter((t) => t?.includes('Flag'))).toHaveLength(1);
  });

  it('adds a condition and an If / Else, each opening its panel', async () => {
    list([rule()]);
    wrap(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Condition' }).at(-1)!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Card Type' }));
    expect(screen.getByRole('group', { name: 'Card Types' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'If / Else' }));
    expect(screen.getByText(/Its conditions decide which list runs/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Condition to If' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Who Did It' }));
    expect(screen.getByRole('group', { name: 'Roles' })).toBeTruthy();
  });

  it('tests the rule on a card as a dry run, shown as a run', async () => {
    list([rule()]);
    client.testRule.mockResolvedValue({
      run: run({ result: 'no_match', reason: 'Card Type is not Bug.' }),
    });
    wrap(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Test on a Card' }));
    fireEvent.click(await screen.findByRole('button', { name: /Publish pricing page/ }));
    expect(await screen.findByText('Card Type is not Bug.')).toBeTruthy();
    expect(client.testRule).toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({ name: 'Done Means Wrapped Up' }),
      'i48',
    );
    expect(track).toHaveBeenCalledWith('Plan', 'Tested', 'AutomationRule');
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Test on a Card' })).getByRole('button', {
        name: 'Done',
      }),
    );
    await act(async () => {});
    expect(screen.queryByText('Card Type is not Bug.')).toBeNull();
  });
});

describe('on a wide screen', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query.includes('min-width'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lays the rules out in columns under their heads, with the meter beside the tabs', async () => {
    list([
      rule(),
      rule({
        id: 'r2',
        name: 'Never Ran',
        stats: { lastRunAt: null, runsThisWeek: 1, failuresInARow: 0 },
      }),
    ]);
    wrap(<Harness />);
    expect(await screen.findByText('Never Ran')).toBeTruthy();
    expect(screen.getByText('Last Run')).toBeTruthy();
    expect(screen.getByText(/Rules that act on this plan’s cards/)).toBeTruthy();
    expect(document.querySelector('[data-rule-row="r2"]')!.textContent).toContain('Never');
  });

  it('lays the Audit Trail out in columns', async () => {
    list();
    client.listRuns.mockResolvedValue({
      runs: [run({ card: null, result: 'skipped', reason: 'Over the day’s runs.' })],
    });
    wrap(<Harness initial={{ view: 'runs' }} />);
    expect(await screen.findByText('Over the day’s runs.')).toBeTruthy();
    expect(screen.getByText('No card')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'When' }), { target: { value: '1' } });
    await waitFor(() => expect(client.listRuns).toHaveBeenCalledTimes(2));
  });

  it('puts the step panel beside the steps, with who edited the rule', async () => {
    list();
    wrap(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    expect(await screen.findByText(/Edited by Ana Costa/)).toBeTruthy();
    expect(document.querySelector('[data-step-panel]')).toBeTruthy();
  });
});
