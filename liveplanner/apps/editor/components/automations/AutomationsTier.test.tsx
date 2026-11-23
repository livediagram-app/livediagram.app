// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Tiers", "What the editor shows": the shared Automations screen and the plan's owner's
// tier. With Pro off it is as it always was: Runs today against the plan's 1,000, its 50 rules, and nothing asked of
// the subscription service. With Pro on the owner and the owning team see the owner's Runs This Month and their rules
// over everything they own; the notices, New Rule and Duplicate follow them, and the offer follows the plan's owner:
// Upgrade for the owner, Ask an Admin for a team's member, nothing for a collaborator (who sees Runs today).
import './test-kit';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import type { AutomationListedRule, AutomationsListResponse } from '@liveplanner/api-schema';
import { AutomationsDialog } from '@liveworkspace/automations-ui/AutomationsDialog';
import {
  AutomationsContext,
  type AutomationsTarget,
} from '@liveworkspace/automations-ui/AutomationsContext';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import type { Usage } from '@liveworkspace/subscription';
import { ownerOf, proOnForTests, proService, withPro, type Who } from '@/test/pro';
import { PLAN_AUTOMATIONS_PLUMBING } from './plan-plumbing';
import { forgetAutomations } from './use-automations';
import { useRunRule } from './use-run-rule';
import { ANA, outline, rule } from './test-fixtures';

const client = vi.hoisted(() => ({
  listAutomations: vi.fn(),
  duplicateRule: vi.fn(),
  runRule: vi.fn(),
  listRuns: vi.fn(),
}));
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  ...client,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const toast = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@liveworkspace/workbench/hooks/ui/useToast', () => ({ useToast: () => toast }));
const { AutomationRefusal } = await import('./automations-client');

proOnForTests();

const SCOPE = { ownerId: 'o1', itemId: 'p1', shareCode: null };
const o = outline();
const plan = {
  types: o.types,
  statusNames: o.statuses,
  people: o.people,
  items: o.items,
  self: ANA,
  openItem: vi.fn(),
  planTabs: () => [],
} as unknown as PlanContextValue;

const rules = (n: number): AutomationListedRule[] =>
  Array.from({ length: n }, (_, i) => rule({ id: `r${i}`, name: `Rule ${i}` }));

// The list as a Free plan's api answers it with Pro on, for whoever is looking.
function list(who: Who, over: Partial<AutomationsListResponse> = {}) {
  client.listAutomations.mockResolvedValue({
    rules: [rule()],
    runsToday: 60,
    runsPerDay: 1000,
    rulesMax: 50,
    owner: ownerOf(who),
    ...over,
  });
}

function Harness({ initial = { view: 'rules' } }: { initial?: AutomationsTarget }) {
  const [target, setTarget] = useState(initial);
  return (
    <PlanProvider value={plan}>
      <AutomationsDialog scope={SCOPE} target={target} onTarget={setTarget} onClose={() => {}} />
    </PlanProvider>
  );
}

function open(who: Who, initial?: AutomationsTarget, usage: Usage = {}) {
  const service = proService(who, usage);
  render(withPro(<Harness {...(initial ? { initial } : {})} />, service.fetcher));
  return service;
}

const notices = () => screen.queryAllByRole('status').filter((n) => n.hasAttribute('data-callout'));
const noticeSaying = (words: string | RegExp) =>
  waitFor(() => {
    const found = notices().find((n) =>
      typeof words === 'string' ? n.textContent?.includes(words) : words.test(n.textContent ?? ''),
    );
    if (!found) throw new Error(`No notice saying ${String(words)}`);
    return found;
  });

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
  client.listRuns.mockResolvedValue({ runs: [] });
});
afterEach(cleanup);

describe('with Pro off', () => {
  beforeEach(() => setProForTests(false));

  it('draws the screen as it always was, in the list’s numbers, and asks the service nothing', async () => {
    // A server with Pro on answers a browser built without it: the numbers show, and no Pro UI does.
    list('owner', { rules: rules(50), runsToday: 1000 });
    const { calls } = open('owner', { view: 'templates' });
    expect(
      await screen.findByText(/This plan has 50 rules, the most a plan can hold/),
    ).toBeTruthy();
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe(
      '1,000 of 1,000 runs today',
    );
    expect(screen.getByText('Daily limit reached: rules run again tomorrow')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Overdue Nudge/ })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: /Upgrade/ })).toBeNull();
    expect(document.querySelector('[data-usage-meter]')).toBeNull();
    expect(document.querySelector('[data-pro-badge]')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('leaves Duplicate on at the limit, as before: the api refuses and the toast says so', async () => {
    list('owner', { rules: rules(50) });
    client.duplicateRule.mockRejectedValue(
      new AutomationRefusal(409, { error: 'automation_rules_full', message: 'Full.' }),
    );
    open('owner');
    fireEvent.click(await screen.findByRole('button', { name: 'More for Rule 0' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'This plan has 50 rules, the most a plan can hold. Delete one to add another.',
      ),
    );
  });
});

describe('the Runs This Month meter', () => {
  it('shows the owner their month against their tier, with no nudge while there is plenty left', async () => {
    list('owner');
    open('owner', undefined, { automationRuns: { used: 60 } });
    const meter = await screen.findByRole('meter', { name: 'Runs This Month' });
    expect(meter.getAttribute('aria-valuetext')).toBe('60 of 500');
    expect(meter.getAttribute('aria-valuemax')).toBe('500');
    expect(document.querySelector('[data-usage-meter]')).not.toBeNull();
    expect(notices()).toEqual([]);
  });

  it('nudges a Free owner from 80% of the month, once, with See Pro', async () => {
    list('owner');
    open('owner', undefined, { automationRuns: { used: 455 } });
    const nudge = await noticeSaying(
      '45 automation runs left this month. Pro gives you 10,000 a month.',
    );
    expect(within(nudge).getByRole('button', { name: 'See Pro' })).toBeTruthy();
    fireEvent.click(within(nudge).getByRole('button', { name: 'Dismiss' }));
    expect(notices()).toEqual([]);
  });

  it('once used turns amber, says when rules run again and offers the owner the upgrade', async () => {
    list('owner');
    open('owner', undefined, { automationRuns: { used: 500 } });
    const notice = await noticeSaying(
      /This month’s automation runs are used\. Rules run again on 1 /,
    );
    expect(notice.textContent).toContain('Pro has 10,000 a month.');
    expect(within(notice).getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
    expect(document.querySelector('[data-usage-meter]')!.getAttribute('data-usage-meter')).toBe(
      'reached',
    );
  });

  it('shows a team’s member the team’s month, pointing them at an admin', async () => {
    list('member');
    open('member', undefined, { automationRuns: { used: 500 } });
    const notice = await noticeSaying('A team admin can move this team to Pro for Teams.');
    expect(notice.textContent).toContain('This month’s automation runs are used.');
    expect(within(notice).getByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Runs This Month' })).toBeTruthy();
  });

  it('shows a collaborator the plan’s Runs today, never the owner’s month', async () => {
    list('collaborator', { runsToday: 1000 });
    const { calls } = open('collaborator', undefined, { automationRuns: { used: 500 } });
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/owner'))).toBe(true));
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe(
      '1,000 of 1,000 runs today',
    );
    expect(screen.queryByRole('meter', { name: 'Runs This Month' })).toBeNull();
    expect(screen.getByText('Daily limit reached: rules run again tomorrow')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Upgrade|Ask an Admin|See Pro/ })).toBeNull();
  });

  it('shows an owner on Pro the solid badge, and at their limit no offer', async () => {
    list('owner-pro');
    open('owner-pro', undefined, { automationRuns: { used: 10_000 } });
    const notice = await noticeSaying(/This month’s automation runs are used/);
    await waitFor(() => expect(screen.getByRole('img', { name: 'You Have Pro' })).toBeTruthy());
    expect(within(notice).queryByRole('button')).toBeNull();
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('10,000 of 10,000');
  });
});

describe('Automation Rules over the owner’s total', () => {
  it('at the limit says why, offers the owner the upgrade, and turns New Rule and Duplicate off', async () => {
    list('owner', { rules: rules(5) });
    open('owner', undefined, { rules: { used: 25 } });
    const notice = await noticeSaying(
      'You have 25 rules, the most Free holds. Delete one to add another, or hold 500 with Pro.',
    );
    expect(within(notice).getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
    for (const button of screen.getAllByRole('button', { name: /New Rule/ }))
      expect(button).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'More for Rule 0' }));
    const duplicate = screen.getByRole('menuitem', { name: 'Duplicate' });
    expect(duplicate.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(duplicate);
    expect(client.duplicateRule).not.toHaveBeenCalled();
  });

  it('says the same on Templates, whose tiles open nothing', async () => {
    list('owner', { rules: rules(5) });
    open('owner', { view: 'templates' }, { rules: { used: 25 } });
    await noticeSaying(/the most Free holds/);
    expect(screen.getByRole('button', { name: /Overdue Nudge/ })).toHaveProperty('disabled', true);
    expect(screen.queryByText(/the most a plan can hold/)).toBeNull();
  });

  it('a team’s member is pointed at an admin', async () => {
    list('member', { rules: rules(5) });
    open('member', undefined, { rules: { used: 25 } });
    const asked = await noticeSaying('A team admin can move this team to Pro for Teams.');
    expect(asked.textContent).toContain('This team has 25 rules, the most Free holds.');
    expect(within(asked).getByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
  });

  it('a collaborator is told by the api’s refusal, offered nothing', async () => {
    list('collaborator', { rules: rules(5) });
    client.duplicateRule.mockRejectedValue(
      new AutomationRefusal(409, {
        error: 'automation_rules_full',
        limit: 'automationRules',
        used: 25,
        max: 25,
      }),
    );
    open('collaborator');
    fireEvent.click(await screen.findByRole('button', { name: 'More for Rule 0' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Its owner has 25 rules, the most allowed. Delete one to add another.',
      ),
    );
    expect(notices()).toEqual([]);
  });

  it('at the plan’s own 50 says so with no tier named', async () => {
    list('owner', { rules: rules(50) });
    open('owner');
    const notice = await noticeSaying(
      'This plan has 50 rules, the most a plan can hold. Delete one to add another.',
    );
    expect(within(notice).queryByRole('button', { name: /Upgrade/ })).toBeNull();
  });

  it('while the owner holds more than their tier keeps an Off rule’s switch off, saying why', async () => {
    list('owner', { rules: [...rules(3), rule({ id: 'off', name: 'Kept Off', enabled: false })] });
    open('owner', undefined, { rules: { used: 27 } });
    // The owner's total lands after the list: the switch is drawn again once it does.
    await waitFor(() =>
      expect(
        within(screen.getByText('Kept Off').closest('li')!).getByRole('switch', {
          name: 'Kept Off',
        }),
      ).toHaveProperty('disabled', true),
    );
    // An On rule still switches off.
    expect(
      within(screen.getByText('Rule 0').closest('li')!).getByRole('switch', { name: 'Rule 0' }),
    ).toHaveProperty('disabled', false);
  });

  it('with Pro off leaves every switch on, as before', async () => {
    setProForTests(false);
    list('owner', { rules: [...rules(3), rule({ id: 'off', name: 'Kept Off', enabled: false })] });
    open('owner', undefined, { rules: { used: 27 } });
    const row = (await screen.findByText('Kept Off')).closest('li')!;
    expect(within(row).getByRole('switch', { name: 'Kept Off' })).toHaveProperty('disabled', false);
  });

  it('below the limit shows no notice and leaves Duplicate on', async () => {
    list('owner', { rules: rules(9) });
    open('owner', undefined, { rules: { used: 24 } });
    fireEvent.click(await screen.findByRole('button', { name: 'More for Rule 0' }));
    expect(
      screen.getByRole('menuitem', { name: 'Duplicate' }).getAttribute('aria-disabled'),
    ).toBeNull();
    expect(notices()).toEqual([]);
  });
});

describe('Run Rule refused', () => {
  const manual = rule({ id: 'm1', name: 'Escalate to Leads', trigger: { kind: 'manual' } });
  const withAccess = ({ children }: { children: ReactNode }) => (
    <AutomationsContext.Provider
      value={{ scope: SCOPE, plumbing: PLAN_AUTOMATIONS_PLUMBING, open: vi.fn() }}
    >
      {children}
    </AutomationsContext.Provider>
  );
  const refused = async (body: ConstructorParameters<typeof AutomationRefusal>[1]) => {
    client.runRule.mockRejectedValue(new AutomationRefusal(429, body));
    const { result } = renderHook(() => useRunRule('i1'), { wrapper: withAccess });
    await waitFor(() => expect(result.current).not.toBeNull());
    result.current!.onRun('m1');
  };

  it('with the owner’s month used says when rules run again', async () => {
    list('owner', { rules: [manual] });
    await refused({
      error: 'automation_runs_used',
      limit: 'automationRunsPerMonth',
      used: 500,
      max: 500,
    });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/^This month’s automation runs are used\. Rules run again on 1 /),
      ),
    );
  });

  it('with the plan’s day spent says so in its fixed 1,000, Pro on or off', async () => {
    setProForTests(false);
    client.listAutomations.mockResolvedValue({
      rules: [manual],
      runsToday: 1000,
      runsPerDay: 1000,
    });
    await refused({ error: 'automation_budget_spent' });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'This plan has used today’s 1,000 runs. Rules run again tomorrow.',
      ),
    );
  });
});
